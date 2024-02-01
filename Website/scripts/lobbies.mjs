// This file implements pretty much the entire lobby system
//
// Note on the cryptography parts:
// Public keys are initially generated and sent to the host to be passed to other users.
// Since this lets the host perform a man-in-the-middle attack, the keys should ideally be signed beforehand to stop that.
// (probably through some sort of as of yet nonexistant identity provider/account system or similar)
// For now, the rest of the cryptography implementation is here since I wrote a lot of it before noticing this obvious problem.
//
// TODO: Refactor all of this into separate host and client code

import {locale} from "/scripts/locale.mjs";
import {startGame} from "/scripts/gameStarter.mjs";
import "/scripts/profilePicture.mjs";

// lobby template translation
lobbyTemplate.content.querySelector(".lobbyUserIcon").textContent = locale.lobbies.userIconAlt;
userListHeader.textContent = locale.lobbies.players;
lobbyUserTemplate.content.querySelector(".challengeBtn").textContent = locale.lobbies.challenge;
lobbyUserTemplate.content.querySelector(".kickBtn").textContent = locale.lobbies.kick;

const unloadWarning = new AbortController();

class Lobby {
	constructor(name, userLimit, hasPassword, users, ownUserId, ownRsaKeyPair, ownEcdsaKeyPair, password = null) {
		this.name = name;
		this.userLimit = userLimit;
		this.hasPassword = hasPassword;
		this.ownUserId = ownUserId;
		// the RSA keys are for encryption, the ecdsa keys are for signatures
		this.ownRsaKeyPair = ownRsaKeyPair;
		this.ownEcdsaKeyPair = ownEcdsaKeyPair;
		this.ownChatSequenceNum = 0; // used to prevent replay attacks on chat messages
		this.password = password;

		this.users = [];
		for (const user of users) {
			this.addUser(user);
		}

		this.currentlyChallenging = null; // the user that is currently being challenge
		this.currentlyAcceptedChallenger = null;
	}

	addUser(user) {
		this.users.push(user);
		// add to UI
		const userElem = lobbyUserTemplate.content.cloneNode(true);
		userElem.querySelector(".user").id = "userElem" + user.id;
		userElem.querySelector(".username").textContent = user.name;
		if (user.id === this.ownUserId) {
			userElem.querySelector(".userOptions").remove();
		} else {
			userElem.querySelector(".challengeBtn").addEventListener("click", async function() {
				if (currentLobby.currentlyChallenging === user) {
					cancelCurrentChallenge();
					return;
				}
				if (currentLobby.currentlyChallenging) cancelCurrentChallenge();

				currentLobby.currentlyChallenging = user;
				this.textContent = locale.lobbies.cancelChallenge;
				loadingIndicator.classList.add("active");

				const signature = await signString("challenge", `offer|${user.id}`, ++user.lastSentChallengeSequenceNum);
				if (isHosting) {
					getUserConnection(user.id).dataChannel.send(JSON.stringify({
						type: "challenge",
						from: currentLobby.ownUserId,
						signature: signature
					}));
				} else {
					hostDataChannel.send(JSON.stringify({
						type: "challenge",
						to: user.id,
						signature: signature
					}));
				}
			});

			if (!isHosting) { // only host can kick people
				userElem.querySelector(".kickBtn").disabled = true;
			} else {
				userElem.querySelector(".kickBtn").addEventListener("click", () => {
					this.removeUser(user.id);
					const peer = getUserConnection(user.id);
					peer.dataChannel.send('{"type": "kick", "reason": "kicked"}');
					peer.connection.close();
					broadcast(JSON.stringify({
						type: "userKicked",
						id: user.id
					}));
					lobbyChat.putMessage(locale.lobbies.userKicked.replaceAll("{#name}", user.name), "warning");
				});
			}
		}

		userList.appendChild(userElem);
		document.getElementById("userElem" + user.id).querySelector("profile-picture").setIcon(user.profilePicture);
	}
	// removes and returns a user with the given id
	removeUser(id) {
		const index = this.users.findIndex(user => user.id === id);
		if (index === -1) return null;
		document.getElementById("userElem" + id).remove();
		return this.users.splice(index, 1)[0];
	}
}
class User {
	// this sanitizes the incoming data
	constructor(name, profilePicture, id, rsaPublicKey, ecdsaPublicKey, rsaPublicKeyJwk, ecdsaPublicKeyJwk, lastChatSequenceNum = 0) {
		this.id = id;

		// sanitize name
		if (typeof name !== "string" || name.length === 0) {
			name = locale.lobbies.unnamedUser;
		} else {
			name = name.substring(0, 100);
		}
		// sanitize profile picture
		if (!/^[USIT]\d{5}$/.test(profilePicture)) {
			profilePicture = "S00093";
		}

		this.name = name;
		// potentially add number to name to disambiguate between people with the same name
		for (let i = 2; currentLobby && currentLobby.users.find(user => user.name === this.name); i++) {
			this.name = `${name} (${i})`;
		}
		this.profilePicture = profilePicture;
		this.rsaPublicKey = rsaPublicKey;
		this.ecdsaPublicKey = ecdsaPublicKey;

		// needed for toJSON since exporting a key is async
		this.rsaPublicKeyJwk = rsaPublicKeyJwk;
		this.ecdsaPublicKeyJwk = ecdsaPublicKeyJwk;

		// used to prevent replay attacks
		this.lastChatSequenceNum = lastChatSequenceNum;
		this.lastChallengeSequenceNum = 0; // this one is only checked by the client for simplicity and so can start at 0

		// this is for sent challenges
		this.lastSentChallengeSequenceNum = 0;
	}

