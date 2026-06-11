/* aruta.sh GBA Link core — single-threaded mGBA WASM wrapper with SIO→JS hooks.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Replaces the fork's pthread-based main.c: no mCoreThread, no SDL.
 * JS drives emulation by calling runFrame() from requestAnimationFrame,
 * reads the video buffer from the heap, pulls audio via readAudio(), and
 * bridges multiplayer serial transfers through the netDriver hooks below.
 *
 * SIO model (GBA MULTI mode, 2 players):
 *  - master (id 0) game sets SIOCNT Start → driver keeps Busy high and
 *    fires Module.onSioStart(localSIOMLT_SEND). JS must NOT re-enter the
 *    wasm synchronously from that callback — queue and complete later.
 *  - JS exchanges the two SIOMLT_SEND values between peers, then calls
 *    sioCompleteMulti(d0, d1) on BOTH instances: writes SIOMULTI0/1,
 *    clears Busy, sets the player Id and raises the SIO IRQ if enabled.
 *  - slave (id 1) never initiates; JS asks it for sioGetSendValue() when
 *    the master's transfer request arrives.
 */
#include <mgba/core/core.h>
#include <mgba/core/config.h>
#include <mgba/core/log.h>
#include <mgba/core/serialize.h>
#include <mgba/internal/gba/gba.h>
#include <mgba/internal/gba/io.h>
#include <mgba/internal/gba/sio.h>
#include <mgba/internal/gba/savedata.h>
#include <mgba-util/audio-buffer.h>
#include <mgba-util/vfs.h>

#include <emscripten.h>

static void _nullLog(struct mLogger* logger, int category, enum mLogLevel level, const char* format, va_list args) {
	UNUSED(logger);
	UNUSED(category);
	UNUSED(level);
	UNUSED(format);
	UNUSED(args);
}
static struct mLogger logCtx = { .log = _nullLog };

static struct mCore* core = NULL;
static mColor* videoBuffer = NULL;
static unsigned videoW = 240;
static unsigned videoH = 160;

/* ───────────────────────────── SIO net driver ───────────────────────────── */

struct GBASIONetDriver {
	struct GBASIODriver d;
	int id;              /* 0 = master, 1 = slave */
	bool connected;      /* peer attached (set from JS) */
	bool transferPending; /* master only: waiting for peer reply */
};

static struct GBASIONetDriver netDriver;

static void _updateStatusBits(struct GBASIO* sio) {
	sio->siocnt = GBASIOMultiplayerSetSlave(sio->siocnt, netDriver.id > 0);
	sio->siocnt = GBASIOMultiplayerSetReady(sio->siocnt, netDriver.connected);
	if (netDriver.id) {
		sio->rcnt |= 4;
	} else {
		sio->rcnt &= ~4;
	}
}

static bool netInit(struct GBASIODriver* driver) {
	UNUSED(driver);
	return true;
}

static void netDeinit(struct GBASIODriver* driver) {
	UNUSED(driver);
}

static bool netLoad(struct GBASIODriver* driver) {
	netDriver.transferPending = false;
	_updateStatusBits(driver->p);
	return true;
}

static bool netUnload(struct GBASIODriver* driver) {
	UNUSED(driver);
	netDriver.transferPending = false;
	return true;
}

