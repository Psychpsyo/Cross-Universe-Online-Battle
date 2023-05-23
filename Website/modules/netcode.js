export let roomcode = "";
export let socket = null;

let cardAreaMirrorTable = {
	"deck0": "deck1",
	"deck1": "deck0",
	"hand0": "hand1",
	"hand1": "hand0",
	"discard0": "discard1",
	"discard1": "discard0",
	"exile0": "exile1",
	"exile1": "exile0",
	"presentedCards0": "presentedCards1",
	"presentedCards1": "presentedCards0",
	"tokens": "tokens",
	"field0": "field19",
	"field1": "field18",
	"field2": "field17",
	"field3": "field16",
	"field4": "field15",
	"field5": "field14",
	"field6": "field13",
	"field7": "field12",
	"field8": "field11",
	"field9": "field10",
	"field10": "field9",
	"field11": "field8",
	"field12": "field7",
	"field13": "field6",
	"field14": "field5",
	"field15": "field4",
	"field16": "field3",
	"field17": "field2",
	"field18": "field1",
	"field19": "field0"
};
export function cardAreaToLocal(cardArea) {
	return cardAreaMirrorTable[cardArea];
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
			if (!opponentName || opponentName == "") {
				putChatMessage(locale["chat"]["opponent"] + locale["chat"]["colon"] + message);
			} else {
				putChatMessage(opponentName + locale["chat"]["colon"] + message);
			}
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