	toJSON() {
		return {
			id: this.id,
			name: this.name,
			profilePicture: this.profilePicture,
			rsaPublicKey: this.rsaPublicKeyJwk,
			ecdsaPublicKey: this.ecdsaPublicKeyJwk,
			lastChatSequenceNum: this.lastChatSequenceNum
		}
	}
}

let lobbyServerWs;
let currentLobby = null;
let isHosting = false;
const webRtcConfig = {
	"iceServers": [
		{
			"urls": "turn:turn.battle.crossuniverse.net:38573",
			"username": "bob",
			"credential": "12345"
		}
	]
};
let hostConnection = null; // connection to the host when joining a lobby
let hostDataChannel = null; // data channel for communication with the lobby host
let doneHandshake = false; // Whether or not the user already did the handshake for the current lobby. This is to prevent a malicious host from spamming password popups.
const peerConnections = []; // connections to the other users when hosting a lobby
let largestUserId = 0; // largest ID given to a user in the lobby

// utility functions
function clearCurrentlyChallenging() {
	document.getElementById("userElem" + currentLobby.currentlyChallenging.id).querySelector(".challengeBtn").textContent = locale.lobbies.challenge;
	currentLobby.currentlyChallenging = null;
	loadingIndicator.classList.remove("active");
}
async function cancelCurrentChallenge() {
	const user = currentLobby.currentlyChallenging;
	clearCurrentlyChallenging();

	const message = {
		type: "challengeCancelled",
		signature: await signString("challenge", `challengeCancelled|${user.id}`, ++user.lastSentChallengeSequenceNum)
	}

	if (isHosting) {
		message.from = currentLobby.ownUserId;
		getUserConnection(user.id).dataChannel.send(JSON.stringify(message));
	} else {
		message.to = user.id;
		hostDataChannel.send(JSON.stringify(message));
	}
}
async function acceptOrDenyChallenge(fromUser, signature) {
	if (!await verifySignature(signature, "challenge", `offer|${currentLobby.ownUserId}`, ++fromUser.lastChallengeSequenceNum, fromUser)) return;

	const accepted = !currentLobby.currentlyAcceptedChallenger && confirm(locale.lobbies.incomingChallenge.replaceAll("{#name}", fromUser.name));
	const response = {type: accepted? "challengeAccepted" : "challengeDenied"};
	if (accepted) {
		response.roomCode = Math.random().toString();
		currentLobby.currentlyAcceptedChallenger = fromUser;
		// force the default websocket for now. (it will get replaced with webRTC stuff down the line anyways)
		startGame(response.roomCode, "normalAutomatic", "wss://battle.crossuniverse.net:443/ws/");
	}
	response.signature = await signString("challenge", `${response.type}|${fromUser.id}${accepted? "|" + response.roomCode : ""}`, ++fromUser.lastSentChallengeSequenceNum);

	if (isHosting) {
		response.from = currentLobby.ownUserId;
		getUserConnection(fromUser.id).dataChannel.send(JSON.stringify(response));
	} else {
		response.to = fromUser.id;
		hostDataChannel.send(JSON.stringify(response));
	}
}
async function challengeGotAccepted(byUser, signature, roomCode) {
	byUser.lastChallengeSequenceNum++;
	if (!currentLobby.currentlyChallenging || currentLobby.currentlyChallenging.id !== byUser.id) return;
	if (!await verifySignature(signature, "challenge", `challengeAccepted|${currentLobby.ownUserId}|${roomCode}`, byUser.lastChallengeSequenceNum, byUser)) return;
	lobbyChat.putMessage(locale.lobbies.challengeAccepted.replaceAll("{#name}", byUser.name), "success");
	clearCurrentlyChallenging();

	// force the default websocket for now. (it will get replaced with webRTC stuff down the line anyways)
	startGame(roomCode, "normalAutomatic", "wss://battle.crossuniverse.net:443/ws/");
}
async function challengeGotDenied(byUser, signature) {
	byUser.lastChallengeSequenceNum++;
	if (!currentLobby.currentlyChallenging || currentLobby.currentlyChallenging.id !== byUser.id) return;
	if (!await verifySignature(signature, "challenge", `challengeDenied|${currentLobby.ownUserId}`, byUser.lastChallengeSequenceNum, byUser)) return;
	lobbyChat.putMessage(locale.lobbies.challengeDenied.replaceAll("{#name}", byUser.name), "error");
	clearCurrentlyChallenging();
}
async function challengeGotCancelled(byUser, signature) {
	byUser.lastChallengeSequenceNum++;
	if (!currentLobby.currentlyAcceptedChallenger || currentLobby.currentlyAcceptedChallenger.id !== byUser.id) return;
	if (!await verifySignature(signature, "challenge", `challengeCancelled|${currentLobby.ownUserId}`, byUser.lastChallengeSequenceNum, byUser)) return;
	gameFrame.style.visibility = "hidden";
	preGame.style.display = "flex";
	gameFrame.contentWindow.location.replace("about:blank");
	alert(locale.lobbies.challengeCancelled.replaceAll("{#name}", byUser.name));
}
function getUserFromId(id) {
	return currentLobby.users.find(user => user.id === id);
}