static uint16_t netWriteRegister(struct GBASIODriver* driver, uint32_t address, uint16_t value) {
	struct GBASIO* sio = driver->p;
	if (address == GBA_REG_SIOCNT) {
		/* Writable bits only; status bits (Ready/Slave/Id/Error) are ours. */
		value &= 0xFF83;
		value |= sio->siocnt & 0x00FC;
		value = GBASIOMultiplayerSetSlave(value, netDriver.id > 0);
		value = GBASIOMultiplayerSetReady(value, netDriver.connected);

		if ((value & 0x0080) && !netDriver.id && netDriver.connected && !netDriver.transferPending) {
			/* Master starts a transfer: latch Busy, hand our send value to JS,
			 * and break out of the current runLoop slice so JS can wait for
			 * the peer's value with the emulated clock frozen mid-frame
			 * (Emerald clocks 9 transfers per frame off Timer3 and raises a
			 * lag error if a vblank arrives early — same earlyExit trick as
			 * mGBA's own lockstep driver). */
			netDriver.transferPending = true;
			struct GBA* gba = sio->p;
			uint16_t send = gba->memory.io[GBA_REG(SIOMLT_SEND)];
			gba->memory.io[GBA_REG(SIOMULTI0)] = 0xFFFF;
			gba->memory.io[GBA_REG(SIOMULTI1)] = 0xFFFF;
			gba->memory.io[GBA_REG(SIOMULTI2)] = 0xFFFF;
			gba->memory.io[GBA_REG(SIOMULTI3)] = 0xFFFF;
			sio->rcnt &= ~1;
			gba->earlyExit = true;
			EM_ASM({
				if (Module.onSioStart) Module.onSioStart($0);
			}, send);
		}
		if (netDriver.transferPending) {
			value |= 0x0080;
		} else if (netDriver.id) {
			/* Slaves cannot hold Busy via their own writes. */
			value &= ~0x0080;
		}
	}
	return value;
}

/* Set local player id (0 = master / 1 = slave) and peer-connected flag. */
EMSCRIPTEN_KEEPALIVE void sioSetLink(int id, int connected) {
	netDriver.id = id ? 1 : 0;
	netDriver.connected = !!connected;
	if (core && netDriver.d.p) {
		_updateStatusBits(netDriver.d.p);
	}
}

/* Current SIOMLT_SEND — what this GBA would put on the wire. */
EMSCRIPTEN_KEEPALIVE int sioGetSendValue(void) {
	if (!core) {
		return 0xFFFF;
	}
	struct GBA* gba = (struct GBA*) core->board;
	return gba->memory.io[GBA_REG(SIOMLT_SEND)];
}

/* True while the master is stalled waiting for the peer's value. */
EMSCRIPTEN_KEEPALIVE int sioTransferPending(void) {
	return netDriver.transferPending;
}

static int sioIrqCount = 0;
static int sioCompleteCount = 0;

/* Ring log of completed transfer pairs for divergence debugging. */
#define SIO_LOG_LEN 256
static uint32_t sioLog[SIO_LOG_LEN];
static int sioLogPos = 0;

/* Complete a MULTI transfer on this instance with both players' values.
 * Call between frames (never synchronously from inside onSioStart). */
EMSCRIPTEN_KEEPALIVE void sioCompleteMulti(int d0, int d1) {
	if (!core) {
		return;
	}
	struct GBA* gba = (struct GBA*) core->board;
	struct GBASIO* sio = &gba->sio;
	gba->memory.io[GBA_REG(SIOMULTI0)] = d0 & 0xFFFF;
	gba->memory.io[GBA_REG(SIOMULTI1)] = d1 & 0xFFFF;
	gba->memory.io[GBA_REG(SIOMULTI2)] = 0xFFFF;
	gba->memory.io[GBA_REG(SIOMULTI3)] = 0xFFFF;
	sio->rcnt |= 1;
	sio->siocnt = GBASIOMultiplayerClearBusy(sio->siocnt);
	sio->siocnt = GBASIOMultiplayerSetId(sio->siocnt, netDriver.id);
	netDriver.transferPending = false;
	++sioCompleteCount;
	sioLog[sioLogPos % SIO_LOG_LEN] = ((d0 & 0xFFFF) << 16) | (d1 & 0xFFFF);
	++sioLogPos;
	if (GBASIOMultiplayerIsIrq(sio->siocnt)) {
		++sioIrqCount;
		GBARaiseIRQ(gba, GBA_IRQ_SIO, 0);
	}
}

