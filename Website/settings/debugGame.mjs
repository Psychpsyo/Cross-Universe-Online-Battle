// All the necessary stuff to start a game against a do-nothing AI.

import {PassiveAI} from "../rulesEngine/src/aiSystems/passiveAI.mjs";

const debugGameWindows = [];

export function startDebugGame() {
	debugGameWindows.push(window.open(location.href.substring(0, location.href.indexOf("/")) + "/game/index.html", "_blank", "popup"));
}

window.addEventListener("message", e => {
	if (!debugGameWindows.includes(e.source)) return;

	switch (e.data.type) {
		case "ready": {
			e.source.opponentAi = new PassiveAI();
			e.source.postMessage({
				type: "singleplayer"
			});
			break;
		}
		case "gameStarted": {
			break;
		}
		case "leaveGame": {
			break;
		}
	}
});