// host-specific
function getUserFromDataChannel(dataChannel) {
	const peer = peerConnections.find(peer => peer.dataChannel === dataChannel);
	if (peer.userId) {
		return getUserFromId(peer.userId);
	}
	return null;
}
function getConnectionFromDataChannel(dataChannel) {
	return peerConnections.find(peer => peer.dataChannel === dataChannel);
}
function getUserConnection(userId) {
	return peerConnections.find(peer => peer.userId === userId);
}
function broadcast(message, excludeDataChannel = null) {
	for (const peer of peerConnections) {
		if (peer.dataChannel !== excludeDataChannel) {
			peer.dataChannel.send(message);
		}
	}
}

// leaving lobby as a visitor
function leaveLobby() {
	hostConnection.close();
	closeLobbyScreen();
	hostConnection = null;
	hostDataChannel = null;
	doneHandshake = false;
}
// closing a lobby as the host
function closeLobby() {
	isHosting = false;
	lobbyServerWs.send('{"type": "closeLobby"}');
	for (const peer of peerConnections) {
		peer.dataChannel.send('{"type": "kick", "reason": "closing"}');
		peer.connection.close();
	}
	closeLobbyScreen();
}

// show or hide the actual in-lobby menu
async function openLobbyScreen() {
	await import("./chat.mjs");
	lobbyTitle.textContent = currentLobby.name;
	lobbyChat.clear();

	lobbyHeader.style.display = "flex";

	lobbyMenu.style.display = "flex";
	mainMenu.style.display = "none";
	loadingIndicator.classList.remove("active");

	if (isHosting) {
		// host needs to confirm reloading the page if there is someone else in the lobby
		window.addEventListener("beforeunload", e => {
			if (currentLobby.users.length === 1) return;
			e.preventDefault();
			e.returnValue = "";
		}, {signal: unloadWarning.signal});
	}
}
function closeLobbyScreen() {
	currentLobby = null;
	lobbyMenu.style.display = "none";
	centerRoomCode.disabled = false;
	mainMenu.style.display = "flex";
	lobbyHeader.style.display = "none";
	userList.innerHTML = "";
	unloadWarning.abort();
}

