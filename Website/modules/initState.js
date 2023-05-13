import {Gamestate} from "/modules/gameState.js";
import {DraftState} from "/modules/draftState.js";

export class InitState extends Gamestate {
	constructor() {
		super();
		
		this.opponentReady = false;
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
			trWaitingForOpponent.textContent = locale["waitingForOpponent"];
			cancelWaitingBtn.focus();
		}, 100);
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "playerFound": { // another player entered the roomcode
				roomCodeEntry.setAttribute("hidden", "");
				// send your own username and card back if you have any
				if (localStorage.getItem("username") !== "") {
					socket.send("[username]" + localStorage.getItem("username"));
				}
				if (localStorage.getItem("cardBack") !== "") {
					socket.send("[cardBack]" + localStorage.getItem("cardBack"));
				}
				socket.send("[ready]");
				return true;
			}
			case "youAre": { // Indicates if this client is player 0 or 1.
				// TODO: This message is currently just sent by the server for simplicity but who is player 0 or 1 should really be negotiated by the clients in this initial handshake.
				youAre = parseInt(message);
				this.checkReadyConditions();
				return true;
			}
			case "username": {
				window.opponentName = message;
				draftDeckOwner1.textContent = opponentName;
				return true;
			}
			case "cardBack": {
				setCardBackForPlayer(0, message);
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
			updateRoomCodeDisplay();
			gameDiv.removeAttribute("hidden");
			
			switch (gameModeSelect.value) {
				case "normal": {
					mainGameArea.removeAttribute("hidden");
					break;
				}
				case "draft": {
					import("/modules/draftState.js").then(draftModule => {
						gameState = new draftModule.DraftState();
					});
					break;
				}
			}
		}
	}
}