import {putChatMessage} from "/modules/generalUI.js";
import {locale} from "/modules/locale.js";

export let roomcode = "";
export let socket = null;

export function zoneToLocal(name) {
	if (name == "undefined") {
		throw new Error("asfasdg");
	}
	let playerIndex = (parseInt(name.substr(name.length - 1)) + 1) % 2;
	name = name.substr(0, name.length - 1);
	return gameState.zones[name + playerIndex];
}

export function connectTo(targetRoomcode) {
	roomcode = targetRoomcode;
	socket = new WebSocket("wss://battle.crossuniverse.net:443/ws");
	socket.addEventListener("open", function (event) {
		socket.send("[roomcode]" + roomcode);
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
		case "quit": { // opponent quit the game (or crashed)
			socket.close();
			unloadWarning.abort();
			location.reload();
			break;
		}
		default: {
			if (!gameState?.receiveMessage(command, message)) {
				console.log("Received unknown message:\nCommand: " + command + "\nMessage: " + message);
			}
		}
	}
}