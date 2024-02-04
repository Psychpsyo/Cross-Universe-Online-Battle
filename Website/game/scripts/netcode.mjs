import {locale} from "/scripts/locale.mjs";

export let socket = null;
export let youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and player selection, as far as the board is concerned, the local player is always player 1.)

export function zoneToLocal(name) {
	if (name == "undefined") {
		throw new Error("asfasdg");
	}
	let playerIndex = (parseInt(name.substring(name.length - 1)) + 1) % 2;
	name = name.substring(0, name.length - 1);
	return gameState.zones[name + playerIndex];
}

export function connectTo(targetRoomcode, websocketUrl) {
	socket = new WebSocket(websocketUrl);
	socket.addEventListener("open", () => {
		socket.send("[roomcode]" + targetRoomcode);
	});

	socket.addEventListener("message", receiveMessage);
}

let opponentLeft = false;
function makeChatLeaveButton() {
	const holder = document.createElement("div");
	holder.style.setProperty("text-align", "center");
	holder.style.setProperty("padding-bottom", ".35em");
	const button = document.createElement("button");
	button.textContent = locale.game.gameOver.leaveGame;
	button.addEventListener("click", () => {
		window.top.postMessage({type: "leaveGame"});
	});
	holder.appendChild(button);
	return holder;
}

// receiving messages
function receiveMessage(e) {
	const message = e.data.substring(e.data.indexOf("]") + 1);
	const command = e.data.substring(1, e.data.indexOf("]"));

	switch (command) {
		case "chat": { // incoming chat message
			chat.putMessage(players[0].name + locale["chat"]["colon"] + message.substring(0, 10_000));
			break;
		}
		case "distRandValue": {
			game.rng.importCyphertext(message);
			return true;
		}
		case "distRandKey": {
			game.rng.importCypherKey(message);
			return true;
		}
		case "quit": { // opponent force-quit the game or crashed (This is sent by the proxy server and will be different with webRTC in teh future)
			socket.close();
			if (!opponentLeft) {
				chat.putMessage(locale.game.notices.connectionLost, "error", makeChatLeaveButton());
			}
			window.top.postMessage({type: "connectionLost"});
			break;
		}
		case "leave": {
			socket.close();
			opponentLeft = true;
			chat.putMessage(locale.game.notices.opponentLeft, "error", makeChatLeaveButton());
			break;
		}
		case "youAre": { // Indicates if this client is player 0 or 1.
			// TODO: This message is currently just sent by the server for simplicity but who is player 0 or 1 should really be negotiated by the clients in an initial handshake.
			youAre = parseInt(message);
			return true;
		}
		default: {
			if (!gameState?.receiveMessage(command, message)) {
				console.log("Received unknown message:\nCommand: " + command + "\nMessage: " + message);
			}
		}
	}
}