import * as generalUI from "/modules/generalUI.js";
import {DistRandom} from "/modules/distributedRandom.js";
import {GameState} from "/modules/gameState.js";
import {DraftState} from "/modules/draftState.js";
import {DeckState} from "/modules/deckState.js";
import {Game} from "/rulesEngine/game.js";
import {stopEffect} from "/modules/levitationEffect.js";
import {socket, connectTo, youAre} from "/modules/netcode.js";

export class InitState extends GameState {
	constructor(roomcode, gameMode, websocketUrl) {
		super();
		gameState = this;

		this.gameMode = gameMode;
		this.opponentReady = false;

		connectTo(roomcode + gameMode, websocketUrl );
	}

	receiveMessage(command, message) {
		switch (command) {
			case "playerFound": { // another player entered the roomcode (Note: This is sent by the server, not the other client.)
				// send your own username and card back if you have any
				if (localStorage.getItem("username") !== "") {
					socket.send("[username]" + localStorage.getItem("username"));
				}
				if (localStorage.getItem("profilePicture") !== "") {
					socket.send("[profilePicture]" + localStorage.getItem("profilePicture"));
				}
				if (localStorage.getItem("cardBack") !== "") {
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
				players[0].name = message;
				return true;
			}
			case "profilePicture": {
				if (message.match(/^[USIT]\d{5}$/)) {
					players[0].profilePicture = message;
				}
				return true;
			}
			case "cardBack": {
				if (localStorage.getItem("cardBackToggle") == "false") {
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

		// prevent user from accidently leaving the site
		window.unloadWarning = new AbortController();
		window.addEventListener("beforeunload", function(e) {
			if (lifeDisplay0.textContent > 0 && lifeDisplay1.textContent > 0) {
				e.preventDefault();
				e.returnValue = "";
			}
		}, {"signal": unloadWarning.signal});

		// switch to game view
		stopEffect();
		roomCodeEntry.remove();
		generalUI.init();
		gameDiv.hidden = false;

		// Start game
		switch (this.gameMode) {
			case "normal": {
				new DeckState(false);
				break;
			}
			case "draft": {
				new DraftState(false);
				break;
			}
			case "normalAutomatic": {
				new DeckState(true);
				break;
			}
			case "draftAutomatic": {
				new DraftState(true);
				break;
			}
		}
	}

	cancel() {
		socket.close();
		waitingForOpponentHolder.hidden = true;
		roomCodeInputFieldHolder.hidden = false;
		roomCodeInputField.focus();
		gameState = null;
	}
}