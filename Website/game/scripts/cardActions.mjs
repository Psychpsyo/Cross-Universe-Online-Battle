// This module exports a list of functions that need to be accessible as buttons on specific cards.

import localize from "../../scripts/locale.mjs";
import {openCardSelect} from "./gameUI.mjs";
import {netSend} from "./netcode.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";

async function rollDice(cardId) {
	// TODO: use distributed randomizer for this
	const result = Math.floor(Math.random() * 6) + 1;
	chat.putMessage(localize("cardActions.I00040.playerRolled", {
		PLAYER: localPlayer,
		CARDNAME: (await cardLoader.getCardInfo(cardId)).name,
		RESULT: result
	}), "notice");
	netSend("dice", `${result}|${cardId}`);
}

export const cardActions = {
	"U00286": {
		"scan": function() {
			netSend("laplaceScan");
			openCardSelect(localPlayer.next().deckZone);
		}
	},
	"S00238": {
		"roll": function() {
			rollDice("S00238");
		}
	},
	"I00040": {
		"roll": function() {
			rollDice("I00040");
		}
	}
}