EMSCRIPTEN_KEEPALIVE int sioLogCount(void) {
	return sioLogPos;
}

EMSCRIPTEN_KEEPALIVE int sioLogGet(int i) {
	return sioLog[i % SIO_LOG_LEN];
}

/* ── slave-side transfer queue ──
 * The master bursts up to 9 transfers per frame (Pokémon clocks them off
 * Timer3) and the network delivers them back-to-back in one JS turn. The
 * serial IF bit is a single flag: completing them all at once collapses 9
 * IRQs into 1 and the game's ISR misses 8 transfers. Instead JS pushes
 * master values here and an mTiming event completes them one at a time,
 * waiting for the previous serial IRQ to be serviced first, with emulated
 * CPU time in between — exactly like a real cable. */
#define SIO_QUEUE_LEN 64
static struct {
	uint16_t seq;
	uint16_t value;
} sioQueue[SIO_QUEUE_LEN];
static int sioQHead = 0;
static int sioQCount = 0;
static struct mTimingEvent sioSlaveEvent;

static bool sioDrainArmed = false;

static void _sioSlaveDrain(struct mTiming* timing, void* context, uint32_t cyclesLate) {
	UNUSED(context);
	UNUSED(cyclesLate);
	if (!core || !sioQCount) {
		sioDrainArmed = false;
		return;
	}
	struct GBA* gba = (struct GBA*) core->board;
	if (gba->memory.io[GBA_REG(IF)] & (1 << GBA_IRQ_SIO)) {
		/* Previous serial IRQ not yet serviced — let the CPU breathe. */
		sioDrainArmed = false;
		mTimingSchedule(timing, &sioSlaveEvent, 2048);
		return;
	}
	if (!sioDrainArmed) {
		/* Two-phase delivery: IF clears at IntrMain ENTRY, but SerialCB
		 * reads the SIOMULTI registers a few hundred cycles later.
		 * Completing the next transfer inside that window overwrites the
		 * registers before the handler reads them — the game then loses a
		 * halfword and its packet checksum fails ("link error"). Seeing IF
		 * clear only ARMS the delivery; the write happens one grace period
		 * later, when the previous handler is guaranteed done. */
		sioDrainArmed = true;
		mTimingSchedule(timing, &sioSlaveEvent, 4096);
		return;
	}
	sioDrainArmed = false;
	int seq = sioQueue[sioQHead].seq;
	int value = sioQueue[sioQHead].value;
	sioQHead = (sioQHead + 1) % SIO_QUEUE_LEN;
	--sioQCount;
	int sv = gba->memory.io[GBA_REG(SIOMLT_SEND)];
	sioCompleteMulti(value, sv);
	EM_ASM({
		if (Module.onSioReply) Module.onSioReply($0, $1);
	}, seq, sv);
	if (sioQCount) {
		/* Pace at the real Timer3 cadence (197*64 cycles). */
		mTimingSchedule(timing, &sioSlaveEvent, 12608);
	}
}

/* Queue a master transfer on the slave; drained with emulated time between
 * completions so every transfer gets its own serial IRQ. */
EMSCRIPTEN_KEEPALIVE void sioPushMaster(int seq, int value) {
	if (!core || sioQCount >= SIO_QUEUE_LEN) {
		return;
	}
	int tail = (sioQHead + sioQCount) % SIO_QUEUE_LEN;
	sioQueue[tail].seq = seq & 0xFFFF;
	sioQueue[tail].value = value & 0xFFFF;
	++sioQCount;
	struct GBA* gba = (struct GBA*) core->board;
	if (!mTimingIsScheduled(&gba->timing, &sioSlaveEvent)) {
		mTimingSchedule(&gba->timing, &sioSlaveEvent, 512);
	}
}

EMSCRIPTEN_KEEPALIVE int sioQueueCount(void) {
	return sioQCount;
}

