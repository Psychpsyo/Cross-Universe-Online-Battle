import {locale} from "/scripts/locale.mjs";
import {startEffect, stopEffect} from "/scripts/levitationEffect.mjs";
import * as uiUtils from "/scripts/uiUtils.mjs";

// randomizing the default room code
function randomizeRoomcode() {
	let roomcode = 10000 + (Math.floor(Math.random() * 90000));
	roomCodeInputField.placeholder = roomcode;
	roomCodeInputField.value = roomcode;
}
function getRoomcode() {
	return roomCodeInputField.value == ""? roomCodeInputField.placeholder : roomCodeInputField.value;
}

let websocketUrl = localStorage.getItem("websocketUrl") === ""? "wss://battle.crossuniverse.net:443/ws/" : localStorage.getItem("websocketUrl");
let unloadWarning = new AbortController();
let replayToLoad = null;

// receiving messages from the iframe
window.addEventListener("message", e => {
	if (e.source !== gameFrame.contentWindow) return;

	switch (e.data.type) {
		case "ready": {
			if (replayToLoad) {
				gameFrame.contentWindow.postMessage({
					type: "replay",
					data: replayToLoad
				});
				replayToLoad = null;
			} else {
				gameFrame.contentWindow.postMessage({
					type: "connect",
					roomCode: getRoomcode(),
					gameMode: gameModeSelect.value,
					websocketUrl: websocketUrl
				});
			}
			break;
		}
		case "gameStarted": {
			stopEffect();
			preGame.style.display = "none";
			gameFrame.style.visibility = "visible";
			waitingForOpponentHolder.hidden = true;
			roomCodeInputFieldHolder.hidden = false;
			loadingIndicator.classList.remove("active");

			// prevent user from accidently leaving the site
			window.addEventListener("beforeunload", e => {
				e.preventDefault();
				e.returnValue = "";
			}, {"signal": unloadWarning.signal});
			break;
		}
		case "playerWon":
		case "gameDrawn": {
			unloadWarning.abort();
			break;
		}
		case "connectionLost": {
			unloadWarning.abort();
			gameFrame.style.visibility = "hidden";
			preGame.style.display = "flex";
			gameFrame.contentWindow.location.replace("about:blank");
			break;
		}
	}
});

// connecting
function connect(websocketUrl) {
	// hide input field and show waiting indicator
	roomCodeInputFieldHolder.hidden = true;
	waitingForOpponentHolder.hidden = false;
	// refresh the "Waiting for Opponent" text so screen readers read it out.
	setTimeout(() => {
		if (typeof waitingForOpponentText !== "undefined") {
			waitingForOpponentText.textContent = locale.mainMenu.waitingForOpponent;
			cancelWaitingBtn.focus();
		}
	}, 100);

	gameFrame.contentWindow.location.replace(location.origin + "/game");
	loadingIndicator.classList.add("active");
}

// check if a room code is given in the query string
const queryString = new URLSearchParams(window.location.search);
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

// randomize roomcode button
roomCodeRefresh.addEventListener("click", function() {
	randomizeRoomcode();
	roomCodeInputField.setAttribute("aria-live", "polite");
});

// pressing enter in the roomcode entry field to connect
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
		replayToLoad = JSON.parse(e.target.result);
		gameFrame.contentWindow.location.replace(location.origin + "/game");
		loadingIndicator.classList.add("active");
	});
	reader.readAsText(file);
});

// set up the background cards effect
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");
if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}