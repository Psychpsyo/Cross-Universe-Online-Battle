import {AI} from "../rulesEngine/src/aiSystems/baseAI.mjs";
import * as autopass from "../game/scripts/autopass.mjs";
import * as requests from "../rulesEngine/src/inputRequests.mjs";

export class TutorialAI extends AI {
	async selectMove(optionList, player) {
		const autoResponse = autopass.getAutoResponse(player.game, optionList, false, true);
		if (autoResponse) return autoResponse;

		switch (player.game.currentTurn().index) {
			case 0: {
				for (const option of optionList) {
					if (option.type !== "doStandardSummon") continue;

					for (const card of option.eligibleUnits) {
						if (card.cardId === "U00044") {
							return {
								type: "doStandardSummon",
								value: player.handZone.cards.indexOf(card)
							};
						}
					}
				}
			}
		}

		for (const option of optionList) {
			if (option.type === "pass") {
				return {type: "pass"};
			}
		}

		// TODO: fallback: choose at random
		while (optionList.length > 0) {
			const option = optionList.splice(Math.floor(Math.random() * optionList.length), 1)[0];
			const responses = [];
			for (const response of requests[option.type].generateValidResponses(option)) {
				responses.push(response);
			}
			if (responses.length === 0) continue;
			return {
				type: option.type,
				value: responses[Math.floor(Math.random() * responses.length)]
			};
		}
	}
}