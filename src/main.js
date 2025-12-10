import { Game } from './game.js';
import { UI } from './ui.js';
import { audio } from './audio.js';

// Boot
window.onload = async () => {
    const canvas = document.getElementById('gameCanvas');
    
    // Resize handler
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if(window.gameInstance) window.gameInstance.resize();
    };
    window.addEventListener('resize', resize);
    resize();

    // Initialize Systems
    const game = new Game(canvas, (replayData) => {
        // Game Over Callback
        window.uiInstance.handleGameOver(replayData);
    });
    
    window.gameInstance = game;
    window.uiInstance = new UI(game);

    // Audio unlocks on first interaction usually, handled in UI/Audio classes
    console.log("Neon Spire Initialized");
};