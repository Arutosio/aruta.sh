document.addEventListener('DOMContentLoaded', function() {
    // Inizializza le particelle
    initParticles();
    
    // Animazione di digitazione per la descrizione
    const description = document.querySelector('.description p');
    const originalText = description.textContent;
    description.textContent = '';
    let i = 0;
    
    function typeWriter() {
        if (i < originalText.length) {
            description.textContent += originalText.charAt(i);
            i++;
            setTimeout(typeWriter, 50);
        }
    }
    
    // Avvia l'effetto di digitazione quando l'elemento è visibile
    setTimeout(typeWriter, 1000);
});

function initParticles() {
    const canvas = document.querySelector('.particles');
    const ctx = canvas.getContext('2d');
    let particlesArray = [];
    
    // Imposta le dimensioni del canvas
    function setCanvasSize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    setCanvasSize();
    window.addEventListener('resize', function() {
        setCanvasSize();
    });
    
    // Classe Particella
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
            // NUOVI COLORI: verde, rosa, viola
            this.color = `rgba(${Math.floor(Math.random() * 50 + 76)}, 
                            ${Math.floor(Math.random() * 100 + 63)}, 
                            ${Math.floor(Math.random() * 50 + 176)}, 
                            ${Math.random() * 0.3 + 0.1})`;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x > canvas.width || this.x < 0) {
                this.speedX = -this.speedX;
            }
            if (this.y > canvas.height || this.y < 0) {
                this.speedY = -this.speedY;
            }
        }
        
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Crea le particelle
    function init() {
        particlesArray = [];
        const numberOfParticles = (canvas.height * canvas.width) / 9000;
        
        for (let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new Particle());
        }
    }
    
    // Anima le particelle
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        
        requestAnimationFrame(animate);
    }
    
    init();
    animate();
}