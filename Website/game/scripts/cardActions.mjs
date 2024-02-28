// This module exports a list of functions that need to be accessible as buttons on specific cards.

import {locale} from "/scripts/locale.mjs";
import {openCardSelect} from "./gameUI.mjs";
import {netSend} from "./netcode.mjs";

export let cardActions = {
	"I00040": {
		"roll": function() {
			let result = Math.floor(Math.random() * 6) + 1;
			chat.putMessage(locale.cardActions.I00040.yourRoll.replace("{#RESULT}", result), "notice");
			netSend("[dice]" + result);
		}
	},
	"U00286": {
		"scan": function() {
			netSend("[laplaceScan]");
			openCardSelect(localPlayer.next().deckZone);
		}
	}
}