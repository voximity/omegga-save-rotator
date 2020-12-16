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

    async selectNextMap() {
        if (this.config["enable-map-voting"]) {
            // Map voting is enabled, so compile the list, broadcast, and wait for votes to be accumulated
            this.shuffleSaves();

            const allCandidates = Object.values(this.nominations).concat(this.saves);
            this.votingCandidates = allCandidates.filter((s, i) => allCandidates.indexOf(s) == i).slice(0, this.config["map-candidate-count"]);

            this.omegga.broadcast(`<color="#${this.config.color}">Voting will conclude in ${this.config["voting-time"]} seconds! <b>Vote now using <code>!vote #</code>!</b></color>`);
            for (const i in this.votingCandidates)
                this.omegga.broadcast(`${i * 1 /* this is precisely why javascript is cancerous */ + 1}) <b>${this.votingCandidates[i]}</b>`);

            this.voting = true;
            await new Promise(resolve => setTimeout(resolve, this.config["voting-time"] * 1000));
            this.voting = false;

            const winner = this.votingCandidates.map((c, i) => [c, Object.values(this.votes).filter(v => v - 1 == i).length]).sort((a, b) => b[1] - a[1])[0][0];
            this.omegga.broadcast(`<color="#${this.config.color}"><b>${winner}</b> has been selected!</color>`);

            return winner;
        } else {
            // Map voting is not enabled, so just continue down the shuffled list
            this.mapIndex++;
            if (this.mapIndex >= this.saves.length) {
                this.mapIndex = 0;
                this.shuffleSaves();
            }

            return this.saves[this.mapIndex];
        }
    }

    async rotateMap(callerIsInterval) {
        // Refresh the interval timer if the caller wasn't the timer, and we're actually using an interval to control map rotation (e.g. when !rtv is run mid-way thru waiting for map rotation)
        if (!callerIsInterval && this.interval != undefined)
            this.interval.refresh();

        const selectedMap = await this.selectNextMap();

        this.votes = {};
        this.nominations = {};
        this.voters = [];
        this.omegga.clearAllBricks(true); // boolean will matter in a5

        // Wait after clearing if the field is greater than zero
        if (this.config["wait-after-clearing"] > 0)
            await new Promise(resolve => setTimeout(resolve, this.config["wait-after-clearing"] * 1000));

        this.omegga.loadBricks(selectedMap);
    }

    checkVoters() {
        return this.voters.length >= this.votesRequired();
    }

    votesRequired() {
        return Math.ceil(this.omegga.getPlayers().length * this.config["percentage-rtv-to-rotate"]);
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

        this.nominations = {}; // <username>: <name of map nominated>
        this.votes = {}; // <username>: <index of map candidate voted for>
        this.voters = [];
        this.voting = false;
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
            if (this.voting) return; // Halt the command if we're already voting

            // Add or remove voters from the voters array
            const existingIndex = this.voters.indexOf(name);
            if (existingIndex == -1) {
                // The user has not voted, add them
                this.voters.push(name);
                if (this.checkVoters()) {
                    this.omegga.broadcast(`<color="#${this.config.color}">${name}</color> has voted to switch the map! Rotating the map...`);
                    await this.rotateMap();
                } else {
                    this.omegga.broadcast(`<color="#${this.config.color}">${name}</color> has voted to switch the map! <color="#${this.config.color}"><b>${this.votesRequired() - this.voters.length} more votes</b> required to switch.</color>`);
                }
            } else {
                // The user has voted, remove them
                this.voters.splice(index, 1);
            }
        });

        this.omegga.on("chatcmd:nominate", async (name, ...args) => {
            if ((!this.config["enable-map-voting"] || !this.config["enable-map-nominations"]) && !this.voting) return;

            const mapName = args.join(" ");

            if (this.saves.includes(mapName)) {
                this.nominations[name] = mapName;
                this.omegga.broadcast(`<color="#${this.config.color}">${name}</color> has nominated the map <color="#${this.config.color}"><b>${mapName}</b></color>!`);
            } else {
                this.omegga.broadcast(`<color="#${this.config.color}"><b>${mapName}</b></color> is not a valid map! Map names are case-sensitive. View all with <code>!maps</code>.`);
            }
        });

        this.omegga.on("chatcmd:vote", async (name, candidateIndex) => {
            if (!this.config["enable-map-voting"] || !this.voting) return;

            if (candidateIndex >= 1 && candidateIndex <= this.votingCandidates.length) {
                this.votes[name] = candidateIndex;
                this.omegga.broadcast(`<color="#${this.config.color}">${name}</color> has voted for <color="${this.config.color}"><b>${this.votingCandidates[candidateIndex - 1]}</b></color>!`);
            } else {
                this.omegga.broadcast(`<color="#${this.config.color}"><b>Invalid map index!</b></color> There are <color="#${this.config.color}">${this.votingCandidates.length} maps</color> to choose from.`);
            }
        });

        this.omegga.on("chatcmd:maps", async (name) => {
            this.omegga.broadcast(`<color="#${this.config.color}">There are <b>${this.saves.length} maps</b> in rotation.</color>`);
            this.omegga.broadcast(this.saves.map(s => `<b>${s}</b>`).join(", "));
        });
    }

    async stop() {
        
    }
}

module.exports = SaveRotator;