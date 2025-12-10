import { state } from './state.js';
import { audio } from './audio.js';

export class Game {
    constructor(canvas, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onGameOver = onGameOver;
        this.width = canvas.width;
        this.height = canvas.height;
        
        this.player = null;
        this.nodes = [];
        this.particles = [];
        this.cameraY = 0;
        this.running = false;
        
        // Settings
        this.gravity = 500;
        this.rotationSpeed = 4;
        this.nodeSpawnRate = 100;
        this.lastTime = 0;
        
        // Replay System
        this.replayData = {
            nodes: [],
            frames: [],
            startTime: 0
        };
        this.nodeIdCounter = 0;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    start() {
        this.running = true;
        
        // Reset Replay Data
        this.replayData = {
            nodes: [],
            frames: [],
            startTime: Date.now()
        };
        this.nodeIdCounter = 0;

        this.player = {
            x: this.width / 2,
            y: this.height - 200,
            vx: 0,
            vy: 0,
            angle: -Math.PI / 2,
            radius: 10,
            state: 'orbit', // orbit, dash, fall
            orbitNode: null,
            orbitDist: 40,
            orbitAngle: 0
        };

        // Initialize with a starting node
        this.nodes = [];
        this.addNode(this.width / 2, this.height - 200, 'start');
        
        // Attach player to start node
        this.player.orbitNode = this.nodes[0];
        
        // Generate initial path
        for(let i=1; i<10; i++) {
            this.generateNextNode();
        }

        this.particles = [];
        this.cameraY = this.player.y - this.height * 0.7;
        
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    }

    input() {
        if (!this.running) return;
        audio.init(); // Ensure audio context is ready

        if (this.player.state === 'orbit') {
            // Calculate dash vector based on current orbit angle
            const speed = 600 + (state.data.upgrades.speed * 50);
            this.player.vx = Math.cos(this.player.orbitAngle) * speed;
            this.player.vy = Math.sin(this.player.orbitAngle) * speed;
            this.player.state = 'dash';
            this.player.orbitNode = null;
            audio.play('dash');
        }
    }

    generateNextNode() {
        const lastNode = this.nodes[this.nodes.length - 1];
        const range = 150 + (state.data.upgrades.luck * 5); // Slightly easier with luck
        const minGap = 80;

        // Procedural generation logic
        let x = Math.random() * (this.width - 100) + 50;
        let y = lastNode.y - (Math.random() * (range - minGap) + minGap);

        // Keep within bounds
        x = Math.max(50, Math.min(this.width - 50, x));

        // Determine type
        const typeRoll = Math.random();
        let type = 'normal';
        if (typeRoll > 0.9 - (state.data.upgrades.luck * 0.02)) type = 'rare'; // Currency node

        this.addNode(x, y, type);
    }

    addNode(x, y, type) {
        const node = {
            id: this.nodeIdCounter++,
            x, y, type,
            radius: type === 'rare' ? 15 : 20,
            active: true,
            pulse: 0
        };
        this.nodes.push(node);
        
        // Track for replay (snapshot of properties)
        if (this.replayData) {
            this.replayData.nodes.push({
                id: node.id,
                x: node.x, 
                y: node.y, 
                type: node.type,
                radius: node.radius
            });
        }
    }

    update(dt) {
        if (!this.running) return;

        // Replay Recording
        this.recordFrame();

        // Player Logic
        if (this.player.state === 'orbit') {
            this.player.orbitAngle += this.rotationSpeed * dt;
            this.player.x = this.player.orbitNode.x + Math.cos(this.player.orbitAngle) * this.player.orbitDist;
            this.player.y = this.player.orbitNode.y + Math.sin(this.player.orbitAngle) * this.player.orbitDist;
            this.player.angle = this.player.orbitAngle; // Face outward
        } else if (this.player.state === 'dash') {
            this.player.x += this.player.vx * dt;
            this.player.y += this.player.vy * dt;
            this.player.vy += this.gravity * dt; // Gravity affects dash slightly
            this.player.angle = Math.atan2(this.player.vy, this.player.vx);

            // Check Collisions
            for (let node of this.nodes) {
                if (!node.active) continue;

                const dx = this.player.x - node.x;
                const dy = this.player.y - node.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < node.radius + this.player.radius + 10) {
                    // Hit!
                    this.handleCollision(node);
                    break;
                }
            }
        }

        // Camera Follow
        const targetCamY = this.player.y - this.height * 0.7;
        this.cameraY += (targetCamY - this.cameraY) * 5 * dt;

        // Cleanup Nodes
        this.nodes = this.nodes.filter(n => n.y < this.cameraY + this.height + 100);
        
        // Spawn Nodes
        const highestNode = this.nodes[this.nodes.length-1];
        if (highestNode.y > this.cameraY - 200) {
            this.generateNextNode();
        }

        // Death Check
        if (this.player.y > this.cameraY + this.height + 50) {
            this.gameOver();
        }

        // Boundaries
        if (this.player.x < 0 || this.player.x > this.width) {
            this.player.vx *= -1; // Bounce off walls
            this.player.x = Math.max(0, Math.min(this.width, this.player.x));
        }

        // Particles
        this.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.alpha = p.life / p.maxLife;
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }

