import {locale} from "/scripts/locale.mjs";

// lobby template translation
lobbyTemplate.content.querySelector(".lobbyJoinBtn").textContent = locale.lobbies.join;
lobbyTemplate.content.querySelector(".lobbyUserIcon").textContent = locale.lobbies.userIconAlt;


let lobbyConnection;

function connectWebsocket() {
	lobbyConnection = new WebSocket("ws://localhost:4538");
	console.log("connecting...");
	lobbyConnection.addEventListener("open", function() {
		console.log("opened websocket");
		newLobbyBtn.addEventListener("click", () => {
			lobbyConnection.send(JSON.stringify({
				"type": "openLobby",
				"name": "my cool lobby",
				"userLimit": 8,
				"hasPassword": false,
				"language": locale.code
			}));
		});
		newLobbyBtn.disabled = false;
	});

	lobbyConnection.addEventListener("message", e => receiveMessage(JSON.parse(e.data)));

	lobbyConnection.addEventListener("close", () => {
		console.log("websocket closed");
		connectWebsocket();
	});
}
connectWebsocket();

window.addEventListener("unload", () => {
	// TODO: close lobby
});


function displayLobby(lobby) {
	let lobbyElem = lobbyTemplate.content.cloneNode(true);
	lobbyElem.querySelector(".lobbyName").textContent = lobby.name;
	lobbyElem.querySelector(".lobbyLanguage").textContent = lobby.language.toUpperCase();
	lobbyElem.querySelector(".lobbyUserCount").textContent = lobby.userCount;
	lobbyElem.querySelector(".lobbyUserLimit").textContent = lobby.userLimit;

	lobbyList.appendChild(lobbyElem);
}

function receiveMessage(message) {
	console.log(message);
	switch(message.type) {
		case "lobbyList": {
			for (const lobby of message.lobbies) {
				displayLobby(lobby);
			}
		}
	}
}