// This file contains timing generator functions and related utility functions

import {Timing, runInterjectedTimings} from "./timings.js";
import {createCardsAttackedEvent} from "./events.js";
import {FieldZone} from "./zones.js";
import * as actions from "./actions.js";
import * as requests from "./inputRequests.js";

export class TimingRunner {
	constructor(generatorFunction, game) {
		this.generatorFunction = generatorFunction;
		this.game = game;
		this.isCost = false;
		this.timings = [];
	}

	async* run(isPrediction = false) {
		for (const timing of await (yield* runInterjectedTimings(this.game, isPrediction, this.actions))) {
			this.timings.push(timing);
		}

		let generator = this.generatorFunction();
		let timing = yield* this.getNextTiming(generator, null);
		while(timing) {
			if (this.isCost) {
				for (let action of timing.actions) {
					action.costIndex = 0;
				}
			}
			this.timings.push(timing);
			await (yield* timing.run(isPrediction));
			for (const followup of timing.followupTimings) {
				this.timings.push(followup);
			}
			if (!timing.successful) {
				// We only need to pop 1 since unsuccessful timings never have followups
				this.timings.pop();
				if (this.isCost) {
					return false;
				}
			}
			timing = yield* this.getNextTiming(generator, timing);
		}
		return true;
	}

	* getNextTiming(timingGenerator, previousTiming) {
		let generatorOutput = timingGenerator.next(previousTiming);
		while (!generatorOutput.done && (generatorOutput.value.length == 0 || !(generatorOutput.value[0] instanceof actions.Action))) {
			generatorOutput = timingGenerator.next(yield generatorOutput.value);
		}
		if (generatorOutput.done) {
			return null;
		}
		return new Timing(this.game, generatorOutput.value);
	}

	* undo() {
		for (let i = this.timings.length - 1; i >= 0; i--) {
			yield* this.timings[i].undo();
		}
		this.timings = [];
	}

	// starts a new generator and plays it through with the given player choices, then returns it.
	async fastForward(playerChoices) {
		let generator = this.run();
		let events = await generator.next();
		while (!events.done && (playerChoices.length > 0 || events.value[0].nature !== "request")) {
			if (events.value[0].nature === "request") {
				events = await generator.next(playerChoices.shift());
			} else {
				events = await generator.next();
			}
		}
		return generator;
	}
}

class OptionTreeNode {
	constructor(parent, choice) {
		this.parent = parent;
		this.choice = choice;
		this.childNodes = [];
		this.valid = false;
	}
}

// Generates a tree of all player choices for a TimingRunner, tagged for validity, based on endOfTreeCheck
// Branches in which the runner does not complete sucessfully are also tagged as invalid.
export async function generateOptionTree(runner, endOfTreeCheck, generator = null, lastNode = null, lastChoice = null) {
	if (generator === null) {
		generator = runner.run(true);
	}
	let node = new OptionTreeNode(lastNode, lastChoice);
	let events = await generator.next(lastChoice);
	// go to next user input request
	while (!events.done && events.value[0].nature !== "request") {
		events = await generator.next();
	}
	// if we are at a user input request, generate child nodes
	if (!events.done) {
		let validResponses = requests[events.value[0].type].generateValidResponses(events.value[0]);
		for (const response of validResponses) {
			let child = await generateOptionTree(runner, endOfTreeCheck, generator, node, {type: events.value[0].type, value: response});
			node.childNodes.push(child);
			if (child.valid) {
				node.valid = true;
			}
			// and then we need to advance the branch to this node again.
			let currentNode = node;
			let responses = [];
			while (currentNode.parent) {
				responses.push(currentNode.choice);
				currentNode = currentNode.parent;
			}
			generator = await runner.fastForward(responses.reverse());
		}
	} else {
		// this tree branch is done.
		node.valid = events.value && endOfTreeCheck();
	}
	let undoGenerator = runner.undo();
	while(!undoGenerator.next().done) {}
	return node;
}

// It follows: all different types of timing generators
export function* arrayTimingGenerator(actionArrays) {
	for (let actionList of actionArrays) {
		yield actionList;
	}
}

