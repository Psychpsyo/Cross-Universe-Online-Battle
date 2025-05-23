// This file implements pretty much the entire lobby system
//
// Note on the cryptography parts:
// Public keys are initially generated and sent to the host to be passed to other users.
// Since this lets the host perform a man-in-the-middle attack, the keys should ideally be signed beforehand to stop that.
// (probably through some sort of as of yet nonexistant identity provider/account system or similar)
// For now, the rest of the cryptography implementation is here since I wrote a lot of it before noticing this obvious problem.
//
// This is kind-of a big mess and stands to be re-organized at some point

import {locale} from "./locale.mjs";
import {startGame, spectate, gameFrameReady} from "./gameStarter.mjs";
import "./profilePicture.mjs";

const unloadWarning = new AbortController();
const settingsList = ["name", "userLimit", "hasPassword", "password", "gameMode", "draftFormat", "automatic", "oldManaRule"];
const settingsTypes = {
	name: "string",
	userLimit: "number",
	hasPassword: "boolean",
	password: "string",
	gameMode: "string",
	draftFormat: "string",
	automatic: "boolean",
	oldManaRule: "boolean"
}
const settingsLimits = {
	name: {maxLength: 100, stripWhitespace: true},
	userLimit: {min: 1, max: 1000},
	password: {maxLength: 100},
	gameMode: {options: ["normal", "draft"]},
	draftFormat: {options: ["beginner", "mayhem", "og137"]}
}
const possibleStatuses = ["present", "afk", "busy", "inGame", "spectating"];

// lobby translation
lobbyTemplate.content.querySelector(".lobbyUserIcon").textContent = locale.lobbies.userIconAlt;
userListHeader.textContent = locale.lobbies.players;
lobbyUserTemplate.content.querySelector(".challengeBtn").textContent = locale.lobbies.challenge;
lobbyUserTemplate.content.querySelector(".spectateBtn").textContent = locale.lobbies.spectate;
lobbyUserTemplate.content.querySelector(".kickBtn").textContent = locale.lobbies.kick;
for (const option of lobbyUserTemplate.content.querySelector(".statusSelect").children) {
	option.textContent = locale.lobbies.status[option.value];
}

lobbySettingsHeader.textContent = locale.lobbies.settings.title;
for (const setting of settingsList) {
	getSettingLabel(setting).textContent = locale.lobbies.settings[setting];
	// while we're looping, might as well attach the event listeners
	getSettingInput(setting).addEventListener("change",
	settingsTypes[setting] === "boolean"?
		function() {currentLobby.setSetting(setting, this.checked)} :
		function() {currentLobby.setSetting(setting, this.value)}
	);
}
lobbyNameInput.placeholder = locale.lobbies.settings.namePlaceholder;
lobbyAutomatic.title = locale.lobbies.settings.automaticTitle;
lobbyGameModeNormal.textContent = locale.lobbies.settings.gameModes.normal;
lobbyGameModeDraft.textContent = locale.lobbies.settings.gameModes.draft;
lobbyDraftFormatBeginner.textContent = locale.draftFormats.beginner;
lobbyDraftFormatMayhem.textContent = locale.draftFormats.mayhem;
lobbyDraftFormatOG.textContent = locale.draftFormats.og137;
lobbyOldManaRule.title = locale.lobbies.settings.oldManaRuleTitle;

// settings helper functions
function sanitizeSettingsValue(setting, value) {
	switch (settingsTypes[setting]) {
		case "number": {
			return Math.min(Math.max(value, settingsLimits[setting].min), settingsLimits[setting].max);
		}
		case "boolean": {
			return value;
		}
		case "string": {
			if ("options" in settingsLimits[setting]) {
				return settingsLimits[setting].options.includes(value)? value : settingsLimits[setting].options[0];
			}
			if (settingsLimits[setting].stripWhitespace) {
				value = value.trim();
			}
			return value.substring(0, settingsLimits[setting].maxLength);
		}
	}
	throw new Error("Failed to sanitize lobby settings input:", setting, value);
}
function getSettingInput(setting) {
	return document.getElementById(`lobby${setting[0].toUpperCase() + setting.substring(1)}Input`);
}
function getSettingLabel(setting) {
	return document.getElementById(`lobby${setting[0].toUpperCase() + setting.substring(1)}Label`);
}

class Lobby {
	#ownPublicSequenceNum = 0; // used to prevent replay attacks on chat messages
	constructor(name, userLimit, hasPassword, password, gameMode, draftFormat, automatic, oldManaRule, users, ownUserId, ownRsaKeyPair, ownEcdsaKeyPair) {
		this.setSetting("name", name);
		this.setSetting("userLimit", userLimit);
		this.setSetting("hasPassword", hasPassword);
		this.setSetting("password", password);
		this.setSetting("gameMode", gameMode);
		this.setSetting("draftFormat", draftFormat);
		this.setSetting("automatic", automatic);
		this.setSetting("oldManaRule", oldManaRule);
		this.ownUserId = ownUserId;
		// the RSA keys are for encryption, the ecdsa keys are for signatures
		this.ownRsaKeyPair = ownRsaKeyPair;
		this.ownEcdsaKeyPair = ownEcdsaKeyPair;

		this.users = [];
		for (const user of users) {
			this.addUser(user);
		}
		this.largestUserId = 0; // largest ID given to a user in this lobby (host only, so it can just start at 0)

		this.currentlyChallenging = null; // the user that is currently being challenge
		this.connectedTo = null; // the player that is currently being played against or spectated
	}

