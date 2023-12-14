import {InitState} from "./initState.js";
import {locale} from "/modules/locale.js";

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
					gameState?.hotkeyPressed(name);
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
	}
});

window.top.postMessage({type: "ready"});