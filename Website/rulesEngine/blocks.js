
import {Timing} from "./timings.js";
import {FieldZone} from "./zones.js";
import {createCardsAttackedEvent} from "./events.js";
import * as game from "./game.js";
import * as actions from "./actions.js";
import * as abilities from "./abilities.js";

async function* arrayTimingGenerator(actionArrays) {
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
		this.costTiming = null;
		this.timingGenerator = timingGenerator;
		this.executionTimings = [];
	}

	async* prepareCostTiming() {
		let generatorOutput = await this.costTimingGenerator.next();
		while (true) {
			let actionList = generatorOutput.value;
			// Needs to first check for updates (events or requests) returned by the timing generator.
			if (actionList.length == 0 || !(actionList[0] instanceof actions.Action)) {
				generatorOutput = await this.costTimingGenerator.next(yield actionList);
				continue;
			}
			for (let action of actionList) {
				action.costIndex = 0;
			}
			this.costTiming = new Timing(this.stack.phase.turn.game, actionList, this);
			break;
		}
	}
	async* runCost() {
		if (this.costTimingGenerator == null) {
			return true;
		}
		yield* this.prepareCostTiming();
		yield* this.costTiming.run();
		return this.costTiming.successful;
	}

	async* run() {
		let generatorOutput = await this.timingGenerator.next();
		while(!generatorOutput.done) {
			let actionList = generatorOutput.value;
			// Needs to first check for updates (events or requests) returned by the timing generator.
			if (actionList.length == 0 || !(actionList[0] instanceof actions.Action)) {
				generatorOutput = await this.timingGenerator.next(yield actionList);
				continue;
			}
			let timing = new Timing(this.stack.phase.turn.game, actionList, this);
			yield* timing.run();
			if (timing.successful) {
				this.executionTimings.push(timing);
			}
			generatorOutput = await this.timingGenerator.next(timing);
		}
	}

	getCostTiming() {
		return this.costTiming;
	}
	getExecutionTimings() {
		return this.executionTimings;
	}
	getCostActions() {
		return this.costTiming?.actions ?? [];
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
}

export class StandardSummon extends Block {
	constructor(stack, player, card, unitZoneIndex) {
		super(stack, player,
			arrayTimingGenerator([
				[new actions.Summon(player, card, player.unitZone, unitZoneIndex)]
			]),
			arrayTimingGenerator([[
				new actions.Place(player, card, player.unitZone, unitZoneIndex),
				new actions.ChangeMana(player, -card.level.get())
			]]
		));
		this.card = card;
		this.unitZoneIndex = unitZoneIndex;
	}

