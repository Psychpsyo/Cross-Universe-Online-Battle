import {GameState} from "/modules/gameState.js";
import {DraftState} from "/modules/draftState.js";
import {DeckState} from "/modules/deckState.js";
import {Game} from "/modules/game.js";
import {Card} from "/modules/card.js";
import {stopEffect} from "/modules/levitationEffect.js";

export class InitState extends GameState {
	constructor() {
		super();
		
		this.opponentReady = false;
		
		// set up socket
		socket = new WebSocket("wss://battle.crossuniverse.net:443/ws");
		socket.addEventListener("open", function (event) {
			socket.send("[roomcode]" + roomcode + gameModeSelect.value);
		});
		
		socket.addEventListener("message", receiveMessage);
		
		// hide input field and show waiting indicator
		roomCodeInputFieldSpan.setAttribute("hidden", "");
		waitingForOpponentSpan.removeAttribute("hidden");
		// refresh the "Waiting for Opponent" text so screen readers read it out.
		setTimeout(() => {
			if (typeof trWaitingForOpponent !== undefined) {
				trWaitingForOpponent.textContent = locale["waitingForOpponent"];
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
				
				this.initGame().then(() => {
					socket.send("[ready]");
					this.checkReadyConditions();
				});
				
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
	
	async initGame() {
		game = new Game();
		localPlayer = game.players[1];
		return fetch("https://crossuniverse.net/cardInfo", {
			method: "POST",
			body: JSON.stringify({
				"cardTypes": ["token"],
				"language": localStorage.getItem("language")
			})
		})
		.then(response => response.json())
		.then(response => {
			response.forEach(card => {
				card.imageSrc = getCardImageFromID(card.cardID);
				game.cardData[card.cardID] = card;
				cardAreas["tokens"].cards.push(new Card(game, card.cardID));
			});
			this.gameSetup = true;
		});
	}
	
	checkReadyConditions() {
		if (this.opponentReady && this.gameSetup && youAre !== null) {
			updateRoomCodeDisplay();
			
			// disable dropping files onto this window once the game starts to it doesn't happen on accident (like when loading a deck)
			document.getElementById("gameDiv").addEventListener("dragover", function(e) {
				e.preventDefault();
			});
			document.getElementById("gameDiv").addEventListener("drop", function(e) {
				e.preventDefault();
			});
			
			switch (gameModeSelect.value) {
				case "normal": {
					gameState = new DeckState();
					break;
				}
				case "draft": {
					gameState = new DraftState();
					break;
				}
			}
			
			// main screen is no longer needed
			stopEffect();
			roomCodeEntry.remove();
			gameDiv.removeAttribute("hidden");
		}
	}
}