// websocket stuff
function connectWebsocket() {
	lobbyServerWs = new WebSocket(localStorage.getItem("lobbyServerUrl")? localStorage.getItem("lobbyServerUrl") : "wss://battle.crossuniverse.net:443/lobbies/");
	lobbyServerWs.addEventListener("open", function() {
		lobbyList.dataset.message = locale.lobbies.noOpenLobbies;
		newLobbyBtn.addEventListener("click", async () => {
			loadingIndicator.classList.add("active");

			const rsaKeyPair = await generateRsaKeyPair();
			const ecdsaKeyPair = await generateEcdsaKeyPair();

			currentLobby = new Lobby(
				"my cool lobby",
				8,
				false,
				[new User(
					localStorage.getItem("username"),
					localStorage.getItem("profilePicture"),
					0,
					rsaKeyPair.publicKey,
					ecdsaKeyPair.publicKey,
					await crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey),
					await crypto.subtle.exportKey("jwk", ecdsaKeyPair.publicKey)
				)],
				0,
				rsaKeyPair,
				ecdsaKeyPair,
				null
			);
			largestUserId = 0;
			isHosting = true;
			lobbyServerWs.send(JSON.stringify({
				type: "openLobby",
				name: currentLobby.name,
				userCount: currentLobby.users.length,
				userLimit: currentLobby.userLimit,
				hasPassword: currentLobby.hasPassword,
				language: locale.code
			}));
			openLobbyScreen();
		});
		newLobbyBtn.disabled = false;
	});

	lobbyServerWs.addEventListener("open", () => {
		if (isHosting) {
			lobbyServerWs.send(JSON.stringify({
				type: "openLobby",
				name: currentLobby.name,
				userCount: currentLobby.users.length,
				userLimit: currentLobby.userLimit,
				hasPassword: currentLobby.hasPassword,
				language: locale.code
			}));
		}
	});
	lobbyServerWs.addEventListener("message", receiveWsMessage);
	lobbyServerWs.addEventListener("close", () => {
		lobbyList.dataset.message = locale.lobbies.noLobbyServer;
		lobbyList.innerHTML = "";
		newLobbyBtn.disabled = true;
		connectWebsocket();
	});
}
connectWebsocket();

window.addEventListener("unload", () => {
	// TODO: close lobby if hosting
});

