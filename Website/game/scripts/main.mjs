import {InitState} from "./initState.mjs";
import {ReplayInitState} from "./replayInitState.mjs";
import {locale} from "/scripts/locale.mjs";

document.documentElement.lang = locale.code;

// global variables
window.game = null;
window.localPlayer = null;
window.gameState = null;

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
					if (gameState?.hotkeyPressed(name)) {
						e.preventDefault();
					}
				}
			}
		}
	}
});

window.addEventListener("message", e => {
	switch (e.data.type) {
		case "connect": {
			new InitState(e.data.roomCode, e.data.gameMode, e.data.websocketUrl);
			break;
		}
		case "replay": {
			new ReplayInitState(e.data.data);
			break;
		}
	}
});

window.top.postMessage({type: "ready"});