import {locale} from "./locale.mjs";
import {startEffect, stopEffect} from "./levitationEffect.mjs";
import {startGame, loadReplay, gameFrameReady} from "./gameStarter.mjs";
import * as uiUtils from "./uiUtils.mjs";

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
	// game was opened from lobby if socket is null
	if (!socket) return;

	switch (e.data.type) {
		case "sdp": {
			socket.send("[sdp]" + e.data.sdp);
			break;
		}
		case "iceCandidate": {
			socket.send("[iceCandidate]" + e.data.candidate);
			break;
		}
		case "gameStarted": {
			hideConnectScreen();
			break;
		}
	}
});

function showConnectScreen() {
	// hide input field and show waiting indicator
	cancelWaitingBtn.disabled = false;
	roomCodeInputFieldHolder.hidden = true;
	waitingForOpponentHolder.hidden = false;
	lobbies.style.display = "none";
	rulesButton.hidden = true;
	loadingScreenMessage.hidden = false;
	loadingIndicator.classList.add("active");
	stopEffect();
	if (localStorage.getItem("loadingScreenHints") === "true") {
		loadingScreenMessage.textContent = `${locale.mainMenu.loadingScreenHint}\n${locale.mainMenu.loadingScreenHints[Math.floor(Math.random() * locale.mainMenu.loadingScreenHints.length)]}`;
	} else {
		loadingScreenMessage.textContent = "";
	}

	// refresh the "Waiting for Opponent" text so screen readers read it out.
	setTimeout(() => {
		if (typeof waitingForOpponentText !== "undefined") {
			waitingForOpponentText.textContent = locale.mainMenu.waitingForOpponent;
			cancelWaitingBtn.focus();
		}
	}, 100);

}
// stops connecting to an opponent and returns whether or not anything was done.
function hideConnectScreen() {
	if (waitingForOpponentHolder.hidden) return false;

	socket.close(); // might've already closed
	socket = null;
	waitingForOpponentHolder.hidden = true;
	roomCodeInputFieldHolder.hidden = false;
	lobbies.style.display = "flex";
	rulesButton.hidden = false;
	loadingScreenMessage.hidden = true;
	startEffect();
	return true;
}

// connecting
function connect(overrideWebsocketUrl) {
	showConnectScreen();

	// Signalling for the game
	socket = new WebSocket(overrideWebsocketUrl ?? websocketUrl);
	socket.addEventListener("open", () => {
		socket.send("[roomcode]" + getRoomcode() + gameModeSelect.value);
	});
	socket.addEventListener("message", async e => {
		const message = e.data.substring(e.data.indexOf("]") + 1);
		const command = e.data.substring(1, e.data.indexOf("]"));

		switch (command) {
			case "youAre": {
				cancelWaitingBtn.disabled = true;
				loadingScreenMessage.textContent = locale.mainMenu.opponentFound;
				startGame(parseInt(message) === 0, {
					gameMode: "normal",
					automatic: gameModeSelect.value === "automatic"
				});
				break;
			}
			case "sdp": {
				await gameFrameReady;
				gameFrame.contentWindow.postMessage({
					type: "sdp",
					sdp: message,
					negotiationIndex: 0
				});
				break;
			}
			case "iceCandidate": {
				await gameFrameReady;
				gameFrame.contentWindow.postMessage({
					type: "iceCandidate",
					candidate: message,
					negotiationIndex: 0
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
lobbyList.dataset.message = locale.lobbies.noLobbyServer;
newLobbyBtnText.textContent = locale.lobbies.newLobbyButton;
newLobbyBtnImg.alt = "";

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

// XKCD room code easter egg
roomCodeInputField.addEventListener("input", () => {
	xkcdRoomCode.style.display = roomCodeInputField.value === "020518"? "inline" : "none";
});
xkcdRoomCode.addEventListener("click", () => {
	window.open("https://xkcd.com/2937/");
});

// canceling a connection
cancelWaitingBtn.addEventListener("click", function() {
	hideConnectScreen();
	gameFrame.removeAttribute("src");
	roomCodeInputField.focus();
	loadingIndicator.classList.remove("active");
});
// generating an invite link
copyInviteLink.addEventListener("click", function() {
	let inviteURL = `${location.origin}${location.pathname}?id=${encodeURIComponent(getRoomcode())}`;
	if (gameModeSelect.value !== "normal") {
		inviteURL += `&m=${encodeURIComponent(gameModeSelect.value)}`;
	}
	navigator.clipboard.writeText(inviteURL);
});
uiUtils.makeCopyButton(copyInviteLink, locale.mainMenu.copyInviteLink);


// drag&drop loading for replays
preGame.addEventListener("dragover", function(e) {
	e.preventDefault();
});
preGame.addEventListener("drop", function(e) {
	const file = e.dataTransfer.items[0].getAsFile();
	if (!file || (!file.name.endsWith(".replay") && !file.name.endsWith(".json"))) {
		return;
	}

	e.preventDefault();

	const reader = new FileReader();
	reader.addEventListener("load", e => {
		// TODO: add proper replay file validation
		try {
			const replay = JSON.parse(e.target.result);
			stopEffect();
			loadReplay(replay).then(() => {
				startEffect();
			});
			lobbies.style.display = "none";
		} catch(e) {
			alert(locale.mainMenu.invalidReplay);
		}
	});
	reader.readAsText(file);
});

// set up the background cards effect
startEffect();