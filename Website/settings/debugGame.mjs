// All the necessary stuff to start a game against a do-nothing AI.

import {AI} from "../rulesEngine/src/aiSystems/ai.mjs";

export class DebugAI extends AI {
	async selectMove(optionList, player) {
		// Pass if you can
		for (const option of optionList) {
			if (option.type === "pass") {
				return {type: "pass"};
			}
		}

		// Skip the battle phase
		if (optionList.find(r => r.type === "enterBattlePhase")) {
			return {type: "enterBattlePhase", value: false};
		}

		// Just pick the first valid choice otherwise
		return {
			type: optionList[0].type,
			value: (await optionList[0].generateValidResponses().next()).value
		}
	}
}

const debugGameWindows = [];

export function startDebugGame() {
	debugGameWindows.push(window.open(location.href.substring(0, location.href.indexOf("/")) + "/game/index.html", "_blank", "popup"));
}

window.addEventListener("message", e => {
	if (!debugGameWindows.includes(e.source)) return;

	switch (e.data.type) {
		case "ready": {
			e.source.opponentAi = new DebugAI();
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