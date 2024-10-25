import * as generalUI from "./generalUI.mjs";
import {DistRandom} from "./distributedRandom.mjs";
import {GameState} from "./gameState.mjs";
import {DraftState} from "./draftState.mjs";
import {DeckState} from "./deckState.mjs";
import {Game} from "../../rulesEngine/src/game.mjs";
import {netSend, callOpponent, youAre} from "./netcode.mjs";
import * as localeExtensions from "../../scripts/localeExtensions.mjs";

export class OnlineInitState extends GameState {
	constructor(isCaller, gameMode = "normal", automatic = false, useOldManaRule = false, draftFormat = null) {
		super();

		this.gameMode = gameMode;
		this.automatic = automatic;
		this.draftFormat = draftFormat;
		this.opponentReady = false;

		// set up the game
		game = new Game();
		localeExtensions.extendGame(game);
		localPlayer = game.players[1];
		game.config.useOldManaRule = useOldManaRule;
		game.rng = new DistRandom();

		callOpponent(isCaller).then(async () => {
			// send your own info
			if (localStorage.getItem("username")) {
				netSend("username", localStorage.getItem("username"));
			}
			if (localStorage.getItem("profilePicture")) {
				netSend("profilePicture", localStorage.getItem("profilePicture"));
			}
			if (localStorage.getItem("cardBack")) {
				netSend("cardBack", localStorage.getItem("cardBack"));
			}
			netSend("language", localStorage.getItem("language"));

			netSend("ready");
			this.checkReadyConditions();
		});
	}

	receiveMessage(command, message, player) {
		switch (command) {
			case "username": {
				if (message) {
					playerData[player.index].name = message.substring(0, 100);
				}
				return true;
			}
			case "profilePicture": {
				if (/^[USIT]\d{5}$/.test(message)) {
					playerData[player.index].profilePicture = message;
				}
				return true;
			}
			case "cardBack": {
				if (localStorage.getItem("hideOpponentCardBacks") === "false") {
					document.documentElement.style.setProperty("--p0-card-back", "url('" + message + "')");
				}
				return true;
			}
			case "language": {
				playerData[player.index].language = message;
				return true;
			}
			case "ready": {
				this.opponentReady = true;
				this.checkReadyConditions();
				return true;
			}
		}
		return false;
	}

	async checkReadyConditions() {
		if (!this.opponentReady || youAre === null) return;

		// disable dropping files onto this window once the game starts to it doesn't happen on accident (like when loading a deck)
		document.getElementById("gameDiv").addEventListener("dragover", function(e) {
			e.preventDefault();
		});
		document.getElementById("gameDiv").addEventListener("drop", function(e) {
			e.preventDefault();
		});

		// switch to game view
		generalUI.init();
		gameDiv.hidden = false;
		callingWindow.postMessage({type: "gameStarted"});

		// Start game
		switch (this.gameMode) {
			case "normal": {
				new DeckState(this.automatic);
				break;
			}
			case "draft": {
				new DraftState(
					this.automatic,
					this.draftFormat
				);
				break;
			}
		}
	}
}