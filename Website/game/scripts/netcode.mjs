import localize from "../../scripts/locale.mjs";
import {SpectateRandom} from "./spectateRandom.mjs";
import {DistRandom} from "./distributedRandom.mjs";

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

// a connection to someone else (player or spectator)
class Connection {
	constructor(index) {
		this.index = index;
		this.peerConnection = null;
		this.reliableChannel = null;
		this.unreliableChannel = null;
		this.iceBuffer = []; // where ICE candidates go if they arrive before the remote description has been set
		this.hasLeft = false;
	}

	async call(isCaller, onMessage, onClose) {
		// create connection
		this.peerConnection = new RTCPeerConnection(webRtcConfig);
		this.peerConnection.addEventListener("icecandidate", e => {
			if (e.candidate) {
				callingWindow.postMessage({
					type: "iceCandidate",
					candidate: JSON.stringify(e.candidate),
					negotiationIndex: this.index
				});
			}
		});

		// add data channels
		this.reliableChannel = this.peerConnection.createDataChannel("reliable data", {negotiated: true, id: 0});
		const openPromise = new Promise(resolve => {
			this.reliableChannel.addEventListener("open", () => {
				resolve();
			});
		});
		this.reliableChannel.addEventListener("message", e => onMessage?.(e, true));
		this.reliableChannel.addEventListener("close", () => {
			this.peerConnection.close();
			onClose?.();
		});

		this.unreliableChannel = this.peerConnection.createDataChannel("unreliable data", {negotiated: true, id: 1, maxRetransmits: 0});
		this.unreliableChannel.addEventListener("message", e => onMessage?.(e, false));

		// set local description
		if (isCaller) {
			this.peerConnection.createOffer().then(async offer => {
				await this.peerConnection.setLocalDescription(offer);
				callingWindow.postMessage({
					type: "sdp",
					sdp: this.peerConnection.localDescription.sdp,
					negotiationIndex: this.index
				});
			});
		}

		return openPromise;
	}

	send(message, reliable = true) {
		(reliable? this.reliableChannel : this.unreliableChannel)?.send(message);
	}
}

const playerConnections = [];
export const spectators = [];
// holds connections that are currently being negotiated
const openNegotiations = [];

// sends a message to the opponent. If there is no network connected opponent, it silently fails
export function netSend(command, message = "", reliable = true) {
	playerConnections[0]?.send(`[${command}]${message}`, reliable);
	if (localPlayer) {
		sendToSpectators(localPlayer, command, message, reliable);
	}
}

export async function callOpponent(isCaller) {
	youAre = isCaller? 0 : 1;
	const conn = new Connection(openNegotiations.length);
	openNegotiations.push(conn);
	playerConnections.push(conn);
	return conn.call(
		isCaller,
		function(e, wasReliable) {
			playerReceive(e, game.players[0], conn, wasReliable);
		},
		function() {
			callingWindow.postMessage({type: "connectionLost"});
			if (gameDiv.hidden) {
				// game ended before it even began
				callingWindow.postMessage({type: "leaveGame"});
				return;
			}
			if (!conn.hasLeft) {
				chat.putMessage(localize("game.notices.connectionLost", game.players[0]), "error", makeChatLeaveButton());
			}
		}
	)
}
// index is the how manyeth negotiated connection this is
export async function incomingIceCandidate(candidate, index) {
	if (openNegotiations[index].peerConnection.remoteDescription) {
		await openNegotiations[index].peerConnection.addIceCandidate(JSON.parse(candidate));
	} else {
		openNegotiations[index].iceBuffer.push(candidate);
	}
}
// index is the how manyeth negotiated connection this is
export async function incomingSdp(sdp, index) {
	const fromSpectator = index > 0;
	if (fromSpectator) createSpectator(index);

	if (youAre === 0 && !fromSpectator) { // for spectators, which player index we are does not matter, the spectator was always the caller
		await openNegotiations[index].peerConnection.setRemoteDescription({type: "answer", sdp: sdp});
	} else {
		await openNegotiations[index].peerConnection.setRemoteDescription({type: "offer", sdp: sdp});
		openNegotiations[index].peerConnection.createAnswer().then(async answer => {
			await openNegotiations[index].peerConnection.setLocalDescription(answer);
			callingWindow.postMessage({
				type: "sdp",
				sdp: openNegotiations[index].peerConnection.localDescription.sdp,
				negotiationIndex: index
			});
		});
	}
	for (const candidate of openNegotiations[index].iceBuffer) {
		openNegotiations[index].peerConnection.addIceCandidate(JSON.parse(candidate));
	}
}


// UTILITY FUNCTIONS

// Converts a player index, received from another player, to a local one.
// in games with more than two players, player indices are always in the same order, 'clockwise' if you will
// and this offsets the other player's index based on that.
// (player3's player0 is your player2 in a 4-player game, since you are your own player1)
export function netPlayerToLocal(index, fromPlayer) {
	const distance = fromPlayer.index - (localPlayer?.index ?? 1);

	index += distance;
	while (index < 0) {
		index += game.players.length;
	}
	index %= game.players.length;
	return index;
}

