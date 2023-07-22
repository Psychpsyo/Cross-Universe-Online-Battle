
import {Timing} from "./timings.js";
import {FieldZone} from "./zones.js";
import {createCardsAttackedEvent} from "./events.js";
import * as game from "./game.js";
import * as actions from "./actions.js";
import * as abilities from "./abilities.js";

function* arrayTimingGenerator(actionArrays) {
	for (let actionList of actionArrays) {
		yield actionList;
	}
}

// Base class for all blocks
class Block {
	constructor(stack, player, timingGenerator, costTimingGenerator = null) {
		this.player = player;
		this.stack = stack;
		this.costTimingGenerator = costTimingGenerator;
		this.costTimings = [];
		this.timingGenerator = timingGenerator;
		this.executionTimings = [];
		this.isCancelled = false;
	}

	async* runCost() {
		if (!this.costTimingGenerator) {
			return true;
		}
		let costTimingSuccess = true;
		let timing = yield* this.getNextTiming(this.costTimingGenerator, null);
		while (timing) {
			for (let action of timing.actions) {
				action.costIndex = 0;
			}
			this.costTimings.push(timing);
			await (yield* timing.run());
			for (const followup of timing.followupTimings) {
				this.costTimings.push(followup);
			}
			if (!timing.successful) {
				costTimingSuccess = false;
				// We only need to pop 1 since unsuccessful timings never have followups
				this.costTimings.pop();
				break;
			}
			timing = yield* this.getNextTiming(this.costTimingGenerator, timing);
		}
		if (!costTimingSuccess) {
			await (yield* this.undoCost());
		}
		return costTimingSuccess;
	}

	async* run() {
		if (this.getIsCancelled()) {
			return;
		}
		let timing = yield* this.getNextTiming(this.timingGenerator, null);
		while(timing) {
			this.executionTimings.push(timing);
			await (yield* timing.run());
			for (const followup of timing.followupTimings) {
				this.executionTimings.push(followup);
			}
			if (!timing.successful) {
				// We only need to pop 1 since unsuccessful timings never have followups
				this.executionTimings.pop();
			}
			timing = yield* this.getNextTiming(this.timingGenerator, timing);
		}
	}

	* getNextTiming(timingGenerator, previousTiming) {
		let generatorOutput = timingGenerator.next(previousTiming);
		while (!generatorOutput.done && (generatorOutput.value.length == 0 || !(generatorOutput.value[0] instanceof actions.Action))) {
			generatorOutput = timingGenerator.next(yield generatorOutput.value);
		}
		if (generatorOutput.done) {
			return null;
		}
		return new Timing(this.stack.phase.turn.game, generatorOutput.value, this);
	}

	async* undoCost() {
		for (let i = this.costTimings.length - 1; i >= 0; i--) {
			yield* this.costTimings[i].undo();
		}
	}

	async* undoExecution() {
		for (let i = this.executionTimings.length - 1; i >= 0; i--) {
			yield* this.executionTimings[i].undo();
		}
	}

	getIsCancelled() {
		return this.isCancelled;
	}

	getCostTimings() {
		return this.costTimings;
	}
	getExecutionTimings() {
		return this.executionTimings;
	}
	getCostActions() {
		return this.costTimings.map(timing => timing.actions).flat();
	}
	getExecutionActions() {
		return this.executionTimings.map(timing => timing.actions).flat();
	}
}

export class StandardDraw extends Block {
	constructor(stack, player) {
		super(stack, player, arrayTimingGenerator([
			[new actions.Draw(player, 1)]
		]));
	}

	async* runCost() {
		if (await (yield* super.runCost())) {
			this.stack.phase.turn.hasStandardDrawn = true;
			return true;
		}
		return false;
	}
}

export class StandardSummon extends Block {
	constructor(stack, player, card) {
		let placeAction = new actions.Place(player, card, player.unitZone);
		super(stack, player,
			arrayTimingGenerator([
				[new actions.Summon(player, placeAction)]
			]),
			arrayTimingGenerator([[
				placeAction,
				new actions.ChangeMana(player, -card.values.level)
			]]
		));
		this.card = card;
	}

	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}
		this.card = this.card.snapshot();
		this.stack.phase.turn.hasStandardSummoned = this.card;
		return true;
	}
}

function* retireTimingGenerator(player, units) {
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

export class Retire extends Block {
	constructor(stack, player, units) {
		super(stack, player, retireTimingGenerator(player, units));
		this.units = units;
		for (let unit of units) {
			unit.inRetire = this;
		}
	}

	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.stack.phase.turn.hasRetired = [];
		return true;
	}
}

export class AttackDeclaration extends Block {
	constructor(stack, player, attackers) {
		super(stack, player, arrayTimingGenerator([
			[new actions.EstablishAttackDeclaration(player, attackers)]
		]));
		this.attackers = attackers;
	}

	async* run() {
		yield* super.run();

		this.attackTarget = this.executionTimings[0].actions[0].attackTarget; // already a snapshot
		this.stack.phase.turn.game.currentAttackDeclaration = new game.AttackDeclaration(this.stack.phase.turn.game, this.attackers, this.attackTarget.cardRef);
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
	}
}

