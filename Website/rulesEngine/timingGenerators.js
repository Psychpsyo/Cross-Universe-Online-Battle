// This file contains timing generator functions and related utility functions

import {Timing} from "./timings.js";
import {FieldZone} from "./zones.js";
import {createCardsAttackedEvent} from "./events.js";
import * as actions from "./actions.js";

export class TimingRunner {
	constructor(generator) {
		this.generator = generator;
		this.timings = [];
	}

	async* run(block, asCost) {
		let timing = yield* getNextTiming(this.generator, null, block);
		while(timing) {
			if (asCost) {
				for (let action of timing.actions) {
					action.costIndex = 0;
				}
			}
			this.timings.push(timing);
			await (yield* timing.run());
			for (const followup of timing.followupTimings) {
				this.timings.push(followup);
			}
			if (!timing.successful) {
				// We only need to pop 1 since unsuccessful timings never have followups
				this.timings.pop();
				if (asCost) {
					return false;
				}
			}
			timing = yield* getNextTiming(this.generator, timing, block);
		}
		return true;
	}

	async* undo() {
		for (let i = this.timings.length - 1; i >= 0; i--) {
			yield* this.timings[i].undo();
		}
	}
}

export function* getNextTiming(timingGenerator, previousTiming, block) {
	let generatorOutput = timingGenerator.next(previousTiming);
	while (!generatorOutput.done && (generatorOutput.value.length == 0 || !(generatorOutput.value[0] instanceof actions.Action))) {
		generatorOutput = timingGenerator.next(yield generatorOutput.value);
	}
	if (generatorOutput.done) {
		return null;
	}
	return new Timing(block.player.game, generatorOutput.value, block);
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
	return yield* ability.runCost(card, player);
}

export function* abilityTimingGenerator(ability, card, player) {
	let timingGenerator = ability.run(card, player);
	let timing;
	let actionList;
	do {
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
	yield [new actions.EquipCard(equipChoiceAction.spellItem.cardRef, equipChoiceAction.chosenUnit.cardRef, player)];
}

export function* retireTimingGenerator(player, units) {
	let discardTiming = yield units.map(unit => new actions.Discard(unit));

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
	if (!attackDeclaration.isValid()) {
		return;
	}
	// RULES: Compare the attacker’s Attack to the target’s Defense.
	let totalAttack = 0;
	for (const unit of attackDeclaration.attackers) {
		totalAttack += unit.values.attack;
	}

	// RULES: If the Attack is greater the attacker destroys the target.
	yield [createCardsAttackedEvent(attackDeclaration.attackers, attackDeclaration.target)];
	if (totalAttack > attackDeclaration.target.values.defense) {
		let discard = new actions.Discard(attackDeclaration.target);
		let actionList = [new actions.Destroy(discard), discard];
		if (attackDeclaration.target.zone.type == "partner") {
			actionList.push(new actions.DealDamage(attackDeclaration.target.zone.player, totalAttack - attackDeclaration.target.values.defense));
		}
		yield actionList;
	}

	// RULES: If the unit wasn't destoyed, a 'counterattack' occurs.
	if (!(attackDeclaration.target.zone instanceof FieldZone)) {
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
		let discard = new actions.Discard(counterattackTarget);
		let actionList = [new actions.Destroy(discard), discard];
		if (counterattackTarget.zone.type == "partner") {
			actionList.push(new actions.DealDamage(counterattackTarget.zone.player, attackDeclaration.target.values.attack - counterattackTarget.values.defense));
		}
		yield actionList;
	}
}