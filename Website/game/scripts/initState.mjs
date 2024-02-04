import * as generalUI from "./generalUI.mjs";
import {DistRandom} from "./distributedRandom.mjs";
import {GameState} from "./gameState.mjs";
import {DraftState} from "./draftState.mjs";
import {DeckState} from "./deckState.mjs";
import {Game} from "/rulesEngine/src/game.mjs";
import {socket, connectTo, youAre} from "./netcode.mjs";

export class InitState extends GameState {
	constructor(roomcode, gameMode, automatic, websocketUrl) {
		super();
		gameState = this;

		this.gameMode = gameMode;
		this.automatic = automatic;
		this.opponentReady = false;

		connectTo(roomcode + gameMode + (automatic? "Automatic" : "Manual"), websocketUrl);
	}

	receiveMessage(command, message) {
		switch (command) {
			case "playerFound": { // another player entered the roomcode (Note: This is sent by the server, not the other client.)
				// send your own username and card back if you have any
				if (localStorage.getItem("username")) {
					socket.send("[username]" + localStorage.getItem("username"));
				}
				if (localStorage.getItem("profilePicture")) {
					socket.send("[profilePicture]" + localStorage.getItem("profilePicture"));
				}
				if (localStorage.getItem("cardBack")) {
					socket.send("[cardBack]" + localStorage.getItem("cardBack"));
				}
				socket.send("[language]" + localStorage.getItem("language"));

				game = new Game();
				game.rng = new DistRandom();
				localPlayer = game.players[1];
				socket.send("[ready]");
				this.checkReadyConditions();

				return true;
			}
			case "username": {
				if (message) {
					players[0].name = message.substring(0, 100);
				}
				return true;
			}
			case "profilePicture": {
				if (/^[USIT]\d{5}$/.test(message)) {
					players[0].profilePicture = message;
				}
				return true;
			}
			case "cardBack": {
				if (localStorage.getItem("cardBackToggle") === "false") {
					document.documentElement.style.setProperty("--p0-card-back", "url('" + message + "')");
				}
				return true;
			}
			case "language": {
				players[0].language = message;
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

	checkReadyConditions() {
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
		window.top.postMessage({type: "gameStarted"});

		// Start game
		switch (this.gameMode) {
			case "normal": {
				new DeckState(this.automatic);
				break;
			}
			case "draft": {
				new DraftState(this.automatic);
				break;
			}
		}
	}
}