import {locale} from "/scripts/locale.mjs";
import "/scripts/profilePicture.mjs";

// lobby template translation
lobbyTemplate.content.querySelector(".lobbyUserIcon").textContent = locale.lobbies.userIconAlt;
userListHeader.textContent = locale.lobbies.players;
lobbyUserTemplate.content.querySelector(".challengeBtn").textContent = locale.lobbies.challenge;
lobbyUserTemplate.content.querySelector(".kickBtn").textContent = locale.lobbies.kick;

class Lobby {
	constructor(name, userLimit, hasPassword, users, password = null) {
		this.name = name;
		this.userLimit = userLimit;
		this.hasPassword = hasPassword;
		this.password = password;
		this.users = [];

		for (const user of users) {
			this.addUser(user);
		}
	}

	addUser(user) {
		this.users.push(user);
		// add to UI
		const userElem = lobbyUserTemplate.content.cloneNode(true);
		userElem.querySelector(".user").id = "userElem" + user.id;
		userElem.querySelector(".username").textContent = user.name;
		if (!isHosting) {
			userElem.querySelector(".kickBtn").disabled = true;
		}
		userList.appendChild(userElem);
		document.getElementById("userElem" + user.id).querySelector("profile-picture").setIcon(user.profilePicture);
	}
	// removes and returns a user with the given id
	removeUser(id) {
		document.getElementById("userElem" + id).remove();
		return this.users.splice(this.users.findIndex(user => user.id === id), 1)[0];
	}
}
class User {
	// this sanitizes the incoming data
	constructor(name, profilePicture, id) {
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
		this.id = id;
	}
}

let lobbyServerWs;
let currentLobby = null;
let isHosting = false;
let ownUserId = 0;
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

function getUserFromId(id) {
	return currentLobby.users.find(user => user.id === id);
}

// for host convenience
function getUserFromDataChannel(dataChannel) {
	const peer = peerConnections.find(peer => peer.dataChannel === dataChannel);
	if (peer.userId) {
		return getUserFromId(peer.userId);
	}
	return null;
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
		peer.dataChannel.send('{"type": "kick"}');
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
}
function closeLobbyScreen() {
	currentLobby = null;
	lobbyMenu.style.display = "none";
	mainMenu.style.display = "flex";
	lobbyHeader.style.display = "none";
	userList.innerHTML = "";
}

// websocket stuff
function connectWebsocket() {
	lobbyServerWs = new WebSocket(localStorage.getItem("lobbyServerUrl")? localStorage.getItem("lobbyServerUrl") : "wss://battle.crossuniverse.net:443/lobbies/");
	lobbyServerWs.addEventListener("open", function() {
		lobbyList.dataset.message = locale.lobbies.noOpenLobbies;
		newLobbyBtn.addEventListener("click", () => {
			currentLobby = new Lobby(
				"my cool lobby",
				8,
				false,
				[new User(
					localStorage.getItem("username"),
					localStorage.getItem("profilePicture"),
					0
				)],
				null
			);
			largestUserId = 0;
			ownUserId = 0;
			isHosting = true;
			openLobbyScreen();
			lobbyServerWs.send(JSON.stringify({
				type: "openLobby",
				name: currentLobby.name,
				userCount: currentLobby.users.length,
				userLimit: currentLobby.userLimit,
				hasPassword: currentLobby.hasPassword,
				language: locale.code
			}));
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
					const user = currentLobby.removeUser(connection.userId);
					broadcast(JSON.stringify({type: "userLeft", id: user.id}));
					lobbyServerWs.send(JSON.stringify({type: "setUserCount", newCount: currentLobby.users.length}));
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
			loadingIndicator.classList.remove("active");
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

// messages that were sent by the host of a lobby
function receiveWebRtcHostMessage(e) {
	const message = JSON.parse(e.data);

	switch (message.type) {
		case "handshake": {
			if (doneHandshake) break;
			let password = null;
			if (message.needsPassword) {
				password = prompt(locale.lobbies.enterPassword);
				if (password === null) {
					leaveLobby();
					break;
				}
			}
			doneHandshake = true;
			this.send(JSON.stringify({
				type: "handshake",
				password: password,
				name: localStorage.getItem("username"),
				profilePicture: localStorage.getItem("profilePicture")
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
			currentLobby = new Lobby(
				message.lobby.name,
				message.lobby.userLimit,
				message.lobby.hasPassword,
				message.lobby.users.map(user => new User(user.name, user.profilePicture, user.id))
			)
			ownUserId = message.youAre;
			openLobbyScreen();
			break;
		}
		case "kick": {
			leaveLobby();
			setTimeout(() => {
				alert(locale.lobbies.kickMessage);
			}, 0);
			break;
		}
		case "chat": {
			const user = getUserFromId(message.userId);
			if (!user || typeof message.message !== "string") break;
			lobbyChat.putMessage(user.name + locale["chat"]["colon"] + message.message.substring(0, 10_000));
			break;
		}
		case "userJoined": {
			const user = new User(
				message.name,
				message.profilePicture,
				message.id
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
	}
}

// messages that were sent by a visitor in your hosted lobby
function receiveWebRtcVisitorMessage(e) {
	const message = JSON.parse(e.data);

	switch (message.type) {
		case "handshake": {
			const peer = peerConnections.find(peer => peer.dataChannel === this);
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

			const newUser = new User(message.name, message.profilePicture, ++largestUserId);
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
				id: newUser.id
			}), this);
			lobbyServerWs.send(JSON.stringify({type: "setUserCount", newCount: currentLobby.users.length}));
			lobbyChat.putMessage(locale.lobbies.userJoined.replaceAll("{#name}", newUser.name), "notice");
			break;
		}
		case "chat": {
			const user = getUserFromDataChannel(this);
			if (!user || typeof message.message !== "string") break;

			message.message = message.message.substring(0, 10_000);
			broadcast(JSON.stringify({
				type: "chat",
				message: message.message,
				userId: user.id
			}));
			lobbyChat.putMessage(user.name + locale["chat"]["colon"] + message.message);
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

lobbyChat.addEventListener("message", function(e) {
	if (isHosting) {
		broadcast(JSON.stringify({
			type: "chat",
			message: e.data,
			userId: ownUserId
		}));
		lobbyChat.putMessage(getUserFromId(ownUserId).name + locale["chat"]["colon"] + e.data);
	} else {
		hostDataChannel.send(JSON.stringify({
			type: "chat",
			message: e.data
		}));
	}
});