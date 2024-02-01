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

// connecting
function connect(overrideWebsocketUrl) {
	// hide input field and show waiting indicator
	roomCodeInputFieldHolder.hidden = true;
	waitingForOpponentHolder.hidden = false;
	lobbies.style.display = "none";
	// refresh the "Waiting for Opponent" text so screen readers read it out.
	setTimeout(() => {
		if (typeof waitingForOpponentText !== "undefined") {
			waitingForOpponentText.textContent = locale.mainMenu.waitingForOpponent;
			cancelWaitingBtn.focus();
		}
	}, 100);

	startGame(getRoomcode(), gameModeSelect.value, overrideWebsocketUrl ?? websocketUrl).then(showGameScreen).then(showGameScreen);
}
function showGameScreen() {
	waitingForOpponentHolder.hidden = true;
	roomCodeInputFieldHolder.hidden = false;
	lobbies.style.display = "flex";
}

// check if a room code is given in the query string
const queryString = new URLSearchParams(location.search);
if (queryString.get("id")) {
	roomCodeInputField.placeholder = queryString.get("id");
	let gameMode = queryString.get("m");
	if (!["normal", "draft", "normalAutomatic", "draftAutomatic"].includes(gameMode)) {
		gameMode = "normal";
	}
	gameModeSelect.value = gameMode;
	websocketUrl ??= queryString.get("s");
	connect();
} else {
	randomizeRoomcode();
}

// this is an awful fix to make Chromium browsers work when the page reloads while the game iframe is up.
setTimeout(function() {
	window.scrollTo(0, 0);
}, 1000);

// translate main menu
roomCodeInputTitle.textContent = locale.mainMenu.roomCodeInputTitle;
roomCodeInputLabel.textContent = locale.mainMenu.enterRoomcode;
roomCodeRefresh.setAttribute("aria-label", locale.mainMenu.rerollRoomcode);

gameModeSelectorLabel.textContent = locale.mainMenu.gamemode;
gameModeNormalOption.textContent = locale.mainMenu.gamemodes.normal;
gameModeDraftOption.textContent = locale.mainMenu.gamemodes.draft;
gameModeNormalAutomaticOption.textContent = locale.mainMenu.gamemodes.normalAutomatic;
gameModeDraftAutomaticOption.textContent = locale.mainMenu.gamemodes.draftAutomatic;

connectBtn.textContent = locale.mainMenu.connectToRoom;
waitingForOpponentText.textContent = locale.mainMenu.waitingForOpponent;
copyInviteLink.textContent = locale.mainMenu.copyInviteLink;
cancelWaitingBtn.textContent = locale.mainMenu.cancelWaiting;
unofficialFooter.innerHTML = locale.mainMenu.unofficialNotice;
rulesButton.textContent = locale.mainMenu.rulesButton;

rulesButton.href = locale.mainMenu.rulesLink;

settingsButton.title = locale.mainMenu.settingsButton;
deckMakerButton.title = locale.mainMenu.deckCreatorButton;
bugReportButton.title = locale.mainMenu.reportBug;

lobbyHeading.textContent = locale.lobbies.title;
newLobbyBtn.title = locale.lobbies.newLobbyButton;
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
		loadReplay(JSON.parse(e.target.result));
		lobbies.style.display = "none";
	});
	reader.readAsText(file);
});

// set up the background cards effect
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");
if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}