	async* runCost() {
		this.card.zone.remove(this.card);
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

async function* retireTimingGenerator(player, units) {
	let discardTiming = yield units.map(unit => new actions.Discard(unit));

	let gainedMana = 0;
	for (const action of discardTiming.actions) {
		if (action instanceof actions.Discard) {
			gainedMana += action.card.level.get();
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

async function* fightTimingGenerator(attackDeclaration) {
	attackDeclaration.game.currentAttackDeclaration = null;
	if (!attackDeclaration.isValid()) {
		return;
	}
	// RULES: Compare the attacker’s Attack to the target’s Defense.
	let totalAttack = 0;
	for (const unit of attackDeclaration.attackers) {
		totalAttack += unit.attack.get();
	}

	// RULES: If the Attack is greater the attacker destroys the target.
	yield [createCardsAttackedEvent(attackDeclaration.attackers, attackDeclaration.target)];
	if (totalAttack > attackDeclaration.target.defense.get()) {
		let actionList = [new actions.Destroy(attackDeclaration.target)];
		if (attackDeclaration.target.zone.type == "partner") {
			actionList.push(new actions.DealDamage(attackDeclaration.target.zone.player, totalAttack - attackDeclaration.target.defense.get()));
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
	if (attackDeclaration.target.attack.get() > counterattackTarget.defense.get()) {
		let actionList = [new actions.Destroy(counterattackTarget)];
		if (counterattackTarget.zone.type == "partner") {
			actionList.push(new actions.DealDamage(counterattackTarget.zone.player, attackDeclaration.target.attack.get() - counterattackTarget.defense.get()));
		}
		yield actionList;
	}
}

export class Fight extends Block {
	constructor(stack, player) {
		super(stack, player, fightTimingGenerator(stack.phase.turn.game.currentAttackDeclaration));
	}
}

async function* abilityTimingGenerator(ability, card, player) {
	let timingGenerator = ability.run(card, player);
	let timing;
	let actionList;
	do {
		actionList = (await timingGenerator.next(timing));
		if (!actionList.done) {
			timing = yield actionList.value;
		}
	} while (!actionList.done && (!(timing instanceof Timing) || timing.successful));
}

async function* abilityCostTimingGenerator(ability, card, player) {
	yield* ability.runCost(card, player);
}

export class AbilityActivation extends Block {
	constructor(stack, player, card, ability) {
		super(stack, player, abilityTimingGenerator(ability, card, player), ability.cost? abilityCostTimingGenerator(ability, card, player) : null);
		this.card = card;
		this.ability = ability;
	}

	async* runCost() {
		if (this.ability.cost && !(await (yield* this.ability.cost.hasAllTargets(this.card, this.player, this.ability)))) {
			return false;
		}
		if (this.costTimingGenerator) {
			yield* this.prepareCostTiming();
		}
		// Check available prerequisite after the player has made at-activation-time choices but before they paid the cost.
		// Required for abilities similar to that of Magic Synthesis to correctly be rejected if the wrong decisions were made.
		if (!(await (yield* this.ability.exec.hasAllTargets(this.card, this.player, this.ability)))) {
			return false;
		}
		if (this.costTiming) {
			yield* this.costTiming.run();
			if (!this.costTiming.successful) {
				return false;
			}
		}
		this.ability.activationCount++;
		this.card = this.card.snapshot();
		return true;
	}
}

async function* combinedTimingGenerator(generators) {
	for (let timingGenerator of generators) {
		yield* timingGenerator;
	}
}

async function* combinedCostTimingGenerator(generators) {
	let completeCost = [];
	for (let timingGenerator of generators) {
		let actionList = (await timingGenerator.next()).value;
		while (actionList) {
			if (actionList[0] instanceof actions.Action) {
				completeCost = completeCost.concat(actionList);
				break;
			}
			actionList = (await timingGenerator.next(yield actionList)).value;
		}
	}
	yield completeCost;
}

export class DeployItem extends Block {
	constructor(stack, player, card, spellItemZoneIndex) {
		let costTimingGenerators = [arrayTimingGenerator([[
			new actions.Place(player, card, player.spellItemZone, spellItemZoneIndex),
			new actions.ChangeMana(player, -card.level.get())
		]])];
		let execTimingGenerators = [
			arrayTimingGenerator([[new actions.Deploy(player, card, player.spellItemZone, spellItemZoneIndex)]])
		];
		let deployAbility = null;
		for (let ability of card.abilities.get()) {
			if (ability instanceof abilities.DeployAbility) {
				deployAbility = ability;
				if (ability.cost) {
					costTimingGenerators.push(abilityCostTimingGenerator(ability, card, player));
				}
				if (card.cardTypes.get().includes("standardItem")) {
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
			combinedCostTimingGenerator(costTimingGenerators)
		);
		this.card = card;
		this.spellItemZoneIndex = spellItemZoneIndex;
		this.deployAbility = deployAbility;
	}

	async* runCost() {
		this.card.zone.remove(this.card);
		if (this.deployAbility && this.deployAbility.cost && !(await (yield* this.deployAbility.cost.hasAllTargets(this.card, this.player, this.deployAbility)))) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}
		yield* this.prepareCostTiming();
		// Check available prerequisite after the player has made at-deploying-time choices but before they paid the cost.
		// Required for cards similar to Magic Synthesis to correctly be rejected if the wrong decisions were made.
		if (this.deployAbility && !(await (yield* this.deployAbility.exec.hasAllTargets(this.card, this.player, this.deployAbility)))) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}
		yield* this.costTiming.run();
		if (!this.costTiming.successful) {
			this.card.zone.add(this.spell, this.card.index);
			return false;
		}
		this.card = this.card.snapshot();
		return true;
	}
}

export class CastSpell extends Block {
	constructor(stack, player, card, spellItemZoneIndex) {
		let costTimingGenerators = [arrayTimingGenerator([[
			new actions.Place(player, card, player.spellItemZone, spellItemZoneIndex),
			new actions.ChangeMana(player, -card.level.get())
		]])];
		let execTimingGenerators = [
			arrayTimingGenerator([[new actions.Cast(player, card, player.spellItemZone, spellItemZoneIndex)]])
		];
		let castAbility = null;
		for (let ability of card.abilities.get()) {
			if (ability instanceof abilities.CastAbility) {
				castAbility = ability;
				if (ability.cost) {
					costTimingGenerators.push(abilityCostTimingGenerator(ability, card, player));
				}
				if (card.cardTypes.get().includes("standardSpell")) {
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
			combinedCostTimingGenerator(costTimingGenerators)
		);
		this.card = card;
		this.spellItemZoneIndex = spellItemZoneIndex;
		this.castAbility = castAbility;
	}

	async* runCost() {
		this.card.zone.remove(this.card);
		if (this.castAbility && this.castAbility.cost && !(await (yield* this.castAbility.cost.hasAllTargets(this.card, this.player, this.castAbility)))) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}
		yield* this.prepareCostTiming();
		// Check available prerequisite after the player has made at-casting-time choices but before they paid the cost.
		// Required for cards like Magic Synthesis to correctly be rejected if the wrong casting decisions were made.
		if (this.castAbility && !(await (yield* this.castAbility.exec.hasAllTargets(this.card, this.player, this.castAbility)))) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}
		yield* this.costTiming.run();
		if (!this.costTiming.successful) {
			this.card.zone.add(this.card, this.card.index);
			return false;
		}
		this.card = this.card.snapshot();
		return true;
	}
}