function receiveWsMessage(e) {
	const message = JSON.parse(e.data);

	switch (message.type) {
		case "lobbyList": {
			for (const lobby of message.lobbies) {
				displayLobby(lobby);
			}
			break;
		}
		case "lobbyOpened": {
			displayLobby(message.lobby);
			break;
		}
		case "lobbyClosed": {
			document.getElementById("lobbyElem" + message.lobbyId).remove();
			break;
		}
		case "lobbyUserCountChanged": {
			const lobbyElem = document.getElementById("lobbyElem" + message.lobbyId);
			lobbyElem.querySelector(".lobbyUserCount").textContent = message.newCount;
			setConnectButtonEnabled(lobbyElem);
			break;
		}
		case "lobbyUserLimitChanged": {
			const lobbyElem = document.getElementById("lobbyElem" + message.lobbyId);
			lobbyElem.querySelector(".lobbyUserLimit").textContent = message.newLimit;
			setConnectButtonEnabled(lobbyElem);
			break;
		}
		case "lobbyHasPasswordChanged": {
			document.getElementById("lobbyElem" + message.lobbyId).querySelector(".lobbyJoinBtn").textContent = locale.lobbies[message.newHasPassword? "joinPassword" : "join"];
			break;
		}
		case "joinRequest": {
			const pc = new RTCPeerConnection(webRtcConfig);
			const dc = pc.createDataChannel("data", {negotiated: true, id: 0});
			dc.addEventListener("open", () => {
				dc.send(JSON.stringify({
					type: "handshake",
					needsPassword: currentLobby.password? true : false
				}));
			});
			dc.addEventListener("message", receiveWebRtcVisitorMessage);
			dc.addEventListener("close", () => {
				const connection = peerConnections.splice(peerConnections.findIndex(peer => peer.connection === pc), 1)[0];
				// needs to check for isHosting in case the lobby is being shut down
				if (isHosting && connection.userId) {
					lobbyServerWs.send(JSON.stringify({type: "setUserCount", newCount: currentLobby.users.length}));

					// check if the user still exists ( = this disconnect was initiated from their end, unexpectedly)
					const user = currentLobby.removeUser(connection.userId);
					if (!user) return;

					broadcast(JSON.stringify({type: "userLeft", id: user.id}));
					lobbyChat.putMessage(locale.lobbies.userLeft.replaceAll("{#name}", user.name), "notice");
				}
			});

			peerConnections.push({
				connection: pc,
				dataChannel: dc,
				userId: null
			});
			pc.setRemoteDescription({type: "offer", sdp: message.sdp});
			pc.createAnswer().then(async answer => {
				await pc.setLocalDescription(answer);
				lobbyServerWs.send(JSON.stringify({
					"type": "joinLobbyAnswer",
					"sdp": pc.localDescription.sdp // use this instead of answer to have ice candidates included
				}));
			});
			break;
		}
		case "joinRequestAnswer": {
			hostConnection.setRemoteDescription({type: "answer", sdp: message.sdp});
			break;
		}
		case "error": {
			switch(message.code) {
				case "cannotJoinInvalidLobby": {
					alert(locale.lobbies.joinFailedInvalid);
					loadingIndicator.classList.remove("active");
					break;
				}
				case "cannotJoinFullLobby": {
					alert(locale.lobbies.joinFailedUserLimit);
					loadingIndicator.classList.remove("active");
					break;
				}
			}
			break;
		}
	}
}

// webRTC stuff
async function joinLobby(lobbyId) {
	centerRoomCode.disabled = true;
	loadingIndicator.classList.add("active");

	// create connection
	hostConnection = new RTCPeerConnection(webRtcConfig);
	hostConnection.addEventListener("icegatheringstatechange", () => {
		if (hostConnection.iceGatheringState === "complete") {
			lobbyServerWs.send(JSON.stringify({
				"type": "joinLobby",
				"lobbyId": lobbyId,
				"sdp": hostConnection.localDescription.sdp // use this instead of offer to have ice candidates included
			}));
		}
	});

	// add data channel
	hostDataChannel = hostConnection.createDataChannel("data", {negotiated: true, id: 0});
	hostDataChannel.addEventListener("message", receiveWebRtcHostMessage);
	hostDataChannel.addEventListener("close", () => {
		// leave the lobby if we haven't already
		if (hostConnection) leaveLobby();
	});

	// set local description
	await hostConnection.setLocalDescription(await hostConnection.createOffer());
}

// used during connection to a lobby
let tempRsaKeyPair;
let tempEcdsaKeyPair;