export function* combinedTimingGenerator(generators) {
	for (let timingGenerator of generators) {
		yield* timingGenerator;
	}
}

export function* abilityCostTimingGenerator(ability, card, player) {
	let timingGenerator = ability.runCost(card, player);
	let timing;
	let actionList;
	do {
		if (ability.isCancelled) {
			return;
		}
		actionList = timingGenerator.next(timing);
		if (!actionList.done) {
			if (actionList.value.length == 0) {
				return;
			}
			timing = yield actionList.value;
		}
	} while (!actionList.done && (!(timing instanceof Timing) || timing.successful));
}

export function* abilityTimingGenerator(ability, card, player) {
	let timingGenerator = ability.run(card, player);
	let timing;
	let actionList;
	do {
		if (ability.isCancelled) {
			return;
		}
		actionList = timingGenerator.next(timing);
		if (!actionList.done) {
			if (actionList.value.length == 0) {
				return;
			}
			timing = yield actionList.value;
		}
	} while (!actionList.done && (!(timing instanceof Timing) || timing.successful));
}

export function* equipTimingGenerator(equipChoiceAction, player) {
	yield [new actions.EquipCard(player, equipChoiceAction.spellItem.current(), equipChoiceAction.chosenUnit.current())];
}

export function* retireTimingGenerator(player, units) {
	let discardTiming = yield units.map(unit => new actions.Discard(player, unit, true));

	let gainedMana = 0;
	for (const action of discardTiming.actions) {
		if (action instanceof actions.Discard) {
			gainedMana += action.card.values.level;
		}
	}
	if (gainedMana > 0) {
		yield [new actions.ChangeMana(player, gainedMana)];
	}
}

export function* fightTimingGenerator(attackDeclaration) {
	if (attackDeclaration.target === null || attackDeclaration.attackers.length === 0) {
		return;
	}
	// RULES: Compare the attacker’s Attack to the target’s Defense.
	let totalAttack = 0;
	let doLifeDamage = true;
	for (const unit of attackDeclaration.attackers) {
		totalAttack += unit.values.attack;
		if (!unit.values.doLifeDamage) {
			doLifeDamage = false;
		}
	}

	// RULES: If the Attack is greater the attacker destroys the target.
	yield [createCardsAttackedEvent(attackDeclaration.attackers, attackDeclaration.target)];
	if (totalAttack > attackDeclaration.target.values.defense) {
		let discard = new actions.Discard(attackDeclaration.target.owner, attackDeclaration.target);
		let actionList = [new actions.Destroy(discard), discard];
		if (attackDeclaration.target.zone.type == "partner") {
			actionList.push(new actions.DealDamage(
				attackDeclaration.target.currentOwner(),
				doLifeDamage? totalAttack - attackDeclaration.target.values.defense : 0
			));
		}
		yield actionList;
	}

	// RULES: If the unit wasn't destoyed, a 'counterattack' occurs.
	if (attackDeclaration.target === null) {
		return;
	}

	let counterattackTarget;
	if (attackDeclaration.attackers.length == 1) {
		counterattackTarget = attackDeclaration.attackers[0];
	} else {
		for (const unit of attackDeclaration.attackers) {
			if (unit.zone.type == "partner") {
				counterattackTarget = unit;
				break;
			}
		}
	}

	yield [createCardsAttackedEvent([attackDeclaration.target], counterattackTarget)];
	if (attackDeclaration.target.values.attack > counterattackTarget.values.defense) {
		let discard = new actions.Discard(counterattackTarget.owner, counterattackTarget);
		let actionList = [new actions.Destroy(discard), discard];
		if (counterattackTarget.zone.type == "partner") {
			actionList.push(new actions.DealDamage(
				counterattackTarget.currentOwner(),
				attackDeclaration.target.values.doLifeDamage? attackDeclaration.target.values.attack - counterattackTarget.values.defense : 0
			));
		}
		yield actionList;
	}
}

export function* spellItemDiscardGenerator(player, spellItem) {
	if (spellItem.zone instanceof FieldZone) {
		yield [new actions.Discard(player, spellItem)];
	}
}