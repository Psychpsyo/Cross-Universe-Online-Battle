import {OnlineInitState} from "./onlineInitState.mjs";
import {SingleplayerInitState} from "./singleplayerInitState.mjs";
import {ReplayInitState} from "./replayInitState.mjs";
import {SpectateInitState} from "./spectateInitState.mjs";
import {locale} from "../../scripts/locale.mjs";
import * as netcode from "./netcode.mjs";

// setup
document.documentElement.lang = locale.code;
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");

// global variables
window.game = null;
window.localPlayer = null;
window.gameState = null;

window.playerData = [
	{
		name: locale.chat.opponent,
		profilePicture: "S00093",
		deck: null,
		initialPartner: null,
		language: null,
		ingame: null // the rules engine player object associated with this player
	},
	{
		name: localStorage.getItem("username")? localStorage.getItem("username") : locale.chat.you,
		profilePicture: localStorage.getItem("profilePicture"),
		deck: null,
		initialPartner: null,
		language: localStorage.getItem("language"),
		ingame: null // the rules engine player object associated with this player
	}
];

// returns the window that messages should be posted to.
// For iframes, this is the parent window.
// For other windows, this is the opener.
window.callingWindow = window.parent !== window? window.parent : window.opener;

// handle hotkeys
document.addEventListener("keydown", async function(e) {
	for (const [name, hotkey] of Object.entries(hotkeys)) {
		if (hotkey.keyCode === e.code && hotkey.ctrl === e.ctrlKey && hotkey.shift === e.shiftKey && hotkey.alt === e.altKey) {
			switch(name) {
				case "chat": {
					if (!gameDiv.hidden) {
						chat.inputField.focus();
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
document.addEventListener("keyup", async function(e) {
	for (const [name, hotkey] of Object.entries(hotkeys)) {
		if (hotkey.keyCode === e.code && hotkey.ctrl === e.ctrlKey && hotkey.shift === e.shiftKey && hotkey.alt === e.altKey) {
			if (gameState?.hotkeyReleased(name)) {
				e.preventDefault();
			}
		}
	}
});

window.addEventListener("message", e => {
	switch (e.data.type) {
		case "singleplayer": {
			new SingleplayerInitState(e.data.decks, e.data.replay, e.data.useOldManaRule);
			break;
		}
		case "connect": {
			new OnlineInitState(
				e.data.isCaller,
				e.data.gameMode,
				e.data.automatic,
				e.data.useOldManaRule,
				e.data.draftFormat
			);
			break;
		}
		case "spectate": {
			new SpectateInitState();
			break;
		}
		case "replay": {
			new ReplayInitState(e.data.data);
			break;
		}
		case "sdp": {
			netcode.incomingSdp(e.data.sdp, e.data.negotiationIndex);
			break;
		}
		case "iceCandidate": {
			netcode.incomingIceCandidate(e.data.candidate, e.data.negotiationIndex);
		}
	}
});

callingWindow.postMessage({type: "ready"});