// messages that were sent by the host of a lobby
async function receiveWebRtcHostMessage(e) {
	const message = JSON.parse(e.data);

	switch (message.type) {
		case "handshake": {
			if (doneHandshake) break; // prevents the host from spamming the password prompt
			doneHandshake = true;
			let password = null;
			if (message.needsPassword) {
				password = prompt(locale.lobbies.enterPassword);
				if (password === null) {
					leaveLobby();
					break;
				}
			}

			// generate key pairs
			tempRsaKeyPair = await generateRsaKeyPair(); // RSA for encryption
			tempEcdsaKeyPair = await generateEcdsaKeyPair(); // ECDSA for signaures

			this.send(JSON.stringify({
				type: "handshake",
				password: password,
				name: localStorage.getItem("username"),
				profilePicture: localStorage.getItem("profilePicture"),
				rsaPublicKey: await crypto.subtle.exportKey("jwk", tempRsaKeyPair.publicKey),
				ecdsaPublicKey: await crypto.subtle.exportKey("jwk", tempEcdsaKeyPair.publicKey)
			}));
			break;
		}
		case "userLimitReached": {
			leaveLobby();
			alert(locale.lobbies.joinFailedUserLimit);
		}
		case "wrongPassword": {
			leaveLobby();
			alert(locale.lobbies.wrongPassword);
			break;
		}
		case "welcomeIn": {
			try {
				currentLobby = new Lobby(
					message.lobby.name,
					message.lobby.userLimit,
					message.lobby.hasPassword,
					await Promise.all(
						message.lobby.users.map(async user => new User(
							user.name,
							user.profilePicture,
							user.id,
							// I hate that these are async, it is quite annoying.
							await crypto.subtle.importKey("jwk", user.rsaPublicKey, {name: "RSA-OAEP", hash: "SHA-512"}, false, ["encrypt"]),
							await crypto.subtle.importKey("jwk", user.ecdsaPublicKey, {name: "ECDSA", namedCurve: "P-256"}, false, ["verify"]),
							user.rsaPublicKey,
							user.ecdsaPublicKey,
							user.lastChatSequenceNum
						))
					),
					message.youAre,
					tempRsaKeyPair,
					tempEcdsaKeyPair
				)
				openLobbyScreen();
			} catch (error) {
				leaveLobby();
				alert(locale.lobbies.joinFailedError);
				console.error(error);
			} finally {
				tempRsaKeyPair = undefined;
				tempEcdsaKeyPair = undefined;
			}
			break;
		}
		case "kick": {
			leaveLobby();
			setTimeout(() => {
				alert(locale.lobbies.kickMessages[message.reason] ?? locale.lobbies.kickMessages.kicked);
			}, 0);
			break;
		}
		case "chat": {
			const user = getUserFromId(message.userId);
			if (!user || typeof message.message !== "string") break;
			if (!await verifySignature(message.signature, "chat", message.message, ++user.lastChatSequenceNum, user)) break;

			lobbyChat.putMessage(user.name + locale["chat"]["colon"] + message.message.substring(0, 10_000));
			break;
		}
		case "userJoined": {
			const user = new User(
				message.name,
				message.profilePicture,
				message.id,
				message.rsaPublicKey,
				message.ecdsaPublicKey
			);
			currentLobby.addUser(user);
			lobbyChat.putMessage(locale.lobbies.userJoined.replaceAll("{#name}", user.name), "notice");
			break;
		}
		case "userLeft": {
			const user = currentLobby.removeUser(message.id);
			lobbyChat.putMessage(locale.lobbies.userLeft.replaceAll("{#name}", user.name), "notice");
			break;
		}
		case "userKicked": {
			const user = currentLobby.removeUser(message.id);
			lobbyChat.putMessage(locale.lobbies.userKicked.replaceAll("{#name}", user.name), "warning");
			break;
		}
		case "challenge": {
			const user = getUserFromId(message.from);
			if (!user) break;
			acceptOrDenyChallenge(user, message.signature);
			break;
		}
		case "challengeAccepted": {
			const user = getUserFromId(message.from);
			if (!user) break;
			challengeGotAccepted(user, message.signature, message.roomCode);
			break;
		}
		case "challengeDenied": {
			const user = getUserFromId(message.from);
			if (!user) break;
			challengeGotDenied(user, message.signature);
			break;
		}
		case "challengeCancelled": {
			const user = getUserFromId(message.from);
			if (!user) break;
			challengeGotCancelled(user, message.signature);
			break;
		}
	}
}