/* Debug snapshot of the serial state — JS packs these into an object. */
EMSCRIPTEN_KEEPALIVE int sioGetSiocnt(void) {
	if (!core) {
		return -1;
	}
	struct GBA* gba = (struct GBA*) core->board;
	return gba->sio.siocnt;
}

EMSCRIPTEN_KEEPALIVE int sioGetRcnt(void) {
	if (!core) {
		return -1;
	}
	struct GBA* gba = (struct GBA*) core->board;
	return gba->sio.rcnt;
}

EMSCRIPTEN_KEEPALIVE int sioGetMode(void) {
	if (!core) {
		return -1;
	}
	struct GBA* gba = (struct GBA*) core->board;
	return gba->sio.mode;
}

EMSCRIPTEN_KEEPALIVE int sioGetIrqCount(void) {
	return sioIrqCount;
}

/* Raw bus reads for protocol debugging (IE/IME, game link state, …). */
EMSCRIPTEN_KEEPALIVE int readBus16(int address) {
	if (!core) {
		return -1;
	}
	return core->busRead16(core, (uint32_t) address);
}

EMSCRIPTEN_KEEPALIVE int readBus8(int address) {
	if (!core) {
		return -1;
	}
	return core->busRead8(core, (uint32_t) address);
}

EMSCRIPTEN_KEEPALIVE int sioGetCompleteCount(void) {
	return sioCompleteCount;
}

/* ───────────────────────────── core lifecycle ───────────────────────────── */

EMSCRIPTEN_KEEPALIVE void quitGame(void) {
	if (!core) {
		return;
	}
	core->unloadROM(core);
	mCoreConfigDeinit(&core->config);
	core->deinit(core);
	core = NULL;
	if (videoBuffer) {
		free(videoBuffer);
		videoBuffer = NULL;
	}
}

EMSCRIPTEN_KEEPALIVE bool loadGame(const char* path) {
	quitGame();
	mLogSetDefaultLogger(&logCtx);

	core = mCoreFind(path);
	if (!core) {
		return false;
	}
	core->init(core);
	core->opts.savegamePath = strdup("/data/saves");
	core->opts.savestatePath = strdup("/data/states");

	mCoreConfigInit(&core->config, "wasm-st");
	struct mCoreOptions defaultOpts = {
		.useBios = true,
		.volume = 0x100,
		.logLevel = 0,
	};
	mCoreConfigLoadDefaults(&core->config, &defaultOpts);
	mCoreLoadConfig(core);

	if (!mCoreLoadFile(core, path)) {
		core->deinit(core);
		core = NULL;
		return false;
	}
	mDirectorySetMapOptions(&core->dirs, &core->opts);
	mCoreAutoloadSave(core);

	struct VFile* bios = VFileOpen("/gba_bios.bin", O_RDONLY);
	if (bios) {
		core->loadBIOS(core, bios, 0);
	}

	core->baseVideoSize(core, &videoW, &videoH);
	videoBuffer = malloc(videoW * videoH * BYTES_PER_PIXEL);
	core->setVideoBuffer(core, videoBuffer, videoW);
	core->setAudioBufferSize(core, 2048);

	netDriver.d.init = netInit;
	netDriver.d.deinit = netDeinit;
	netDriver.d.load = netLoad;
	netDriver.d.unload = netUnload;
	netDriver.d.writeRegister = netWriteRegister;
	netDriver.transferPending = false;
	sioQHead = 0;
	sioQCount = 0;
	sioSlaveEvent.name = "GBA SIO net slave";
	sioSlaveEvent.callback = _sioSlaveDrain;
	sioSlaveEvent.context = NULL;
	sioSlaveEvent.priority = 0x80;
	struct GBA* gba = (struct GBA*) core->board;
	GBASIOSetDriver(&gba->sio, &netDriver.d, GBA_SIO_MULTI);

	core->reset(core);
	return true;
}

