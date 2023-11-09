// This module exports a list of functions that need to be accessible as buttons on specific cards.

import {locale} from "/modules/locale.js";
import {openCardSelect} from "/modules/gameUI.js";
import {putChatMessage} from "/modules/generalUI.js";
import {socket} from "/modules/netcode.js";

export let cardActions = {
	"I00040": {
		"roll": function() {
			let result = Math.floor(Math.random() * 6) + 1;
			putChatMessage(locale.cardActions.I00040.yourRoll.replace("{#RESULT}", result), "notice");
			socket.send("[dice]" + result);
		}
	},
	"U00286": {
		"scan": function() {
			socket.send("[laplaceScan]");
			openCardSelect(localPlayer.next().deckZone);
		}
	}
}