import { state } from './state.js';
import { audio } from './audio.js';

export class UI {
    constructor(game) {
        this.game = game;
        
        // Screens
        this.menuScreen = document.getElementById('menu-screen');
        this.hudScreen = document.getElementById('hud-screen');
        this.upgradeScreen = document.getElementById('upgrade-screen');
        this.resultsScreen = document.getElementById('results-screen');
        this.dailyModal = document.getElementById('daily-modal');

        // Dynamic Elements
        this.elScore = document.getElementById('hud-score');
        this.elCombo = document.getElementById('hud-combo');
        this.elCurrency = document.getElementById('hud-collected');
        
        this.initListeners();
        this.updateMenu();
    }

    showScreen(screen) {
        [this.menuScreen, this.hudScreen, this.upgradeScreen, this.resultsScreen].forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    initListeners() {
        // Play
        document.getElementById('btn-play').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('btn-retry').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('btn-replay').addEventListener('click', () => {
            this.showReplay();
        });

        // Menu Navigation
        document.getElementById('btn-home').addEventListener('click', () => {
            this.showScreen(this.menuScreen);
            this.updateMenu();
        });

        document.getElementById('btn-upgrades').addEventListener('click', () => {
            this.showScreen(this.upgradeScreen);
            this.renderUpgrades();
        });

        document.getElementById('btn-back-menu').addEventListener('click', () => {
            this.showScreen(this.menuScreen);
            this.updateMenu();
        });

        // Daily
        document.getElementById('btn-daily').addEventListener('click', () => {
            if (state.checkDaily()) {
                this.dailyModal.classList.add('active');
            } else {
                alert("Come back tomorrow for more supplies!");
            }
        });

        document.getElementById('btn-claim-daily').addEventListener('click', () => {
            if (state.checkDaily()) {
                state.data.currency += 500;
                state.claimDaily(); // Actually mark as claimed only when button is clicked
                state.save();
                this.dailyModal.classList.remove('active');
                this.updateMenu();
                audio.play('levelup');
            }
        });

        // Input Handler (Canvas interaction)
        // We attach to window to catch touches anywhere
        window.addEventListener('mousedown', (e) => {
            if (this.game.running) {
                this.game.input();
            }
        });
        
        window.addEventListener('touchstart', (e) => {
             if (this.game.running) {
                this.game.input();
            }
        }, {passive: false});

        // Periodic HUD update
        setInterval(() => {
            if (this.game.running) this.updateHUD();
        }, 100);
    }

    startGame() {
        this.showScreen(this.hudScreen);
        state.session = { score: 0, currencyCollected: 0, combo: 0 };
        this.game.start();
        audio.play('dash'); // Confirmation sound
    }

    handleGameOver(replayData) {
        this.showScreen(this.resultsScreen);
        this.lastReplayData = replayData;
        
        // Update State
        const score = state.session.score;
        const earned = state.session.currencyCollected;
        
        // Calculate Rewards
        const totalEarned = earned + Math.floor(score / 10); // Bonus for height
        state.data.currency += totalEarned;
        if (score > state.data.highscore) state.data.highscore = score;
        
        const leveledUp = state.addXP(score * 10);
        state.save();

        // UI Updates
        document.getElementById('res-score').innerText = score;
        document.getElementById('res-currency').innerText = earned;
        document.getElementById('res-total').innerText = totalEarned;

        // XP Bar
        const pct = (state.data.xp / state.data.xpToNext) * 100;
        document.getElementById('xp-bar').style.width = `${pct}%`;

        if (leveledUp) {
            audio.play('levelup');
            // Show level up notification logic here if desired
        }
    }

    async showReplay() {
        if (!this.lastReplayData) return;
        try {
            const { mountReplayUI } = await import('./replay.jsx');
            mountReplayUI(this.lastReplayData, () => {
                // On Close Callback
                document.getElementById('replay-root').classList.remove('active');
            });
            document.getElementById('replay-root').classList.add('active');
        } catch (e) {
            console.error("Failed to load replay module:", e);
        }
    }

    updateHUD() {
        this.elScore.innerText = Math.floor(this.game.player ? (this.game.player.y * -1 + this.game.height) / 10 : 0);
        this.elCombo.innerText = state.session.combo;
        this.elCurrency.innerText = state.session.currencyCollected;
    }

    updateMenu() {
        document.getElementById('menu-level').innerText = state.data.level;
        document.getElementById('menu-currency').innerText = state.data.currency;
        document.getElementById('menu-highscore').innerText = state.data.highscore;
    }

    renderUpgrades() {
        document.getElementById('upgrade-currency').innerText = state.data.currency;
        const list = document.getElementById('upgrades-list');
        list.innerHTML = '';

        const costs = state.getUpgradeCosts();
        const upgrades = [
            { id: 'speed', name: 'Thruster Overclock', desc: 'Increases dash velocity.' },
            { id: 'magnet', name: 'Data Magnet', desc: 'Attracts currency from further away.' },
            { id: 'luck', name: 'Algorithm Optimization', desc: 'Increases chance of rare nodes.' }
        ];

        upgrades.forEach(u => {
            const currentLevel = state.data.upgrades[u.id];
            const cost = costs[u.id];
            
            const div = document.createElement('div');
            div.className = 'upgrade-item';
            div.innerHTML = `
                <div class="upgrade-info">
                    <h4>${u.name} (Lvl ${currentLevel})</h4>
                    <p>${u.desc}</p>
                </div>
                <button class="upgrade-btn" data-id="${u.id}">${cost} DATA</button>
            `;
            
            const btn = div.querySelector('button');
            if (state.data.currency < cost) {
                btn.style.opacity = 0.5;
                btn.style.borderColor = '#555';
            }
            
            btn.onclick = () => {
                if (state.upgrade(u.id)) {
                    audio.play('levelup');
                    this.renderUpgrades(); // Refresh
                } else {
                    // Fail sound?
                }
            };

            list.appendChild(div);
        });
    }
}