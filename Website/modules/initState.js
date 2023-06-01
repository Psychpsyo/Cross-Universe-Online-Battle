import {locale} from "/modules/locale.js";
import {GameState} from "/modules/gameState.js";
import {DraftState} from "/modules/draftState.js";
import {DeckState} from "/modules/deckState.js";
import {Game} from "/rulesEngine/game.js";
import {stopEffect} from "/modules/levitationEffect.js";
import {socket, connectTo} from "/modules/netcode.js";
import {putChatMessage} from "/modules/generalUI.js";
import * as gameUI from "/modules/gameUI.js";

export class InitState extends GameState {
	constructor(roomcode, gameMode) {
		super();
		
		this.gameMode = gameMode;
		this.opponentReady = false;
		
		connectTo(roomcode + gameMode);
		
		// hide input field and show waiting indicator
		roomCodeInputFieldSpan.setAttribute("hidden", "");
		waitingForOpponentSpan.removeAttribute("hidden");
		// refresh the "Waiting for Opponent" text so screen readers read it out.
		setTimeout(() => {
			if (typeof trWaitingForOpponent !== undefined) {
				trWaitingForOpponent.textContent = locale.mainMenu.waitingForOpponent;
				cancelWaitingBtn.focus();
			}
		}, 100);
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "playerFound": { // another player entered the roomcode (Note: This is sent by the server, not the other client.)
				// send your own username and card back if you have any
				if (localStorage.getItem("username") !== "") {
					socket.send("[username]" + localStorage.getItem("username"));
				}
				document.documentElement.style.setProperty("--p0-card-back", "url('')");
				if (localStorage.getItem("cardBack") !== "") {
					socket.send("[cardBack]" + localStorage.getItem("cardBack"));
				}
				
				game = new Game();
				localPlayer = game.players[1];
				socket.send("[ready]");
				this.checkReadyConditions();
				
				return true;
			}
			case "youAre": { // Indicates if this client is player 0 or 1.
				// TODO: This message is currently just sent by the server for simplicity but who is player 0 or 1 should really be negotiated by the clients in this initial handshake.
				youAre = parseInt(message);
				this.checkReadyConditions();
				return true;
			}
			case "username": {
				opponentName = message;
				return true;
			}
			case "cardBack": {
				if (localStorage.getItem("cardBackToggle") == "false") {
					document.documentElement.style.setProperty("--p0-card-back", "url('" + message + "')");
				}
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
		if (this.opponentReady && youAre !== null) {
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
			
			switch (this.gameMode) {
				case "normal": {
					gameState = new DeckState();
					break;
				}
				case "draft": {
					gameState = new DraftState();
					break;
				}
			}
			gameUI.init();
			
			// make chat functional
			document.getElementById("chatInput").addEventListener("keyup", function(e) {
				if (e.code == "Enter" && this.value != "") {
					socket.send("[chat]" + this.value);
					if (localStorage.getItem("username") !== "") {
						putChatMessage(localStorage.getItem("username") + locale["chat"]["colon"] + this.value);
					} else {
						putChatMessage(locale["chat"]["you"] + locale["chat"]["colon"] + this.value);
					}
					
					this.value = "";
				}
				if (e.code == "Escape") {
					this.blur();
				}
			});
			
			document.getElementById("chatInput").addEventListener("keydown", function(e) {
				e.stopPropagation();
			});
			
			//position the menu on the right if that option is enabled
			if (localStorage.getItem("fieldLeftToggle") == "true") {
				document.documentElement.classList.add("leftField");
			}
			
			// main screen is no longer needed
			stopEffect();
			roomCodeEntry.remove();
			gameDiv.removeAttribute("hidden");
		}
	}
	
	cancel() {
		socket.close();
		waitingForOpponentSpan.setAttribute("hidden", "");
		roomCodeInputFieldSpan.removeAttribute("hidden");
		roomCodeInputField.focus();
		gameState = null;
	}
}