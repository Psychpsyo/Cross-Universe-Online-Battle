import {locale} from "/scripts/locale.mjs";
import {startEffect, stopEffect} from "/scripts/levitationEffect.mjs";
import {startGame, loadReplay} from "/scripts/gameStarter.mjs";
import * as uiUtils from "/scripts/uiUtils.mjs";

// randomizing the default room code
function randomizeRoomcode() {
	const roomCode = 10000 + (Math.floor(Math.random() * 90000));
	roomCodeInputField.placeholder = roomCode;
	roomCodeInputField.value = roomCode;
}
function getRoomcode() {
	return roomCodeInputField.value == ""? roomCodeInputField.placeholder : roomCodeInputField.value;
}

let websocketUrl = localStorage.getItem("websocketUrl")? localStorage.getItem("websocketUrl") : "wss://battle.crossuniverse.net:443/ws/";
let socket = null; // used for signalling through room code

window.addEventListener("message", async e => {
	if (e.source !== gameFrame.contentWindow) return;

	switch (e.data.type) {
		case "sdp": {
			// does not send if socket is null (in that case, the game was opened in a lobby)
			socket?.send("[sdp]" + e.data.sdp);
			break;
		}
		case "gameStarted": {
			// signalling socket isn't needed anymore once game has started
			socket.close();
			socket = null;
			break;
		}
	}
});

// connecting
function connect(overrideWebsocketUrl) {
	// hide input field and show waiting indicator
	roomCodeInputFieldHolder.hidden = true;
	waitingForOpponentHolder.hidden = false;
	lobbies.style.display = "none";
	loadingIndicator.classList.add("active");
	// refresh the "Waiting for Opponent" text so screen readers read it out.
	setTimeout(() => {
		if (typeof waitingForOpponentText !== "undefined") {
			waitingForOpponentText.textContent = locale.mainMenu.waitingForOpponent;
			cancelWaitingBtn.focus();
		}
	}, 100);

	stopEffect();

	// Signalling for the game
	socket = new WebSocket(overrideWebsocketUrl ?? websocketUrl);
	socket.addEventListener("open", () => {
		socket.send("[roomcode]" + getRoomcode() + gameModeSelect.value);
	});
	socket.addEventListener("message", e => {
		const message = e.data.substring(e.data.indexOf("]") + 1);
		const command = e.data.substring(1, e.data.indexOf("]"));

		switch (command) {
			case "youAre": {
				startGame(parseInt(message) === 0, {
					gameMode: "normal",
					automatic: gameModeSelect.value === "automatic"
				}).then(() => {
					socket?.close(); // might've already closed at game start
					socket = null;
					waitingForOpponentHolder.hidden = true;
					roomCodeInputFieldHolder.hidden = false;
					lobbies.style.display = "flex";
					startEffect(levitatingCards);
				});
				break;
			}
			case "sdp": {
				gameFrame.contentWindow.postMessage({
					type: "sdp",
					sdp: message
				});
				break;
			}
		}
	});
}

// check if a room code is given in the query string
const queryString = new URLSearchParams(location.search);
if (queryString.get("id")) {
	roomCodeInputField.placeholder = queryString.get("id");
	const gameMode = queryString.get("m");
	if (!["manual", "automatic"].includes(gameMode)) {
		gameMode = "manual";
	} else {
		gameModeSelect.value = gameMode;
	}
	websocketUrl ??= queryString.get("s");
	connect();
} else {
	randomizeRoomcode();
}

// translate main menu
roomCodeInputTitle.textContent = locale.mainMenu.roomCodeInputTitle;
roomCodeInputLabel.textContent = locale.mainMenu.enterRoomcode;
roomCodeRefresh.title = locale.mainMenu.rerollRoomcode;
roomCodeRefresh.setAttribute("aria-label", locale.mainMenu.rerollRoomcode);

gameModeSelectorLabel.textContent = locale.mainMenu.gameMode;
for (const option of gameModeSelect.children) {
	option.textContent = locale.mainMenu.gameModes[option.value];
	option.title = locale.mainMenu.gameModes[option.value + "Title"];
}

