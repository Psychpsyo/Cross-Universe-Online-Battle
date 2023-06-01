import {locale} from "/modules/locale.js";
import {startEffect} from "/modules/levitationEffect.js";

// global variables
window.game = null;
window.localPlayer = null;
window.gameState = null;
window.opponentName = null;
window.youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and partner selection, as far as the board is concerned, the local player is always player 1.)

// translate main menu
roomCodeInputTitle.textContent = locale.mainMenu.roomCodeInputTitle;
roomCodeInputLabel.textContent = locale.mainMenu.enterRoomcode;
roomCodeRefresh.setAttribute("aria-label", locale.mainMenu.rerollRoomcode);

gameModeSelectorLabel.textContent = locale.mainMenu.gamemode;
gameModeNormalOption.textContent = locale.mainMenu.gamemodes.normal;
gameModeDraftOption.textContent = locale.mainMenu.gamemodes.draft;
gameModeNormalAutomaticOption.textContent = locale.mainMenu.gamemodes.normalAutomatic;

connectBtn.textContent = locale.mainMenu.connectToRoom;
trWaitingForOpponent.textContent = locale.mainMenu.waitingForOpponent;
cancelWaitingBtn.textContent = locale.mainMenu.cancelWaiting;
unofficialNotice.innerHTML = locale.mainMenu.unofficialNotice;
rulesButton.textContent = locale.mainMenu.rulesButton;

rulesButton.href = locale.mainMenu.rulesLink;

settingsButton.textContent = locale.mainMenu.settingsButton;
deckMakerButton.textContent = locale.mainMenu.deckCreatorButton;

document.documentElement.lang = locale.code;
document.documentElement.removeAttribute("aria-busy");

// randomize default room code
function randomizeRoomcode() {
	let roomcode = 10000 + (Math.floor(Math.random() * 90000));
	roomCodeInputField.placeholder = roomcode;
	roomCodeInputField.value = roomcode;
}
roomCodeRefresh.addEventListener("click", function() {
	randomizeRoomcode();
	roomCodeInputField.setAttribute("aria-live", "polite");
});
randomizeRoomcode();

// connecting
export function connect() {
	// I don't want to import this up-front on pageload since it imports a bunch of other stuff itself.
	import("/modules/initState.js").then(initModule => {
		gameState = new initModule.InitState(roomCodeInputField.value == ""? roomCodeInputField.placeholder : roomCodeInputField.value, gameModeSelect.value);
	});
}
// pressing enter in the roomcode entry field to connect
document.getElementById("roomCodeInputField").addEventListener("keyup", function() {
	if (event.keyCode === 13) {
		connect();
	}
});
// clicking the connect button to connect
document.getElementById("connectBtn").addEventListener("click", connect);

// canceling a connection
document.getElementById("cancelWaitingBtn").addEventListener("click", function() {
	gameState.cancel();
	gameState = null;
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

// set up the background cards effect
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");
if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}