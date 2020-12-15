const fs = require("fs");

class SaveRotator {
    constructor(omegga, config, store) {
        this.omegga = omegga;
        this.config = config;
        this.store = store;
    }

    shuffleSaves() {
        this.saves = this.saves.map(s => [s, Math.random()]).sort((a, b) => a[1] < b[1]).map(s => s[0]);
    }

    async rotateMap(callerIsInterval) {
        // Refresh the interval timer if the caller wasn't the timer, and we're actually using an interval to control map rotation (e.g. when !rtv is run mid-way thru waiting for map rotation)
        if (!callerIsInterval && this.interval != undefined)
            this.interval.refresh();

        this.voters = [];
        this.omegga.clearAllBricks(true); // boolean will matter in a5
        this.mapIndex++;
        if (this.mapIndex >= this.saves.length) {
            this.mapIndex = 0;
            this.shuffleSaves();
        }

        // Wait after clearing if the field is greater than zero
        if (this.config["wait-after-clearing"] > 0)
            await new Promise(resolve => setTimeout(resolve, this.config["wait-after-clearing"] * 1000));

        this.omegga.loadBricks(this.saves[this.mapIndex]);
    }

    checkVoters() {
        return this.voters.length >= this.votesRequired();
    }

    votesRequired() {
        return Math.floor(this.omegga.getPlayers().length * this.config["percentage-rtv-to-rotate"]);
    }

    async init() {
        this.saves = this.config.saves.split(',').map(n => n.trim());

        // If the saves list is blank, grab saves from the Builds directory instead
        if (this.config.saves.trim() == "")
            this.saves = (await fs.promises.readdir("data/Saved/Builds")).filter(s => s.endsWith(".brs")).map(s => s.substring(0, s.length - 4));

        this.shuffleSaves();

        if (this.config["rotate-on-interval"] > 0) {
            this.interval = setInterval(async () => {
                this.omegga.broadcast("Rotating the map...");
                await this.rotateMap(true);
            }, this.config["rotate-on-interval"] * 1000);
        }

        this.voters = [];
        this.mapIndex = -1; // Initially below zero as the map needs to be rotated once to correctly pass through a full shuffle

        this.omegga.on("leave", async (name) => {
            // Remove voters from the voters array if they leave the game
            const index = this.voters.indexOf(name);
            if (index != -1) {
                this.voters.splice(index, 1);
            }

            if (this.checkVoters()) {
                this.omegga.broadcast(`The vote now passes! Rotating the map...`);
                await this.rotateMap();
            }
        });

        this.omegga.on("chatcmd:rtv", async (name) => {
            if (!this.config["enable-vote-rocking"]) return; // Halt the command if `enable-vote-rocking` is false

            // Add or remove voters from the voters array
            const existingIndex = this.voters.indexOf(name);
            if (existingIndex == -1) {
                // The user has not voted, add them
                this.voters.push(name);
                if (this.checkVoters()) {
                    this.omegga.broadcast(`<b>${name}</b> has voted to switch the map! Rotating the map...`);
                    await this.rotateMap();
                } else {
                    this.omegga.broadcast(`<b>${name}</b> has voted to switch the map! <b>${this.votesRequired() - this.voters.length} more votes</b> required to switch.`);
                }
            } else {
                // The user has voted, remove them
                this.voters.splice(index, 1);
            }
        });
    }

    async stop() {
        
    }
}

module.exports = SaveRotator;