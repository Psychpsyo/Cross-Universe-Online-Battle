// This module exports the getAutoResponse() function which the automatic simulator uses to figure out
// whether or not to automatically perform an action for the player, such as passing priority.

import * as phases from "/rulesEngine/phases.js";
import * as abilities from "/rulesEngine/abilities.js";

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
		switch (request.type) {
			case "chooseCards": {
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
				break;
			}
			case "activateTriggerAbility": {
				if (request.eligibleAbilities.length == 1) {
					return {
						type: "activateTriggerAbility",
						value: 0
					};
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
	if (request.type == "doStandardSummon" &&
		!request.player.handZone.cards.find(card => card.cardTypes.get().includes("unit"))
	) {
		return false;
	}
	if (request.type == "deployItem" &&
		!request.player.handZone.cards.find(card => card.cardTypes.get().includes("item"))
	) {
		return false;
	}
	if (request.type == "castSpell" &&
		!request.player.handZone.cards.find(card => card.cardTypes.get().includes("spell"))
	) {
		return false;
	}
	if (request.type == "doRetire" &&
		request.eligibleUnits.length == 1 &&
		request.eligibleUnits[0].zone.type == "partner"
	) {
		return false;
	}

	let currentPhase = game.currentPhase();
	if (currentPhase instanceof phases.DrawPhase || currentPhase instanceof phases.EndPhase) {
		switch (request.type) {
			case "activateTriggerAbility": {
				for (let ability of request.eligibleAbilities) {
					let phaseIndicator = ability.card.abilities.get()[ability.index].duringPhase;
					if (phaseIndicator && currentPhase.matches(phaseIndicator, request.player)) {
						return true;
					}
				}
				break;
			}
			case "castSpell": {
				for (let card of request.eligibleSpells) {
					for (let ability of card.abilities.get()) {
						if (ability instanceof abilities.CastAbility) {
							if (ability.duringPhase && currentPhase.matches(ability.duringPhase, request.player)) {
								return true;
							}
						}
					}
				}
				break;
			}
		}
		return false;
	}
	return true;
}
