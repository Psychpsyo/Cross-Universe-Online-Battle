import {AI} from "../rulesEngine/src/aiSystems/ai.mjs";

export class DebugAI extends AI {
	async selectMove(optionList, player) {
		for (const option of optionList) {
			if (option.type === "pass") {
				return {type: "pass"};
			}
		}

		return {
			type: optionList[0].type,
			value: await optionList[0].generateValidResponses().next()
		}
	}
}

const debugGameWindows = [];

export function startDebugGame() {
	debugGameWindows.push(window.open(location.href.substring(0, location.href.indexOf("/")) + "/game/index.html", "_blank", "popup"));
}

window.addEventListener("message", e => {
	console.log(e);
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