connectBtn.textContent = locale.mainMenu.connectToRoom;
waitingForOpponentText.textContent = locale.mainMenu.waitingForOpponent;
copyInviteLink.textContent = locale.mainMenu.copyInviteLink;
cancelWaitingBtn.textContent = locale.mainMenu.cancelWaiting;
{ // scope this variable since it's very temporary
	const footerNoticeParts = locale.mainMenu.unofficialNotice.split("{#LINK}");
	const anchor = document.createElement("a");
	anchor.textContent = "crossuniverse.jp";
	anchor.href = locale.code === "ja"? "https://crossuniverse.jp" : "https://crossuniverse.net/jp";
	anchor.target = "_blank";
	unofficialFooter.appendChild(document.createTextNode(footerNoticeParts[0]));
	unofficialFooter.appendChild(anchor);
	unofficialFooter.appendChild(document.createTextNode(footerNoticeParts[1]));
}
rulesButton.textContent = locale.mainMenu.rulesButton;

settingsButton.title = locale.mainMenu.settingsButton;
settingsButtonImg.alt = locale.mainMenu.settingsButton;
deckMakerButton.title = locale.mainMenu.deckCreatorButton;
deckMakerButtonImg.alt = locale.mainMenu.deckCreatorButton;
bugReportButton.title = locale.mainMenu.reportBug;
bugReportButtonImg.alt = locale.mainMenu.reportBug;
discordButton.title = locale.mainMenu.joinDiscord;
discordButtonImg.alt = locale.mainMenu.joinDiscord;

rulesButton.href = locale.mainMenu.rulesLink;
discordButton.href = locale.mainMenu.discordLink;

lobbyHeading.textContent = locale.lobbies.title;
newLobbyBtn.title = locale.lobbies.newLobbyButton;
newLobbyBtnImg.alt = locale.lobbies.newLobbyButton;
lobbyList.dataset.message = locale.lobbies.noLobbyServer;

document.documentElement.lang = locale.code;
document.documentElement.removeAttribute("aria-busy");
loadingIndicator.classList.remove("active");

// randomize room code button
roomCodeRefresh.addEventListener("click", function() {
	randomizeRoomcode();
	roomCodeInputField.setAttribute("aria-live", "polite");
});

// pressing enter in the room code entry field to connect
roomCodeInputField.addEventListener("keyup", function(e) {
	if (e.code == "Enter") {
		connect();
	}
});
// clicking the connect button to connect
connectBtn.addEventListener("click", () => connect());


// canceling a connection
cancelWaitingBtn.addEventListener("click", function() {
	socket.close();
	socket = null;
	gameFrame.removeAttribute("src");
	waitingForOpponentHolder.hidden = true;
	roomCodeInputFieldHolder.hidden = false;
	lobbies.style.display = "flex";
	roomCodeInputField.focus();
	loadingIndicator.classList.remove("active");
});
// generating an invite link
copyInviteLink.addEventListener("click", function() {
	let inviteURL = location.origin + "?id=" + encodeURIComponent(getRoomcode());
	if (gameModeSelect.value !== "normal") {
		inviteURL += "&m=" + encodeURIComponent(gameModeSelect.value);
	}
	navigator.clipboard.writeText(inviteURL);
});
uiUtils.makeCopyButton(copyInviteLink, locale.mainMenu.copyInviteLink);


// drag&drop loading for replays
preGame.addEventListener("dragover", function(e) {
	e.preventDefault();
});
preGame.addEventListener("drop", function(e) {
	let file = e.dataTransfer.items[0].getAsFile();
	if (!file || !file.name.endsWith(".replay")) {
		return;
	}

	e.preventDefault();

	let reader = new FileReader();
	reader.addEventListener("load", e => {
		stopEffect();
		loadReplay(JSON.parse(e.target.result)).then(() => {
			startEffect(levitatingCards);
		});
		lobbies.style.display = "none";
	});
	reader.readAsText(file);
});

// set up the background cards effect
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");
if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}