EMSCRIPTEN_KEEPALIVE void runFrame(void) {
	if (core) {
		core->runFrame(core);
	}
}

/* Run until frame end OR until the SIO driver requests an early exit
 * (transfer waiting on the network). Pair with frameCount() to detect
 * whether the frame actually completed. */
EMSCRIPTEN_KEEPALIVE void runLoop(void) {
	if (core) {
		core->runLoop(core);
	}
}

/* Run for ~n emulated cycles, not a full frame: lets the slave drain its
 * transfer queue at sub-frame granularity, so a burst of master transfers
 * doesn't make the slave's game clock race ahead of the master's. */
static struct mTimingEvent sioBreakEvent;
static void _sioBreak(struct mTiming* timing, void* context, uint32_t cyclesLate) {
	UNUSED(timing);
	UNUSED(context);
	UNUSED(cyclesLate);
	if (core) {
		((struct GBA*) core->board)->earlyExit = true;
	}
}

EMSCRIPTEN_KEEPALIVE void runCycles(int n) {
	if (!core) {
		return;
	}
	struct GBA* gba = (struct GBA*) core->board;
	sioBreakEvent.name = "GBA SIO net break";
	sioBreakEvent.callback = _sioBreak;
	sioBreakEvent.context = NULL;
	sioBreakEvent.priority = 0x70;
	if (mTimingIsScheduled(&gba->timing, &sioBreakEvent)) {
		mTimingDeschedule(&gba->timing, &sioBreakEvent);
	}
	mTimingSchedule(&gba->timing, &sioBreakEvent, n > 0 ? n : 1);
	core->runLoop(core);
}

EMSCRIPTEN_KEEPALIVE int frameCount(void) {
	if (!core) {
		return -1;
	}
	return core->frameCounter(core);
}

EMSCRIPTEN_KEEPALIVE void setKeys(int keys) {
	if (core) {
		core->setKeys(core, keys);
	}
}

/* ───────────────────────────── video / audio ───────────────────────────── */

EMSCRIPTEN_KEEPALIVE int getVideoBufferPtr(void) {
	return (int) (intptr_t) videoBuffer;
}

EMSCRIPTEN_KEEPALIVE int getVideoWidth(void) {
	return videoW;
}

EMSCRIPTEN_KEEPALIVE int getVideoHeight(void) {
	return videoH;
}

/* Pull up to `count` interleaved stereo frames into `out`; returns frames read.
 * Core output rate is 32768 Hz. */
EMSCRIPTEN_KEEPALIVE int readAudio(int16_t* out, int count) {
	if (!core) {
		return 0;
	}
	struct mAudioBuffer* buf = core->getAudioBuffer(core);
	if (!buf) {
		return 0;
	}
	return mAudioBufferRead(buf, out, count);
}

/* ───────────────────────────── saves / states ───────────────────────────── */

/* Force SRAM out to the FS file mapped by mCoreAutoloadSave so JS can read
 * /data/saves/<name>.sav without waiting for the savedata dirty timer. */
EMSCRIPTEN_KEEPALIVE void flushSave(void) {
	if (!core) {
		return;
	}
	struct GBA* gba = (struct GBA*) core->board;
	struct GBASavedata* savedata = &gba->memory.savedata;
	if (savedata->vf && savedata->data) {
		savedata->vf->sync(savedata->vf, savedata->data, GBASavedataSize(savedata));
	}
}

EMSCRIPTEN_KEEPALIVE bool saveState(int slot) {
	if (!core) {
		return false;
	}
	return mCoreSaveState(core, slot, SAVESTATE_SAVEDATA | SAVESTATE_RTC | SAVESTATE_METADATA);
}

EMSCRIPTEN_KEEPALIVE bool loadState(int slot) {
	if (!core) {
		return false;
	}
	return mCoreLoadState(core, slot, SAVESTATE_SAVEDATA | SAVESTATE_RTC);
}
