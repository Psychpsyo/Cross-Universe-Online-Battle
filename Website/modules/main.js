import {locale} from "/modules/locale.js";
import {startEffect} from "/modules/levitationEffect.js";

// global variables
window.game = null;
window.localPlayer = null;
window.gameState = null;
window.youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and partner selection, as far as the board is concerned, the local player is always player 1.)

window.players = [
	{
		name: locale.chat.opponent,
		profilePicture: "S00093",
		deck: null,
		language: null
	},
	{
		name: localStorage.getItem("username"),
		profilePicture: localStorage.getItem("profilePicture"),
		deck: null,
		language: localStorage.getItem("language")
	}
];
if (players[1].name == "") {
	players[1].name = locale.chat.you;
}

// randomizing the default room code
function randomizeRoomcode() {
	let roomcode = 10000 + (Math.floor(Math.random() * 90000));
	roomCodeInputField.placeholder = roomcode;
	roomCodeInputField.value = roomcode;
}

function getRoomcode() {
	return roomCodeInputField.value == ""? roomCodeInputField.placeholder : roomCodeInputField.value;
}

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

	websocketUrl ??= localStorage.getItem("websocketUrl") === ""? "wss://battle.crossuniverse.net:443/ws/" : localStorage.getItem("websocketUrl");

	// This is not imported up-front on pageload since it imports a bunch of other stuff itself
	// and is not needed right away.
	import("/modules/initState.js").then(initModule => {
		try {
			new initModule.InitState(getRoomcode(), gameModeSelect.value, websocketUrl);
		} catch {
			roomCodeInputFieldHolder.hidden = false;
			waitingForOpponentHolder.hidden = true;
			alert("Failed to connect to '" + websocketUrl + "'.");
		}
	});
}

// check if a room code is given in the query string
let queryString = new URLSearchParams(window.location.search);
if (queryString.get("id")) {
	roomCodeInputField.placeholder = queryString.get("id");
	let gameMode = queryString.get("m");
	if (!["normal", "draft", "normalAutomatic"].includes(gameMode)) {
		gameMode = "normal";
	}
	gameModeSelect.value = gameMode;
	connect(queryString.get("s"));
} else {
	randomizeRoomcode();
}


// translate main menu
roomCodeInputTitle.textContent = locale.mainMenu.roomCodeInputTitle;
roomCodeInputLabel.textContent = locale.mainMenu.enterRoomcode;
roomCodeRefresh.setAttribute("aria-label", locale.mainMenu.rerollRoomcode);

gameModeSelectorLabel.textContent = locale.mainMenu.gamemode;
gameModeNormalOption.textContent = locale.mainMenu.gamemodes.normal;
gameModeDraftOption.textContent = locale.mainMenu.gamemodes.draft;
gameModeNormalAutomaticOption.textContent = locale.mainMenu.gamemodes.normalAutomatic;

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
	gameState.cancel();
	gameState = null;
});
// generating an invite link
copyInviteLink.addEventListener("click", function() {
	let inviteURL = location.origin + "?id=" + encodeURIComponent(getRoomcode());
	if (gameModeSelect.value !== "normal") {
		inviteURL += "&m=" + encodeURIComponent(gameModeSelect.value);
	}
	navigator.clipboard.writeText(inviteURL);
	copyInviteLink.textContent = locale.mainMenu.inviteLinkCopied;
});
copyInviteLink.addEventListener("mouseleave", function() {
	setTimeout(function() {
		if (typeof copyInviteLink !== "undefined") {
			copyInviteLink.textContent = locale.mainMenu.copyInviteLink;
		}
	}, 500);
});

// handle hotkeys
document.addEventListener("keydown", async function(e) {
	for (const [name, hotkey] of Object.entries(hotkeys)) {
		if (hotkey.keyCode === e.code && hotkey.ctrl === e.ctrlKey && hotkey.shift === e.shiftKey && hotkey.alt === e.altKey) {
			switch(name) {
				case "chat": {
					if (!gameDiv.hidden) {
						document.getElementById("chatInput").focus();
						e.preventDefault();
					}
					break;
				}
				default: {
					gameState?.hotkeyPressed(name);
				}
			}
		}
	}
});

// drag&drop loading for replays
roomCodeEntry.addEventListener("dragover", function(e) {
	e.preventDefault();
});
roomCodeEntry.addEventListener("drop", function(e) {
	e.preventDefault();
	let file = e.dataTransfer.items[0].getAsFile();
	if (!file || !file.name.endsWith(".replay")) {
		return;
	}

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