import {locale} from "/modules/locale.js";
import {startEffect, stopEffect} from "/modules/levitationEffect.js";
import * as uiUtils from "/modules/uiUtils.js";

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

// receiving messages from the iframe
window.addEventListener("message", e => {
	if (e.source !== gameFrame.contentWindow) return;

	switch (e.data.type) {
		case "ready": {
			gameFrame.contentWindow.postMessage({
				type: "connect",
				roomCode: getRoomcode(),
				gameMode: gameModeSelect.value,
				websocketUrl: websocketUrl
			});
			break;
		}
		case "gameStarted": {
			stopEffect();
			roomCodeEntry.hidden = true;
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
			roomCodeEntry.hidden = false;
			gameFrame.src = "";
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

	gameFrame.src = location.origin + "/game";
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

// this is to make Chromium browsers work when the page reloads while the iframe is up.
window.scrollTo(0, 0);

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
unofficialNotice.innerHTML = locale.mainMenu.unofficialNotice;
rulesButton.textContent = locale.mainMenu.rulesButton;

rulesButton.href = locale.mainMenu.rulesLink;

settingsButton.textContent = locale.mainMenu.settingsButton;
deckMakerButton.textContent = locale.mainMenu.deckCreatorButton;

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
roomCodeEntry.addEventListener("dragover", function(e) {
	e.preventDefault();
});
roomCodeEntry.addEventListener("drop", function(e) {
	let file = e.dataTransfer.items[0].getAsFile();
	if (!file || !file.name.endsWith(".replay")) {
		return;
	}

	e.preventDefault();

	let reader = new FileReader();
	reader.onload = function(e) {
		import("/modules/replayInitState.js").then(initModule => {
			new initModule.ReplayInitState(JSON.parse(e.target.result));
		});
	};
	reader.readAsText(file);
});

// set up the background cards effect
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");
if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}