	set ownPublicSequenceNum(newValue) {
		this.#ownPublicSequenceNum = newValue;
		if (isHosting) {
			getUserFromId(this.ownUserId).lastPublicSequenceNum = this.#ownPublicSequenceNum;
		}
	}
	get ownPublicSequenceNum() {
		return this.#ownPublicSequenceNum;
	}

	addUser(user) {
		this.users.push(user);
		// add to UI
		const userElem = lobbyUserTemplate.content.cloneNode(true);
		userElem.querySelector(".user").id = "userElem" + user.id;
		const nameElem = userElem.querySelector(".username");
		nameElem.textContent = user.name;
		if (user.placeholderName) {
			nameElem.classList.add("textPlaceholder");
		}
		const statusElem = userElem.querySelector(".userStatusText");
		statusElem.textContent = locale.lobbies.status[user.status];
		statusElem.classList.add(user.status + "Status");
		if (user.id === this.ownUserId) {
			userElem.querySelector(".otherUserOptions").remove();
			userElem.querySelector(".statusSelect").addEventListener("change", async function() {
				if (this.value !== "setStatus" && this.value !== user.status) {
					syncNewStatus(this.value);
				}
				this.value = "setStatus";
			});
		} else {
			userElem.querySelector(".localUserOptions").remove();
			userElem.querySelector(".challengeBtn").addEventListener("click", async function() {
				if (currentLobby.currentlyChallenging === user) {
					cancelCurrentChallenge();
					return;
				}
				if (currentLobby.currentlyChallenging) cancelCurrentChallenge();

				currentLobby.currentlyChallenging = user;
				this.textContent = locale.lobbies.cancelChallenge;
				loadingIndicator.classList.add("active");

				const signature = await signString("personal", `offer|${user.id}`, ++user.lastSentChallengeSequenceNum);
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

			userElem.querySelector(".spectateBtn").addEventListener("click", async function() {
				// inform other users of unavailability
				if (currentLobby.currentlyChallenging) cancelCurrentChallenge();
				syncNewStatus("spectating");

				// start spectating
				loadingIndicator.classList.add("active");

				currentLobby.connectedTo = user;
				user.negotiationIndex = 0;
				await spectate();
				if (currentLobby) { // check if the lobby hasn't shut down since
					currentLobby.connectedTo = null;
					syncNewStatus("present");
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
		document.getElementById("userElem" + user.id).querySelector("profile-picture").setIcon(user.profilePicture, false);
	}
	// removes and returns a user with the given id
	removeUser(id) {
		const index = this.users.findIndex(user => user.id === id);
		if (index === -1) return null;
		document.getElementById("userElem" + id).remove();
		return this.users.splice(index, 1)[0];
	}

	setSetting(name, value) {
		value = sanitizeSettingsValue(name, value);
		this[name] = value;
		getSettingInput(name)[settingsTypes[name] === "boolean"? "checked" : "value"] = value;
		switch (name) {
			case "name": {
				lobbyTitle.textContent = value? value : locale.lobbies.settings.namePlaceholder;
				break;
			}
			case "hasPassword": {
				lobbyPasswordInput.disabled = !value;
				break;
			}
			case "gameMode": {
				lobbyDraftFormat.style.display = value === "draft"? "flex" : "none";
				break;
			}
			case "automatic": {
				lobbyOldManaRule.style.display = value? "flex" : "none";
				break;
			}
		}
		if (isHosting) {
			broadcast(JSON.stringify({
				type: "settingUpdated",
				name: name,
				value: name === "password"? "*".repeat(value.length) : value
			}));
			if (lobbyServerWs.readyState === 1 && ["name", "userLimit", "hasPassword"].includes(name)) {
				lobbyServerWs.send(JSON.stringify({
					type: `set${name[0].toUpperCase()}${name.substring(1)}`,
					newValue: value
				}));
			}
		}
	}
}
class User {
	// this sanitizes the incoming data
	constructor(name, profilePicture, id, rsaPublicKey, ecdsaPublicKey, rsaPublicKeyJwk, ecdsaPublicKeyJwk, status = "present", lastPublicSequenceNum = 0) {
		this.id = id;

		// sanitize name
		if (typeof name !== "string" || name.length === 0) {
			this.placeholderName = true;
			name = locale.lobbies.unnamedUser;
		} else {
			this.placeholderName = false;
			name = name.substring(0, 100);
		}
		// sanitize profile picture
		if (!/^[USIT]\d{5}$/.test(profilePicture)) {
			profilePicture = "S00093";
		}

		this.name = name;
		// potentially add number to name to disambiguate between people with the same name
		for (let i = 2; currentLobby && currentLobby.users.some(user => user.name === this.name); i++) {
			this.name = `${name} (${i})`;
		}
		this.profilePicture = profilePicture;
		this.status = status;

		this.rsaPublicKey = rsaPublicKey;
		this.ecdsaPublicKey = ecdsaPublicKey;

		// needed for toJSON since exporting a key is async
		this.rsaPublicKeyJwk = rsaPublicKeyJwk;
		this.ecdsaPublicKeyJwk = ecdsaPublicKeyJwk;

		this.hasSentChallenge = false; // whether or not this user has sent us a challenge

		// used to prevent replay attacks
		this.lastPublicSequenceNum = lastPublicSequenceNum;
		this.lastPersonalSequenceNum = 0; // this one is only checked by the client for simplicity and so can start at 0

		// this is for sent challenges
		this.lastSentChallengeSequenceNum = 0;

		// for passing into the iframe (will be changed for spectators)
		this.negotiationIndex = -1;
	}

	setStatus(newStatus) {
		const statusElem = document.getElementById("userElem" + this.id).querySelector(".userStatusText");
		statusElem.classList.remove(this.status + "Status");
		this.status = newStatus;
		statusElem.textContent = locale.lobbies.status[this.status];
		statusElem.classList.add(this.status + "Status");
	}

	toJSON() {
		return {
			id: this.id,
			name: this.name,
			profilePicture: this.profilePicture,
			rsaPublicKey: this.rsaPublicKeyJwk,
			ecdsaPublicKey: this.ecdsaPublicKeyJwk,
			status: this.status,
			lastPublicSequenceNum: this.lastPublicSequenceNum
		}
	}
}

let lobbyServerWs;
let currentLobby = null;
let isHosting = false;
const webRtcConfig = {
	iceServers: [
		{
			urls: "turn:turn.battle.crossuniverse.net:38573",
			username: "bob", // TODO: make signaling server hand out changing credentials
			credential: "12345"
		}
	]
};
let hostConnection = null; // connection to the host when joining a lobby
let hostDataChannel = null; // data channel for communication with the lobby host
let doneHandshake = false; // Whether or not the user already did the handshake for the current lobby. This is to prevent a malicious host from spamming password popups.
const peerConnections = []; // connections to the other users when hosting a lobby

// increased with each spectator in a game the local user is playing, resets to 1 on a new game
let spectationNegotiationCounter = 1;

// utility functions
async function syncNewStatus(status) {
	const signature = await signString("public", `status|${status}`, ++currentLobby.ownPublicSequenceNum);
	if (isHosting) {
		broadcast(JSON.stringify({
			type: "userStatus",
			status: status,
			userId: currentLobby.ownUserId,
			signature: signature
		}));
		getUserFromId(currentLobby.ownUserId).setStatus(status);
	} else {
		hostDataChannel.send(JSON.stringify({
			type: "setStatus",
			status: status,
			signature: signature
		}));
	}
}
function clearCurrentlyChallenging() {
	loadingIndicator.classList.remove("active");
	if (currentLobby.users.includes(currentLobby.currentlyChallenging)) { // check in case they left
		document.getElementById("userElem" + currentLobby.currentlyChallenging.id).querySelector(".challengeBtn").textContent = locale.lobbies.challenge;
		currentLobby.currentlyChallenging = null;
	}
}
async function cancelCurrentChallenge() {
	const user = currentLobby.currentlyChallenging;
	clearCurrentlyChallenging();

	const message = {
		type: "challengeCancelled",
		signature: await signString("personal", `challengeCancelled|${user.id}`, ++user.lastSentChallengeSequenceNum)
	}

	if (isHosting) {
		message.from = currentLobby.ownUserId;
		getUserConnection(user.id).dataChannel.send(JSON.stringify(message));
	} else {
		message.to = user.id;
		hostDataChannel.send(JSON.stringify(message));
	}
}
async function presentChallengeInChat(fromUser, signature) {
	if (!await verifySignature(signature, "personal", `offer|${currentLobby.ownUserId}`, ++fromUser.lastPersonalSequenceNum, fromUser)) return;
	// auto-deny challenges while in-game and repeat challenges
	if (currentLobby.connectedTo || fromUser.hasSentChallenge) {
		acceptOrDenyChallenge(fromUser, false);
		return;
	}
	fromUser.hasSentChallenge = true;

	const chatInsert = document.createElement("fieldset");
	chatInsert.id = "challengeElem" + fromUser.id;
	chatInsert.classList.add("challengePrompt");
	const acceptBtn = document.createElement("button");
	const denyBtn = document.createElement("button");
	acceptBtn.textContent = locale.lobbies.acceptChallenge;
	denyBtn.textContent = locale.lobbies.denyChallenge;
	acceptBtn.addEventListener("click", function() {
		resolveAnyChatChallenge(fromUser.id, locale.lobbies.challengeAccepted);
		acceptOrDenyChallenge(fromUser, true);
	});
	denyBtn.addEventListener("click", function() {
		resolveAnyChatChallenge(fromUser.id, locale.lobbies.challengeDenied);
		acceptOrDenyChallenge(fromUser, false);
	});
	chatInsert.appendChild(acceptBtn);
	chatInsert.appendChild(denyBtn);

	lobbyChat.putMessage(locale.lobbies.incomingChallenge.replaceAll("{#name}", fromUser.name), "notice", chatInsert);
}
function resolveAnyChatChallenge(userId, resolutionString) {
	const lobbyElem = document.getElementById("challengeElem" + userId);
	if (lobbyElem) {
		lobbyElem.removeAttribute("id");
		lobbyElem.dataset.resolvedText = resolutionString;
		lobbyElem.disabled = true;
	}
}

window.addEventListener("message", async e => {
	if (e.source !== gameFrame.contentWindow) return;
	if (!currentLobby?.connectedTo) return; // if not playing against anyone, there is no lobby-based signalling
	if (!["sdp", "iceCandidate"].includes(e.data.type)) return;

	const targetUser = currentLobby.users.find(user => user.negotiationIndex === e.data.negotiationIndex);
	const message = {};
	switch (e.data.type) {
		case "sdp": {
			message.type = "sdp";
			message.sdp = e.data.sdp;
			// TODO: encrypt sdp something like this.
			// Below code does not work because RSA-OAEP has
			// a maximum size for the data to encrypt.
			//
			//sdp: u8tos(await crypto.subtle.encrypt(
			//	{name: "RSA-OAEP"},
			//	targetUser.rsaPublicKey,
			//	stou8(e.data.sdp)
			//))
			message.signature = await signString("personal", `sdp|${targetUser.id}|${message.sdp}`, ++targetUser.lastSentChallengeSequenceNum);
			break;
		}
		case "iceCandidate": {
			message.type = "iceCandidate";
			message.candidate = e.data.candidate;
			// TODO: encrypt candidate like sdp above
			message.signature = await signString("personal", `ice|${targetUser.id}|${message.candidate}`, ++targetUser.lastSentChallengeSequenceNum);
			break;
		}
	}

	if (isHosting) {
		message.from = currentLobby.ownUserId;
		getUserConnection(targetUser.id).dataChannel.send(JSON.stringify(message));
	} else {
		message.to = targetUser.id;
		hostDataChannel.send(JSON.stringify(message));
	}
});

async function acceptOrDenyChallenge(fromUser, accepted) {
	fromUser.hasSentChallenge = false;
	const response = {type: accepted? "challengeAccepted" : "challengeDenied"};
	if (accepted) {
		currentLobby.connectedTo = fromUser;
		fromUser.negotiationIndex = 0;
		doGame(true).then(() => {
			fromUser.negotiationIndex = -1;
		})
	}
	response.signature = await signString("personal", `${response.type}|${fromUser.id}`, ++fromUser.lastSentChallengeSequenceNum);

	if (isHosting) {
		response.from = currentLobby.ownUserId;
		getUserConnection(fromUser.id).dataChannel.send(JSON.stringify(response));
	} else {
		response.to = fromUser.id;
		hostDataChannel.send(JSON.stringify(response));
	}
}
async function challengeGotAccepted(byUser, signature) {
	byUser.lastPersonalSequenceNum++;
	if (!currentLobby.currentlyChallenging || currentLobby.currentlyChallenging.id !== byUser.id) return;
	if (!await verifySignature(signature, "personal", `challengeAccepted|${currentLobby.ownUserId}`, byUser.lastPersonalSequenceNum, byUser)) return;
	lobbyChat.putMessage(locale.lobbies.challengeAcceptedMessage.replaceAll("{#name}", byUser.name), "success");
	clearCurrentlyChallenging();
	currentLobby.connectedTo = byUser;
	byUser.negotiationIndex = 0;
	await doGame(false);
	byUser.negotiationIndex = -1;
}
async function doGame(isCaller) {
	syncNewStatus("inGame");
	const gameOptions = {
		gameMode: currentLobby.gameMode,
		automatic: currentLobby.automatic,
		useOldManaRule: currentLobby.oldManaRule
	}
	if (currentLobby.gameMode === "draft") {
		gameOptions.draftFormat = await (await fetch(`./data/draftFormats/${lobbyDraftFormatInput.value}.json`)).json();
	}
	await startGame(isCaller, gameOptions);
	if (currentLobby) { // check if the lobby hasn't shut down since
		currentLobby.connectedTo = null;
		spectationNegotiationCounter = 1;
		syncNewStatus("present");
	}
}
async function challengeGotDenied(byUser, signature) {
	byUser.lastPersonalSequenceNum++;
	if (!currentLobby.currentlyChallenging || currentLobby.currentlyChallenging.id !== byUser.id) return;
	if (!await verifySignature(signature, "personal", `challengeDenied|${currentLobby.ownUserId}`, byUser.lastPersonalSequenceNum, byUser)) return;
	lobbyChat.putMessage(locale.lobbies.challengeDeniedMessage.replaceAll("{#name}", byUser.name), "error");
	clearCurrentlyChallenging();
}
async function challengeGotCancelled(byUser, signature) {
	byUser.lastPersonalSequenceNum++;
	if (!await verifySignature(signature, "personal", `challengeCancelled|${currentLobby.ownUserId}`, byUser.lastPersonalSequenceNum, byUser)) return;
	byUser.hasSentChallenge = false;
	if (currentLobby.connectedTo && currentLobby.connectedTo.id === byUser.id) {
		gameFrame.style.visibility = "hidden";
		preGame.style.display = "flex";
		gameFrame.contentWindow.location.replace("about:blank");
		alert(locale.lobbies.challengeCancelledAfterAccept.replaceAll("{#name}", byUser.name));
	} else {
		resolveAnyChatChallenge(byUser.id, locale.lobbies.challengeCancelled);
	}
}
async function sdpReceived(fromUser, sdp, signature) {
	if (!currentLobby.connectedTo) return;
	if (!await verifySignature(signature, "personal", `sdp|${currentLobby.ownUserId}|${sdp}`, ++fromUser.lastPersonalSequenceNum, fromUser)) return;
	if (fromUser !== currentLobby.connectedTo) { // this must be a new spectator
		fromUser.negotiationIndex = spectationNegotiationCounter++;
	};
	await gameFrameReady;
	gameFrame.contentWindow.postMessage({
		type: "sdp",
		sdp: sdp,
		negotiationIndex: fromUser.negotiationIndex
		// TODO: decrypt sdp something like this.
		// Below code does not work because RSA-OAEP has
		// a maximum size for the data to encrypt.
		//
		//sdp: u8tos(await crypto.subtle.decrypt(
		//	{name: "RSA-OAEP"},
		//	currentLobby.ownRsaKeyPair.privateKey,
		//	stou8(sdp)
		//))
	});
}
async function iceReceived(fromUser, candidate, signature) {
	if (!await verifySignature(signature, "personal", `ice|${currentLobby.ownUserId}|${candidate}`, ++fromUser.lastPersonalSequenceNum, fromUser)) return;
	await gameFrameReady;
	gameFrame.contentWindow.postMessage({
		type: "iceCandidate",
		candidate: candidate,
		negotiationIndex: fromUser.negotiationIndex
		// TODO: Decrypt candidate like SDP above
	});
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
	for (const user of currentLobby.users) {
		if (user.id === currentLobby.ownUserId) continue;
		const dc = getUserConnection(user.id).dataChannel;
		if (dc !== excludeDataChannel) {
			dc.send(message);
		}
	}
}

// opening a new lobby
newLobbyBtn.addEventListener("click", async () => {
	disableJoinMenus();
	loadingIndicator.classList.add("active");

	const rsaKeyPair = await generateRsaKeyPair();
	const ecdsaKeyPair = await generateEcdsaKeyPair();

	let lobbyName = "";
	if (localStorage.getItem("username")) {
		lobbyName = locale.lobbies.defaultName.replaceAll("{#name}", localStorage.getItem("username"));
	}

	currentLobby = new Lobby(
		lobbyName,
		8,
		true,
		Math.floor(Math.random() * 999999999999).toString().padStart(12, 0), // TODO: better initial password (initial lobby creation menu?)
		"normal",
		"beginner",
		false,
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
		ecdsaKeyPair
	);
	isHosting = true;
	if (lobbyServerWs.readyState === 1) {
		lobbyServerWs.send(JSON.stringify({
			type: "openLobby",
			name: currentLobby.name,
			userCount: currentLobby.users.length,
			userLimit: currentLobby.userLimit,
			hasPassword: currentLobby.hasPassword,
			language: locale.code
		}));
	}
	openLobbyScreen();
});

// leaving lobby as a visitor
function leaveLobby() {
	hostConnection.close();
	iceBuffer.length = 0;
	closeLobbyScreen();
	hostConnection = null;
	hostDataChannel = null;
	doneHandshake = false;
}
// closing a lobby as the host
function closeLobby() {
	isHosting = false;
	if (lobbyServerWs.readyState === 1) {
		lobbyServerWs.send('{"type": "closeLobby"}');
	}
	for (const peer of peerConnections) {
		if (peer.dataChannel.readyState === "open") {
			peer.dataChannel.send('{"type": "kick", "reason": "closing"}');
		}
		peer.connection.close();
	}
	iceBuffer.length = 0;
	closeLobbyScreen();
}

// show or hide the actual in-lobby menu
async function openLobbyScreen() {
	await Promise.all([import("./chat.mjs"), import("./deckDialog.mjs")]);
	lobbySettings.disabled = !isHosting;
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
	newLobbyBtn.disabled = false;
	mainMenu.style.display = "flex";
	lobbyHeader.style.display = "none";
	userList.innerHTML = "";
	loadingIndicator.classList.remove("active");
	unloadWarning.abort();
}

// websocket stuff
function connectWebsocket() {
	lobbyServerWs = new WebSocket(localStorage.getItem("lobbyServerUrl")? localStorage.getItem("lobbyServerUrl") : "wss://battle.crossuniverse.net:443/lobbies/");
	lobbyServerWs.addEventListener("open", function() {
		lobbyList.dataset.message = locale.lobbies.noOpenLobbies;
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
		connectWebsocket();
	});
}
connectWebsocket();

let iceBuffer = []; // where ICE candidates go if they arrive before the remote description has been set
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
			lobbyElem.querySelector(".lobbyUserCount").textContent = message.newValue;
			setConnectButtonEnabled(lobbyElem);
			break;
		}
		case "lobbyUserLimitChanged": {
			const lobbyElem = document.getElementById("lobbyElem" + message.lobbyId);
			lobbyElem.querySelector(".lobbyUserLimit").textContent = message.newValue;
			setConnectButtonEnabled(lobbyElem);
			break;
		}
		case "lobbyHasPasswordChanged": {
			document.getElementById("lobbyElem" + message.lobbyId).querySelector(".lobbyJoinBtn").textContent = locale.lobbies[message.newValue? "joinPassword" : "join"];
			break;
		}
		case "lobbyNameChanged": {
			const nameField = document.getElementById("lobbyElem" + message.lobbyId).querySelector(".lobbyName")
			nameField.textContent = message.newValue? message.newValue : locale.lobbies.settings.namePlaceholder;
			if (message.newValue === "" !== nameField.classList.contains("textPlaceholder")) {
				nameField.classList.toggle("textPlaceholder");
			}
			break;
		}
		case "joinRequestOffer": {
			const pc = new RTCPeerConnection(webRtcConfig);
			pc.addEventListener("icecandidate", e => {
				if (e.candidate === null) {
					const pcData = peerConnections.find(pc => pc.peer === message.peer);
					pcData.allIcesSent = true;
					if (pcData.allIcesReceived) {
						delete pcData.peer;
						lobbyServerWs.send(JSON.stringify({
							type: "allIcesSent",
							peer: message.peer
						}));
					}
					return;
				}
				lobbyServerWs.send(JSON.stringify({
					type: "joinLobbyAnswerIceCandidate",
					peer: message.peer,
					candidate: JSON.stringify(e.candidate)
				}));
			});

			const dc = pc.createDataChannel("data", {negotiated: true, id: 0});
			dc.addEventListener("open", () => {
				dc.send(JSON.stringify({
					type: "handshake",
					needsPassword: currentLobby.hasPassword
				}));
			});
			dc.addEventListener("message", receiveWebRtcVisitorMessage);
			dc.addEventListener("close", () => {
				const connection = peerConnections.splice(peerConnections.findIndex(peer => peer.connection === pc), 1)[0];
				iceBuffer = iceBuffer.filter(elem => elem.for !== peer);
				// needs to check for isHosting in case the lobby is being shut down
				if (isHosting && connection.userId) {
					// check if the user still exists ( = this disconnect was initiated from their end, unexpectedly)
					const user = currentLobby.removeUser(connection.userId);
					if (!user) return;

					broadcast(JSON.stringify({type: "userLeft", id: user.id}));
					if (lobbyServerWs.readyState === 1) {
						lobbyServerWs.send(JSON.stringify({type: "setUserCount", newValue: currentLobby.users.length}));
					}
					let chatType = "notice";
					if (currentLobby.currentlyChallenging === user) {
						clearCurrentlyChallenging();
						chatType = "error";
					}
					resolveAnyChatChallenge(user.id, locale.lobbies.challengerLeft);
					lobbyChat.putMessage(locale.lobbies.userLeft.replaceAll("{#name}", user.name), chatType);
				}
			});

			const pcData = {
				connection: pc,
				dataChannel: dc,
				userId: null,
				allIcesSent: false,
				allIcesReceived: false,
				peer: message.peer // used to send messages back to this specific peer during signalling
			};
			peerConnections.push(pcData);
			pc.setRemoteDescription({type: "offer", sdp: message.sdp}).then(() => {
				for (let i = iceBuffer.length - 1; i >= 0; i--) {
					if (iceBuffer[i].for === pcData) {
						pc.addIceCandidate(JSON.parse(iceBuffer[i].candidate));
						iceBuffer.splice(i, 1);
					}
				}
			});
			pc.createAnswer().then(async answer => {
				await pc.setLocalDescription(answer);
				lobbyServerWs.send(JSON.stringify({
					type: "joinLobbyAnswer",
					peer: message.peer,
					sdp: pc.localDescription.sdp
				}));
			});
			break;
		}
		case "joinRequestAnswer": {
			hostConnection.setRemoteDescription({type: "answer", sdp: message.sdp}).then(() => {
				for (const candidate of iceBuffer) {
					hostConnection.addIceCandidate(JSON.parse(candidate));
				}
				iceBuffer.length = 0;
			});
			break;
		}
		case "joinRequestOfferIceCandidate": {
			const pcData = peerConnections.find(pc => pc.peer === message.peer);
			const candidate = JSON.parse(message.candidate);
			if (candidate === null) {
				pcData.allIcesReceived = true;
				if (pcData.allIcesSent) {
					delete pcData.peer;
					lobbyServerWs.send(JSON.stringify({
						type: "allIcesSent",
						peer: message.peer
					}));
				}
			} else if (pcData.connection.connectionState !== "connected") {
				if (pcData.connection.remoteDescription) {
					pcData.connection.addIceCandidate(JSON.parse(message.candidate));
				} else {
					iceBuffer.push({
						for: pcData,
						candidate: message.candidate
					});
				}
			}
			break;
		}
		case "joinRequestAnswerIceCandidate": {
			if (hostConnection.connectionState !== "connected") {
				if (hostConnection.remoteDescription) {
					hostConnection.addIceCandidate(JSON.parse(message.candidate));
				} else {
					iceBuffer.push(message.candidate);
				}
			}
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
	disableJoinMenus();
	loadingIndicator.classList.add("active");

	// create connection
	hostConnection = new RTCPeerConnection(webRtcConfig);
	hostConnection.addEventListener("icecandidate", e => {
		lobbyServerWs.send(JSON.stringify({
			type: "joinLobbyOfferIceCandidate",
			lobbyId: lobbyId,
			candidate: JSON.stringify(e.candidate)
		}));
	});

	// add data channel
	hostDataChannel = hostConnection.createDataChannel("data", {negotiated: true, id: 0});
	hostDataChannel.addEventListener("message", receiveWebRtcHostMessage);
	hostDataChannel.addEventListener("close", () => {
		// leave the lobby if we haven't already
		if (hostConnection) {
			leaveLobby();
			alert(locale.lobbies.lostConnection);
		}
	});

	// set local description
	await hostConnection.setLocalDescription(await hostConnection.createOffer());
	lobbyServerWs.send(JSON.stringify({
		type: "joinLobbyOffer",
		lobbyId: lobbyId,
		sdp: hostConnection.localDescription.sdp
	}));
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
					message.lobby.password,
					message.lobby.gameMode,
					message.lobby.draftFormat,
					message.lobby.automatic,
					message.lobby.oldManaRule,
					await Promise.all(
						message.lobby.users.map(async user => new User(
							user.namePlaceholder? "" : user.name,
							user.profilePicture,
							user.id,
							// I hate that these are async, it is quite annoying.
							await crypto.subtle.importKey("jwk", user.rsaPublicKey, {name: "RSA-OAEP", hash: "SHA-512"}, false, ["encrypt"]),
							await crypto.subtle.importKey("jwk", user.ecdsaPublicKey, {name: "ECDSA", namedCurve: "P-256"}, false, ["verify"]),
							user.rsaPublicKey,
							user.ecdsaPublicKey,
							user.status,
							user.lastPublicSequenceNum
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
			alert(locale.lobbies.kickMessages[message.reason] ?? locale.lobbies.kickMessages.kicked);
			break;
		}
		case "chat": {
			const user = getUserFromId(message.userId);
			if (!user || typeof message.message !== "string") break;
			if (!await verifySignature(message.signature, "public", `chat|${message.message}`, ++user.lastPublicSequenceNum, user)) break;

			lobbyChat.putPlayerMessage(user.name, message.message);
			break;
		}
		case "userStatus": {
			const user = getUserFromId(message.userId);
			if (!user || !possibleStatuses.includes(message.status)) break;
			if (!await verifySignature(message.signature, "public", `status|${message.status}`, ++user.lastPublicSequenceNum, user)) break;

			user.setStatus(message.status);
			break;
		}
		case "userJoined": {
			const user = new User(
				message.name,
				message.profilePicture,
				message.id,
				await crypto.subtle.importKey("jwk", message.rsaPublicKey, {name: "RSA-OAEP", hash: "SHA-512"}, true, ["encrypt"]),
				await crypto.subtle.importKey("jwk", message.ecdsaPublicKey, {name: "ECDSA", namedCurve: "P-256"}, true, ["verify"])
			);
			currentLobby.addUser(user);
			lobbyChat.putMessage(locale.lobbies.userJoined.replaceAll("{#name}", user.name), "notice");
			break;
		}
		case "userLeft": {
			const user = currentLobby.removeUser(message.id);
			let chatType = "notice";
			if (currentLobby.currentlyChallenging === user) {
				clearCurrentlyChallenging();
				chatType = "error";
			}
			resolveAnyChatChallenge(user.id, locale.lobbies.challengerLeft);
			lobbyChat.putMessage(locale.lobbies.userLeft.replaceAll("{#name}", user.name), chatType);
			break;
		}
		case "userKicked": {
			const user = currentLobby.removeUser(message.id);
			lobbyChat.putMessage(locale.lobbies.userKicked.replaceAll("{#name}", user.name), "warning");
			break;
		}
		case "settingUpdated": {
			if (!settingsList.includes(message.name)) break;
			if (settingsTypes[message.name] !== typeof message.value) break;
			currentLobby.setSetting(message.name, message.value);
			break;
		}
		case "challenge": {
			const user = getUserFromId(message.from);
			if (!user) break;
			presentChallengeInChat(user, message.signature);
			break;
		}
		case "challengeAccepted": {
			const user = getUserFromId(message.from);
			if (!user) break;
			challengeGotAccepted(user, message.signature);
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
		case "sdp": { // opponent sent an SDP for game connection signalling
			const user = getUserFromId(message.from);
			sdpReceived(user, message.sdp, message.signature);
			break;
		}
		case "iceCandidate": { // opponent sent an ice candidate for game connection signalling
			const user = getUserFromId(message.from);
			// refuse ICEs when the user has not initiated a connection. (either via connection process or via spectation SDP)
			if (user.negotiationIndex === -1) break;
			iceReceived(user, message.candidate, message.signature);
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
			if (currentLobby.hasPassword && message.password !== currentLobby.password) {
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
				++currentLobby.largestUserId,
				await crypto.subtle.importKey("jwk", message.rsaPublicKey, {name: "RSA-OAEP", hash: "SHA-512"}, true, ["encrypt"]),
				await crypto.subtle.importKey("jwk", message.ecdsaPublicKey, {name: "ECDSA", namedCurve: "P-256"}, true, ["verify"]),
				message.rsaPublicKey,
				message.ecdsaPublicKey
			);
			peer.userId = newUser.id;
			currentLobby.addUser(newUser);

			this.send(JSON.stringify({
				type: "welcomeIn",
				lobby: {
					name: currentLobby.name,
					users: currentLobby.users,
					userLimit: currentLobby.userLimit,
					hasPassword: currentLobby.hasPassword,
					password: "*".repeat(currentLobby.password.length),
					gameMode: currentLobby.gameMode,
					draftFormat: currentLobby.draftFormat,
					automatic: currentLobby.automatic,
					oldManaRule: currentLobby.oldManaRule
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
			if (lobbyServerWs.readyState === 1) {
				lobbyServerWs.send(JSON.stringify({type: "setUserCount", newValue: currentLobby.users.length}));
			}
			lobbyChat.putMessage(locale.lobbies.userJoined.replaceAll("{#name}", newUser.name), "notice");
			break;
		}
		case "chat": {
			const user = getUserFromDataChannel(this);
			if (!user || typeof message.message !== "string") break;

			// broadcast before verifying the signature since every client needs to get the signature to not loose out on a sequence number
			broadcast(JSON.stringify({
				type: "chat",
				message: message.message,
				userId: user.id,
				signature: message.signature
			}));

			if (!await verifySignature(message.signature, "public", `chat|${message.message}`, ++user.lastPublicSequenceNum, user)) break;
			lobbyChat.putPlayerMessage(user.name, message.message);
			break;
		}
		case "setStatus": {
			const user = getUserFromDataChannel(this);
			if (!user || !possibleStatuses.includes(message.status)) break;

			// broadcast before verifying the signature since every client needs to get the signature to not loose out on a sequence number
			broadcast(JSON.stringify({
				type: "userStatus",
				status: message.status,
				userId: user.id,
				signature: message.signature
			}));

			if (!await verifySignature(message.signature, "public", `status|${message.status}`, ++user.lastPublicSequenceNum, user)) break;
			user.setStatus(message.status);
			break;
		}
		case "challenge": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				presentChallengeInChat(getUserFromDataChannel(this), message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.dataChannel.send(JSON.stringify({
				type: "challenge",
				from: getConnectionFromDataChannel(this).userId,
				signature: message.signature
			}));
			break;
		}
		case "challengeAccepted": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				challengeGotAccepted(getUserFromDataChannel(this), message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.dataChannel.send(JSON.stringify({
				type: "challengeAccepted",
				from: getConnectionFromDataChannel(this).userId,
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
			getUserConnection(message.to)?.dataChannel.send(JSON.stringify({
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
			getUserConnection(message.to)?.dataChannel.send(JSON.stringify({
				type: "challengeCancelled",
				from: getConnectionFromDataChannel(this).userId,
				signature: message.signature
			}));
			break;
		}
		case "sdp": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				sdpReceived(getUserFromDataChannel(this), message.sdp, message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.dataChannel.send(JSON.stringify({
				type: "sdp",
				from: getConnectionFromDataChannel(this).userId,
				sdp: message.sdp,
				signature: message.signature
			}));
			break;
		}
		case "iceCandidate": {
			if (message.to === currentLobby.ownUserId) { // is for me?
				iceReceived(getUserFromDataChannel(this), message.candidate, message.signature);
				break;
			}
			// otherwise, forward to recipient
			getUserConnection(message.to)?.dataChannel.send(JSON.stringify({
				type: "iceCandidate",
				from: getConnectionFromDataChannel(this).userId,
				candidate: message.candidate,
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
	const nameField = lobbyElem.querySelector(".lobbyName");
	nameField.textContent = lobby.name? lobby.name : locale.lobbies.settings.namePlaceholder;
	if (!lobby.name) {
		nameField.classList.add("textPlaceholder");
	}
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
function disableJoinMenus() {
	centerRoomCode.disabled = true;
	newLobbyBtn.disabled = true;
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
	const signature = await signString("public", `chat|${e.data}`, ++currentLobby.ownPublicSequenceNum);
	if (isHosting) {
		broadcast(JSON.stringify({
			type: "chat",
			message: e.data.substring(0, 10_000),
			userId: currentLobby.ownUserId,
			signature: signature
		}));
		lobbyChat.putPlayerMessage(getUserFromId(currentLobby.ownUserId).name, e.data);
	} else {
		hostDataChannel.send(JSON.stringify({
			type: "chat",
			message: e.data.substring(0, 10_000),
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