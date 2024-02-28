import {InitState} from "./initState.mjs";
import {ReplayInitState} from "./replayInitState.mjs";
import {locale} from "/scripts/locale.mjs";
import {incomingSdp} from "./netcode.mjs";

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
		name: localStorage.getItem("username")? localStorage.getItem("username") : locale.chat.you,
		profilePicture: localStorage.getItem("profilePicture"),
		deck: null,
		language: localStorage.getItem("language")
	}
];

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
			new InitState(e.data.isCaller, e.data.gameMode, e.data.automatic, e.data.websocketUrl);
			break;
		}
		case "replay": {
			new ReplayInitState(e.data.data);
			break;
		}
		case "sdp": {
			incomingSdp(e.data.sdp);
			break;
		}
	}
});

window.top.postMessage({type: "ready"});