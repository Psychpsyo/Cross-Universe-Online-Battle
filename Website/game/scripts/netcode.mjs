import {locale} from "../../scripts/locale.mjs";

export let youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and player selection, as far as the board is concerned, the local player is always player 1.)

const webRtcConfig = {
	iceServers: [
		{
			urls: "turn:turn.battle.crossuniverse.net:38573",
			username: "bob", // TODO: make signaling server hand out changing credentials
			credential: "12345"
		}
	]
};
let peerConnection = null;
let reliableChannel = null;
let unreliableChannel = null;

export let netConnected = false;

// sends a message to the opponent. If there is no network connected opponent, it silently fails
export async function netSend(message, reliable = true) {
	(reliable? reliableChannel : unreliableChannel)?.send(message);
}

export async function callOpponent(isCaller) {
	youAre = isCaller? 0 : 1;
	// create connection
	peerConnection = new RTCPeerConnection(webRtcConfig);
	peerConnection.addEventListener("icecandidate", e => {
		if (e.candidate) {
			window.parent.postMessage({type: "iceCandidate", candidate: JSON.stringify(e.candidate)});
		}
	});

	// add data channels
	reliableChannel = peerConnection.createDataChannel("reliable data", {negotiated: true, id: 0});
	reliableChannel.addEventListener("message", receiveMessage);
	reliableChannel.addEventListener("close", () => {
		peerConnection.close();
		window.parent.postMessage({type: "connectionLost"});

		if (gameDiv.hidden) {
			// game ended before it even began
			window.parent.postMessage({type: "leaveGame"});
			return;
		}

		if (!opponentLeft) {
			chat.putMessage(locale.game.notices.connectionLost, "error", makeChatLeaveButton());
		}
	});

	unreliableChannel = peerConnection.createDataChannel("unreliable data", {negotiated: true, id: 1, maxRetransmits: 0});
	unreliableChannel.addEventListener("message", receiveMessage);

	// set local description
	if (isCaller) {
		peerConnection.createOffer().then(async offer => {
			await peerConnection.setLocalDescription(offer);
			window.parent.postMessage({type: "sdp", sdp: peerConnection.localDescription.sdp});
		});
	}

	return new Promise(resolve => {
		reliableChannel.addEventListener("open", () => {
			netConnected = true;
			resolve();
		});
	});
}
export function incomingIceCandidate(candidate) {
	peerConnection.addIceCandidate(JSON.parse(candidate));
}
export function incomingSdp(sdp) {
	if (youAre === 0) {
		peerConnection.setRemoteDescription({type: "answer", sdp: sdp});
	} else {
		peerConnection.setRemoteDescription({type: "offer", sdp: sdp});
		peerConnection.createAnswer().then(async answer => {
			await peerConnection.setLocalDescription(answer);
			window.parent.postMessage({type: "sdp", sdp: peerConnection.localDescription.sdp});
		});
	}
}


export function zoneToLocal(name) {
	if (name == "undefined") {
		throw new Error("asfasdg");
	}
	let playerIndex = (parseInt(name.substring(name.length - 1)) + 1) % 2;
	name = name.substring(0, name.length - 1);
	return gameState.zones[name + playerIndex];
}

let opponentLeft = false;
function makeChatLeaveButton() {
	const holder = document.createElement("div");
	holder.style.setProperty("text-align", "center");
	holder.style.setProperty("padding-bottom", ".35em");
	const button = document.createElement("button");
	button.textContent = locale.game.gameOver.leaveGame;
	button.addEventListener("click", () => {
		window.parent.postMessage({type: "leaveGame"});
	});
	holder.appendChild(button);
	return holder;
}

// receiving messages
function receiveMessage(e) {
	const message = e.data.substring(e.data.indexOf("]") + 1);
	const command = e.data.substring(1, e.data.indexOf("]"));

	switch (command) {
		// chat-related things
		case "chat": {
			chat.putMessage(players[0].name + locale["chat"]["colon"] + message.substring(0, 10_000));
			// no break to also clear typing indicator in "stopTyping"
		}
		case "stopTyping": {
			chat.infoBar.innerHTML = "";
			break;
		}
		case "startTyping": {
			chat.infoBar.textContent = locale["chat"]["typingIndicator"].replaceAll("{#NAME}", players[0].name);
			break;
		}
		// Networking for distributedRandom.mjs
		case "distRandValue": {
			game.rng.importCyphertext(message);
			return true;
		}
		case "distRandKey": {
			game.rng.importCypherKey(message);
			return true;
		}
		// opponent left (sad)
		case "leave": {
			peerConnection.close();
			opponentLeft = true;
			chat.putMessage(locale.game.notices.opponentLeft, "error", makeChatLeaveButton());
			break;
		}
		// none of the above, let the current game state handle it
		default: {
			if (!gameState?.receiveMessage(command, message)) {
				console.log("Received unknown message:\nCommand: " + command + "\nMessage: " + message);
			}
		}
	}
}