    handleCollision(node) {
        // Record collection event for the CURRENT frame
        if (this.replayData.frames.length > 0) {
            const lastFrame = this.replayData.frames[this.replayData.frames.length - 1];
            if (!lastFrame.events) lastFrame.events = [];
            lastFrame.events.push({ type: 'collect', nodeId: node.id });
        }

        // Reset player state to orbit
        this.player.state = 'orbit';
        this.player.orbitNode = node;
        this.player.orbitAngle = Math.atan2(this.player.y - node.y, this.player.x - node.x);
        this.player.vx = 0;
        this.player.vy = 0;

        // Reward logic
        if (node.type !== 'start') {
            state.session.score++;
            state.session.combo++;
            
            // Currency
            let gain = 1;
            if (node.type === 'rare') gain = 5;
            
            // Magnet upgrade effect simulates gathering stray data
            if (Math.random() < state.data.upgrades.magnet * 0.1) gain += 1;

            state.session.currencyCollected += gain;
            
            // Visuals
            this.createExplosion(node.x, node.y, node.type === 'rare' ? '#0ff' : '#f0f');
            audio.play('hit');
            
            // Disable node re-entry immediately so we don't double trigger
            // (In this design, we orbit the node we hit, so we keep it active)
        }
    }

    createExplosion(x, y, color) {
        for(let i=0; i<15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                life: 0.5,
                maxLife: 0.5,
                size: Math.random() * 3 + 1
            });
        }
    }

    gameOver() {
        this.running = false;
        audio.play('explode');
        this.onGameOver(this.replayData);
    }

    recordFrame() {
        this.replayData.frames.push({
            player: {
                x: this.player.x,
                y: this.player.y,
                angle: this.player.angle,
                state: this.player.state
            },
            cameraY: this.cameraY
        });
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#050510';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(0, -this.cameraY);

        // Draw Nodes
        for (let node of this.nodes) {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            if (node.type === 'rare') {
                this.ctx.fillStyle = '#0ff';
                this.ctx.shadowColor = '#0ff';
            } else if (node.type === 'start') {
                this.ctx.fillStyle = '#fff';
                this.ctx.shadowColor = '#fff';
            } else {
                this.ctx.fillStyle = '#f0f';
                this.ctx.shadowColor = '#f0f';
            }
            this.ctx.shadowBlur = 15;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Inner core
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius * 0.5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#fff';
            this.ctx.fill();
        }

        // Draw Player
        if (this.running) {
            this.ctx.save();
            this.ctx.translate(this.player.x, this.player.y);
            this.ctx.rotate(this.player.angle);
            
            // Player shape (Triangle)
            this.ctx.beginPath();
            this.ctx.moveTo(10, 0);
            this.ctx.lineTo(-10, 7);
            this.ctx.lineTo(-10, -7);
            this.ctx.closePath();
            
            this.ctx.fillStyle = '#0f0';
            this.ctx.shadowColor = '#0f0';
            this.ctx.shadowBlur = 20;
            this.ctx.fill();
            
            // Trail
            if (this.player.state === 'dash') {
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(-10, 0);
                this.ctx.lineTo(-40, 0);
                this.ctx.stroke();
            }

            this.ctx.restore();
        }

        // Particles
        for (let p of this.particles) {
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;

        this.ctx.restore();
    }

    loop(timestamp) {
        if (!this.running) return;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (this.running) {
            requestAnimationFrame(this.loop.bind(this));
        }
    }
}