// messages that were sent by a visitor in your hosted lobby
async function receiveWebRtcVisitorMessage(e) {
	const message = JSON.parse(e.data);

	switch (message.type) {
		case "handshake": {
			const peer = getConnectionFromDataChannel(this);
			if (peer.userId !== null) break; // They already are a user and should not be handshaking anymore
			if (message.password !== currentLobby.password) {
				this.send('{"type": "wrongPassword"}');
				peer.connection.close();
				break;
			}

			if (currentLobby.users.length >= currentLobby.userLimit) {
				this.send('{"type": "userLimitReached"}');
				peer.connection.close();
				break;
			}
			const newUser = new User(
				message.name,
				message.profilePicture,
				++largestUserId,
				await crypto.subtle.importKey("jwk", message.rsaPublicKey, {name: "RSA-OAEP", hash: "SHA-512"}, true, ["encrypt"]),
				await crypto.subtle.importKey("jwk", message.ecdsaPublicKey, {name: "ECDSA", namedCurve: "P-256"}, true, ["verify"]),
				message.rsaPublicKey,
				message.ecdsaPublicKey
			);
			currentLobby.addUser(newUser);
			peer.userId = newUser.id;

			this.send(JSON.stringify({
				type: "welcomeIn",
				lobby: {
					name: currentLobby.name,
					users: currentLobby.users,
					hasPassword: currentLobby.hasPassword,
					userLimit: currentLobby.userLimit
				},
				youAre: newUser.id
			}));
			broadcast(JSON.stringify({
				type: "userJoined",
				name: newUser.name,
				profilePicture: newUser.profilePicture,
				id: newUser.id,
				rsaPublicKey: message.rsaPublicKey,
				ecdsaPublicKey: message.ecdsaPublicKey
			}), this);
			lobbyServerWs.send(JSON.stringify({type: "setUserCount", newCount: currentLobby.users.length}));
			lobbyChat.putMessage(locale.lobbies.userJoined.replaceAll("{#name}", newUser.name), "notice");
			break;
		}
		case "chat": {
			const user = getUserFromDataChannel(this);
			if (!user || typeof message.message !== "string") break;
			if (!await verifySignature(message.signature, "chat", message.message, ++user.lastChatSequenceNum, user)) break;

			message.message = message.message.substring(0, 10_000);
			broadcast(JSON.stringify({
				type: "chat",
				message: message.message,
				userId: user.id,
				signature: message.signature
			}));
			lobbyChat.putMessage(user.name + locale["chat"]["colon"] + message.message);
			break;
		}
		case "challenge": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				acceptOrDenyChallenge(getUserFromDataChannel(this), message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.send(JSON.stringify({
				type: "challenge",
				from: getConnectionFromDataChannel(this).userId
			}));
			break;
		}
		case "challengeAccepted": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				challengeGotAccepted(getUserFromDataChannel(this), message.signature, message.roomCode);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.send(JSON.stringify({
				type: "challengeAccepted",
				from: getConnectionFromDataChannel(this).userId,
				roomCode: message.roomCode,
				signature: message.signature
			}));
			break;
		}
		case "challengeDenied": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				challengeGotDenied(getUserFromDataChannel(this), message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.send(JSON.stringify({
				type: "challengeDenied",
				from: getConnectionFromDataChannel(this).userId,
				signature: message.signature
			}));
			break;
		}
		case "challengeCancelled": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				challengeGotCancelled(getUserFromDataChannel(this), message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.send(JSON.stringify({
				type: "challengeCancelled",
				from: getConnectionFromDataChannel(this).userId,
				signature: message.signature
			}));
			break;
		}
	}
}

