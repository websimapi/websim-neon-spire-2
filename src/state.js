// Handles persistent data, upgrades, and session state

const DEFAULT_STATE = {
    currency: 0,
    highscore: 0,
    level: 1,
    xp: 0,
    xpToNext: 1000,
    lastLogin: 0,
    upgrades: {
        speed: 1, // Dash speed
        magnet: 1, // Coin collection range
        luck: 1   // Rare node chance
    }
};

class GameState {
    constructor() {
        this.data = this.load();
        this.session = {
            score: 0,
            currencyCollected: 0,
            combo: 0
        };
    }

    load() {
        const stored = localStorage.getItem('neonSpireSave');
        return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : { ...DEFAULT_STATE };
    }

    save() {
        localStorage.setItem('neonSpireSave', JSON.stringify(this.data));
    }

    // Progression Logic
    addXP(amount) {
        this.data.xp += amount;
        if (this.data.xp >= this.data.xpToNext) {
            this.data.xp -= this.data.xpToNext;
            this.data.level++;
            this.data.xpToNext = Math.floor(this.data.xpToNext * 1.2);
            return true; // Leveled up
        }
        this.save();
        return false;
    }

    canAfford(cost) {
        return this.data.currency >= cost;
    }

    spend(amount) {
        if (this.canAfford(amount)) {
            this.data.currency -= amount;
            this.save();
            return true;
        }
        return false;
    }

    upgrade(type) {
        const costs = this.getUpgradeCosts();
        const cost = costs[type];
        if (this.spend(cost)) {
            this.data.upgrades[type]++;
            this.save();
            return true;
        }
        return false;
    }

    getUpgradeCosts() {
        return {
            speed: Math.floor(100 * Math.pow(1.5, this.data.upgrades.speed - 1)),
            magnet: Math.floor(150 * Math.pow(1.5, this.data.upgrades.magnet - 1)),
            luck: Math.floor(300 * Math.pow(2.0, this.data.upgrades.luck - 1))
        };
    }

    checkDaily() {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        return (now - this.data.lastLogin > oneDay);
    }

    claimDaily() {
        this.data.lastLogin = Date.now();
        this.save();
    }
}

export const state = new GameState();