// converts a zone name, e.g. "deck0", "exile1"... to an actual zone object, based on the player it came from
export function parseNetZone(name, fromPlayer) {
	let zonePlayerIndex = parseInt(name.substring(name.length - 1));
	name = name.substring(0, name.length - 1);
	zonePlayerIndex = netPlayerToLocal(zonePlayerIndex, fromPlayer);
	return gameState.zones[name + zonePlayerIndex];
}

function makeChatLeaveButton() {
	const holder = document.createElement("div");
	holder.style.setProperty("text-align", "center");
	holder.style.setProperty("padding-bottom", ".35em");
	const button = document.createElement("button");
	button.textContent = localize("game.gameOver.leaveGame");
	button.addEventListener("click", () => {
		callingWindow.postMessage({type: "leaveGame"});
	});
	holder.appendChild(button);
	return holder;
}


// MESSAGE RECEIVING

// from players
function playerReceive(e, player, connection, wasReliable) {
	const command = e.data.substring(1, e.data.indexOf("]"));
	// opponent left (sad)
	if (command === "leave") {
		connection.peerConnection.close();
		connection.hasLeft = true;
		chat.putMessage(localize("game.notices.playerLeft", player), "error", makeChatLeaveButton());
		return;
	}
	// if opponent hasn't left, handle this like a regular player message
	const message = e.data.substring(e.data.indexOf("]") + 1);
	receiveMessage(message, command, player);
	sendToSpectators(player, command, message, wasReliable);
}
function receiveMessage(message, command, player) {
	switch (command) {
		// chat-related things
		case "chat": {
			chat.putMessage(playerData[player.index].name + localize("chat.colon") + message.substring(0, 10_000));
			// no break to also clear typing indicator in "stopTyping"
		}
		case "stopTyping": {
			chat.infoBar.innerHTML = "";
			break;
		}
		case "startTyping": {
			chat.infoBar.textContent = localize("chat.typingIndicator", playerData[player.index].name);
			break;
		}
		// Networking for distributedRandom.mjs
		case "distRandValue": {
			if (!(game.rng instanceof DistRandom)) {
				console.error("Networked player sent unexpected [distRandValue].");
				break;
			}
			game.rng.importCyphertext(message);
			break;
		}
		case "distRandKey": {
			if (!(game.rng instanceof DistRandom)) {
				console.error("Networked player sent unexpected [distRandKey].");
				break;
			}
			game.rng.importCypherKey(message);
			break;
		}
		case "spectateRandomValue": {
			if (!(game.rng instanceof SpectateRandom)) {
				console.error("Networked player sent unexpected [spectateRandomValue].");
				break;
			}
			game.rng.insertValue(message.split("|").map(x => parseInt(x))); // CURandom only ever deals in integers
			break;
		}
		// none of the above, let the current game state handle it
		default: {
			if (!gameState?.receiveMessage(command, message, player)) {
				console.warn(`Received unknown message:\nCommand: ${command}\nMessage: ${message}`);
			}
		}
	}
}


// SPECTATION-SPECIFIC FUNCTIONS
export async function callSpectatee() {
	youAre = 0;
	const conn = new Connection(0);
	openNegotiations[0] = conn;
	return conn.call(
		true,
		function(e) {
			spectateeReceive(e, conn);
		}
	);
}

// receiving messages from spectators
function spectatorReceive(e, connection) {
	console.log("Spectator receive: ", e.data);
}
// commands that should not be sent to spectators as they are only of interest to the other player(s)
const spectatorBannedCommands = ["distRandKey", "distRandValue"];
export function sendToSpectators(fromPlayer, command, message = "", reliable = true) {
	if (spectatorBannedCommands.includes(command)) return;
	const contents = `${fromPlayer.index}[${command}]${message}`;
	for (const spectator of spectators) {
		spectator.send(contents, reliable);
	}
}
// receiving messages from spectatees
function spectateeReceive(e, connection) {
	const playerIndex = e.data.substring(0, e.data.indexOf("["));
	const command = e.data.substring(e.data.indexOf("[")+1, e.data.indexOf("]"));
	// a player left the game
	if (command === "leave") {
		// TODO: Handle this!
		//connection.peerConnection.close();
		//connection.hasLeft = true;
		return;
	}
	// if this wasn't a leave message, go update the game state
	const message = e.data.substring(e.data.indexOf("]") + 1);
	receiveMessage(message, command, game.players[playerIndex]);
}

async function createSpectator(index) {
	const spectator = new Connection(index);
	openNegotiations[index] = spectator;
	await spectator.call(false, function(e) {
		spectatorReceive(e, spectator);
	});
	// sync current game state to spectator
	spectator.send(`${localPlayer.index}[playerData]${JSON.stringify(playerData.map(pd => {
		return {
			name: pd.name,
			profilePicture: pd.profilePicture,
			deck: pd.deck,
			language: pd.language
		};
	}))}`);
	gameState.syncToSpectator(spectator);
	spectators.push(spectator);
}