// lobby display
function setConnectButtonEnabled(lobbyElem) {
	lobbyElem.querySelector(".lobbyJoinBtn").disabled = lobbyElem.querySelector(".lobbyUserCount").textContent >= lobbyElem.querySelector(".lobbyUserLimit").textContent;
}
function displayLobby(lobby) {
	const lobbyElem = lobbyTemplate.content.cloneNode(true);
	lobbyElem.querySelector(".lobby").id = "lobbyElem" + lobby.id;
	lobbyElem.querySelector(".lobbyName").textContent = lobby.name;
	lobbyElem.querySelector(".lobbyLanguage").textContent = lobby.language.toUpperCase();
	lobbyElem.querySelector(".lobbyUserCount").textContent = lobby.userCount;
	lobbyElem.querySelector(".lobbyUserLimit").textContent = lobby.userLimit;
	const joinBtn = lobbyElem.querySelector(".lobbyJoinBtn");
	joinBtn.textContent = locale.lobbies[lobby.hasPassword? "joinPassword" : "join"];
	joinBtn.addEventListener("click", lobbyJoinBtnPressed);
	setConnectButtonEnabled(lobbyElem);

	lobbyList.appendChild(lobbyElem);
}
function lobbyJoinBtnPressed() {
	joinLobby(parseInt(this.closest(".lobby").id.substring(9)));
}

leaveLobbyButton.addEventListener("click", function() {
	if (isHosting) {
		if (currentLobby.users.length === 1 || confirm(locale.lobbies.hostCloseConfirmation)) {
			closeLobby();
		}
	} else {
		leaveLobby();
	}
});

lobbyChat.addEventListener("message", async function(e) {
	const signature = await signString("chat", e.data, ++currentLobby.ownChatSequenceNum);
	if (isHosting) {
		broadcast(JSON.stringify({
			type: "chat",
			message: e.data,
			userId: currentLobby.ownUserId,
			signature: signature
		}));
		lobbyChat.putMessage(getUserFromId(currentLobby.ownUserId).name + locale["chat"]["colon"] + e.data);
	} else {
		hostDataChannel.send(JSON.stringify({
			type: "chat",
			message: e.data,
			signature: signature
		}));
	}
});

// crypto helper stuff
async function generateRsaKeyPair() {
	return crypto.subtle.generateKey(
		{
			name: "RSA-OAEP",
			modulusLength: 4096,
			publicExponent: new Uint8Array([1,0,1]),
			hash: "SHA-512"
		},
		true,
		["encrypt", "decrypt"]
	);
}
async function generateEcdsaKeyPair() {
	return crypto.subtle.generateKey(
		{
			name: "ECDSA",
			namedCurve: "P-256"
		},
		true,
		["sign", "verify"]
	);
}
// the purpose in the following two function makes sure that different types of messages, with different sequence counters are never interchangeable
async function signString(purpose, toSign, sequenceNumber) {
	return u8tos(new Uint8Array(
		await crypto.subtle.sign(
			{name: "ECDSA", hash: "SHA-256"},
			currentLobby.ownEcdsaKeyPair.privateKey,
			new TextEncoder().encode(`${purpose}|${sequenceNumber}|${toSign}`)
		)
	));
}
async function verifySignature(signature, purpose, signedString, sequenceNumber, user) {
	return crypto.subtle.verify(
		{name: "ECDSA", hash: "SHA-256"},
		user.ecdsaPublicKey,
		stou8(signature),
		new TextEncoder().encode(`${purpose}|${sequenceNumber}|${signedString}`))
}

// Uint8Array <=> String conversion
function stou8(string) {
	return new Uint8Array(string.split("").map(char => char.charCodeAt(0)));
}
function u8tos(array) {
	return String.fromCharCode.apply(null, array);
}