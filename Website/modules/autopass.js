// This module exports the getAutoResponse() function which the automatic simulator uses to figure out
// whether or not to automatically perform an action for the player, such as passing priority.

import * as phases from "/rulesEngine/phases.js";

// track ctrl to disable the autoresponder when it's held
let ctrlHeld = false;
window.addEventListener("keydown", function(e) {
	if (e.key == "Control") {
		ctrlHeld = true;
	}
});
window.addEventListener("keyup", function(e) {
	if (e.key == "Control") {
		ctrlHeld = false;
	}
});
window.addEventListener("blur", function(e) {
	ctrlHeld = false;
});

export function getAutoResponse(requests) {
	if (ctrlHeld) {
		return null;
	}

	// non-pass actions
	if (requests.length == 1) {
		let request = requests[0];
		if (request.type == "chooseCards") {
			if (Math.min(...request.validAmounts) == request.from.length) {
				let choice = [];
				for (let i = 0; i < request.from.length; i++) {
					choice.push(i);
				}
				return {
					type: "chooseCards",
					value: choice
				}
			}
		}
	}

	// passing
	if (!requests.find(request => request.type == "pass")) {
		return null;
	}

	let importantRequests = 0;
	for (let request of requests) {
		if (isImportant(request)) {
			importantRequests++;
		}
	}
	if (importantRequests == 0) {
		return {type: "pass"};
	}

	return null;
}

function isImportant(request) {
	if (request.type == "pass") {
		return false;
	}
	if (request.type == "doRetire" &&
		request.eligibleUnits.length == 1 &&
		request.eligibleUnits[0].zone.type == "partner"
	) {
		return false;
	}

	let currentPhase = game.currentPhase();
	if (currentPhase instanceof phases.DrawPhase) {
		return false;
	}
	if (currentPhase instanceof phases.EndPhase) {
		return false;
	}
	return true;
}
