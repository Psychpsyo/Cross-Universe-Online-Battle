// This module exports a list of functions that need to be accessible as buttons on specific cards.

import {locale} from "/modules/locale.js";
import {socket} from "/modules/netcode.js";
import {putChatMessage} from "/modules/generalUI.js";

export let cardActions = {
	"I00040": {
		"roll": function() {
			let result = Math.floor(Math.random() * 6) + 1;
			putChatMessage(locale.cardActions.I00040.yourRoll.replace("{#RESULT}", result), "notice");
			socket.send("[dice]" + result);
		}
	}
}