function* fightTimingGenerator(attackDeclaration) {
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

export class Fight extends Block {
	constructor(stack, player) {
		super(stack, player, fightTimingGenerator(stack.phase.turn.game.currentAttackDeclaration));
		this.attackDeclaration = stack.phase.turn.game.currentAttackDeclaration;
	}

	async* run() {
		this.attackDeclaration.clear();
		yield* super.run();
	}

	async* undoExecution() {
		yield* super.undoExecution();
		this.attackDeclaration.undoClear();
	}

	getIsCancelled() {
		return super.getIsCancelled() || this.attackDeclaration.isCancelled;
	}
}

function* abilityTimingGenerator(ability, card, player) {
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

function* abilityCostTimingGenerator(ability, card, player) {
	return yield* ability.runCost(card, player);
}

export class AbilityActivation extends Block {
	constructor(stack, player, card, ability) {
		super(stack, player, abilityTimingGenerator(ability, card, player), abilityCostTimingGenerator(ability, card, player));
		this.card = card;
		this.ability = ability;
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}

		// Needs to be checked after paying the cost in case paying the cost made some targets invalid.
		if (this.ability.exec && !(await this.ability.exec.hasAllTargets(this.card, this.player, this.ability))) {
			yield* this.undoCost();
			return false;
		}

		this.ability.successfulActivation();
		return true;
	}
}

function* combinedTimingGenerator(generators) {
	for (let timingGenerator of generators) {
		yield* timingGenerator;
	}
}

function* equipTimingGenerator(equipChoiceAction, player) {
	yield [new actions.EquipCard(equipChoiceAction.spellItem.cardRef, equipChoiceAction.chosenUnit.cardRef, player)];
}

export class DeployItem extends Block {
	constructor(stack, player, card) {
		let placeAction = new actions.Place(player, card, player.spellItemZone);
		let costTimingGenerators = [arrayTimingGenerator([[
			placeAction,
			new actions.ChangeMana(player, -card.values.level)
		]])];
		let execTimingGenerators = [
			arrayTimingGenerator([[new actions.Deploy(player, placeAction)]])
		];
		if (card.values.cardTypes.includes("equipableItem")) {
			let selectEquipableAction = new actions.SelectEquipableUnit(card, player);
			costTimingGenerators.unshift(arrayTimingGenerator([[selectEquipableAction]]));
			execTimingGenerators.unshift(equipTimingGenerator(selectEquipableAction, player));
		}
		let deployAbility = null;
		for (let ability of card.values.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				deployAbility = ability;
				if (ability.cost) {
					costTimingGenerators.push(abilityCostTimingGenerator(ability, card, player));
				}
				if (card.values.cardTypes.includes("standardItem")) {
					// standard items first activate and are only treated as briefly on the field after
					execTimingGenerators.unshift(abilityTimingGenerator(ability, card, player));
					// and are then discarded.
					execTimingGenerators.push(arrayTimingGenerator([[new actions.Discard(card)]]));
				} else {
					execTimingGenerators.push(abilityTimingGenerator(ability, card, player));
				}
				// cards only ever have one of these
				break;
			}
		}
		super(stack, player,
			combinedTimingGenerator(execTimingGenerators),
			combinedTimingGenerator(costTimingGenerators)
		);
		this.card = card;
		this.deployAbility = deployAbility;
	}

	async* runCost() {
		if (!(await (yield* super.runCost()))) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}

		// Needs to be checked after paying the cost in case paying the cost made some targets invalid.
		if (this.deployAbility && this.deployAbility.exec && !(await this.deployAbility.exec.hasAllTargets(this.card, this.player, this.deployAbility))) {
			yield* this.undoCost();
			this.card.zone.add(this.card, this.card.index);
			return false;
		}

		this.card = this.card.snapshot();
		return true;
	}
}

export class CastSpell extends Block {
	constructor(stack, player, card) {
		let placeAction = new actions.Place(player, card, player.spellItemZone);
		let costTimingGenerators = [arrayTimingGenerator([[
			new actions.Place(player, card, player.spellItemZone),
			new actions.ChangeMana(player, -card.values.level)
		]])];
		let execTimingGenerators = [
			arrayTimingGenerator([[new actions.Cast(player, placeAction)]])
		];
		if (card.values.cardTypes.includes("enchantSpell")) {
			let selectEquipableAction = new actions.SelectEquipableUnit(card, player);
			costTimingGenerators.unshift(arrayTimingGenerator([[selectEquipableAction]]));
			execTimingGenerators.unshift(equipTimingGenerator(selectEquipableAction, player));
		}
		let castAbility = null;
		for (let ability of card.values.abilities) {
			if (ability instanceof abilities.CastAbility) {
				castAbility = ability;
				if (ability.cost) {
					costTimingGenerators.push(abilityCostTimingGenerator(ability, card, player));
				}
				if (card.values.cardTypes.includes("standardSpell")) {
					// standard spells first activate and are only treated as briefly on the field after
					execTimingGenerators.unshift(abilityTimingGenerator(ability, card, player));
					// and are then discarded.
					execTimingGenerators.push(arrayTimingGenerator([[new actions.Discard(card)]]));
				} else {
					execTimingGenerators.push(abilityTimingGenerator(ability, card, player));
				}
				// cards only ever have one of these
				break;
			}
		}
		super(stack, player,
			combinedTimingGenerator(execTimingGenerators),
			combinedTimingGenerator(costTimingGenerators)
		);
		this.card = card;
		this.castAbility = castAbility;
	}

	async* runCost() {
		if (!(await (yield* super.runCost()))) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}

		// Needs to be checked after paying the cost in case paying the cost made some targets invalid.
		if (this.castAbility && this.castAbility.exec && !(await this.castAbility.exec.hasAllTargets(this.card, this.player, this.castAbility))) {
			yield* this.undoCost();
			this.card.zone.add(this.card, this.card.index);
			return false;
		}

		this.card = this.card.snapshot();
		return true;
	}
}