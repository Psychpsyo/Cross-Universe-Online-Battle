import {putChatMessage} from "./generalUI.mjs";
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

// receiving messages
function receiveMessage(e) {
	let message = e.data;
	let command = message.substring(1, message.indexOf("]"));
	message = message.substring(message.indexOf("]") + 1);

	switch (command) {
		case "chat": { // incoming chat message
			putChatMessage(players[0].name + locale["chat"]["colon"] + message);
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
		case "quit": { // opponent quit the game (or crashed)
			socket.close();
			window.top.postMessage({type: "connectionLost"});
			break;
		}
		case "youAre": { // Indicates if this client is player 0 or 1.
			// TODO: This message is currently just sent by the server for simplicity but who is player 0 or 1 should really be negotiated by the clients in this initial handshake.
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