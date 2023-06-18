// This module exports the getAutoResponse() function which the automatic simulator uses to figure out
// whether or not to automatically perform an action for the player, such as passing priority.

import * as phases from "/rulesEngine/phases.js";
import * as abilities from "/rulesEngine/abilities.js";
import * as ast from "/rulesEngine/cdfScriptInterpreter/astNodes.js";

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
	if (importantRequests == 0 && localStorage.getItem("passOnOnlyOption") === "true") {
		return {type: "pass"};
	}

	return null;
}

function isImportant(request) {
	switch (request.type) {
		case "pass": {
			return false;
		}
		case "doStandardSummon": {
			if (!request.eligibleUnits.length == 0) {
				return false;
			}
			break;
		}
		case "deployItem": {
			if (request.eligibleItems.length == 0) {
				return false;
			}
			break;
		}
		case "castSpell": {
			if (request.eligibleSpells.length == 0) {
				return false;
			}
			break;
		}
		case "doRetire": {
			if (request.eligibleUnits.length == 1 && request.eligibleUnits[0].zone.type == "partner") {
				return false;
			}
			break;
		}
		case "activateOptionalAbility":
		case "activateFastAbility":
		case "activateTriggerAbility": {
			if (request.eligibleAbilities.length == 0) {
				return false;
			}
		}
	}

	if (localStorage.getItem("passOnStackTwo") === "true") {
		let currentStack = game.currentStack()
		if (currentStack && currentStack.index > 1 && currentStack.blocks.length == 0) {
			if (request.type != "activateTriggerAbility") {
				return false;
			}
		}
	}

	let currentPhase = game.currentPhase();
	if (((currentPhase instanceof phases.DrawPhase) && localStorage.getItem("passInDrawPhase") === "true") ||
		((currentPhase instanceof phases.EndPhase) && localStorage.getItem("passInEndPhase") === "true")
	) {
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
							if (ability.condition && hasPhaseEqualityCondition(ability.condition)) {
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

function hasPhaseEqualityCondition(node) {
	if (node instanceof ast.EqualsNode && (node.leftSide instanceof ast.CurrentPhaseNode || node.rightSide instanceof ast.CurrentPhaseNode)) {
		return true;
	}
	for (let childNode of expression.getChildNodes()) {
		if (hasPhaseEqualityCondition(childNode)) {
			return true;
		}
	}
}