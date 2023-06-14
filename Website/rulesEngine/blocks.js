
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

	async* runCost() {
		if (this.costTimingGenerator == null) {
			return true;
		}

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

		return (await (yield* this.costTiming.run()));
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
			if (!(yield* timing.run())) {
				break;
			}
			this.executionTimings.push(timing);
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
	constructor(stack, player, unit, unitZoneIndex) {
		super(stack, player,
			arrayTimingGenerator([
				[new actions.Summon(player, unit, player.unitZone, unitZoneIndex)]
			]),
			arrayTimingGenerator([[
				new actions.ChangeMana(player, -unit.level.get()),
				new actions.Place(player, unit, player.unitZone, unitZoneIndex)
			]]
		));
		this.unit = unit;
		this.unitZoneIndex = unitZoneIndex;
	}
	
	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.unit = this.unit.snapshot();
		this.stack.phase.turn.hasStandardSummoned = this.unit;
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
	yield* ability.run(card, player);
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
		let success = await (yield* super.runCost());
		if (success) {
			this.ability.activationCount++;
		}
		return success;
	}
}

async function* combinedTimingGenerator() {
	for (let timingGenerator of arguments) {
		yield* timingGenerator;
	}
}

async function* combinedCostTimingGenerator() {
	let completeCost = [];
	for (let timingGenerator of arguments) {
		for await (let actionList of timingGenerator) {
			if (actionList[0] instanceof actions.Action) {
				completeCost = completeCost.concat(actionList);
				break;
			}
			yield actionList;
		}
	}
	yield completeCost;
}

export class DeployItem extends Block {
	constructor(stack, player, item, spellItemZoneIndex) {
		let costTimingGenerators = [arrayTimingGenerator([[
			new actions.ChangeMana(player, -item.level.get()),
			new actions.Place(player, item, player.spellItemZone, spellItemZoneIndex)
		]])];
		let execTimingGenerators = [
			arrayTimingGenerator([[new actions.Deploy(player, item, player.spellItemZone, spellItemZoneIndex)]])
		];
		for (let ability of item.abilities.get()) {
			if (ability instanceof abilities.DeployAbility) {
				if (ability.cost) {
					costTimingGenerators.push(abilityCostTimingGenerator(ability, item, player));
				}
				if (item.cardTypes.get().includes("standardItem")) {
					// standard items first activate and are only treated as briefly on the field after
					execTimingGenerators.unshift(abilityTimingGenerator(ability, item, player));
					// and are then discarded.
					execTimingGenerators.push(arrayTimingGenerator([[new actions.Discard(item)]]));
				} else {
					execTimingGenerators.push(abilityTimingGenerator(ability, item, player));
				}
				// cards only ever have one of these
				break;
			}
		}
		super(stack, player,
			combinedTimingGenerator(...execTimingGenerators),
			combinedCostTimingGenerator(...costTimingGenerators)
		);
		this.item = item;
		this.spellItemZoneIndex = spellItemZoneIndex;
	}
	
	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.item = this.item.snapshot();
		return true;
	}
}

export class CastSpell extends Block {
	constructor(stack, player, spell, spellItemZoneIndex) {
		let costTimingGenerators = [arrayTimingGenerator([[
			new actions.ChangeMana(player, -spell.level.get()),
			new actions.Place(player, spell, player.spellItemZone, spellItemZoneIndex)
		]])];
		let execTimingGenerators = [
			arrayTimingGenerator([[new actions.Cast(player, spell, player.spellItemZone, spellItemZoneIndex)]])
		];
		for (let ability of spell.abilities.get()) {
			if (ability instanceof abilities.CastAbility) {
				if (ability.cost) {
					costTimingGenerators.push(abilityCostTimingGenerator(ability, spell, player));
				}
				if (spell.cardTypes.get().includes("standardSpell")) {
					// standard spells first activate and are only treated as briefly on the field after
					execTimingGenerators.unshift(abilityTimingGenerator(ability, spell, player));
					// and are then discarded.
					execTimingGenerators.push(arrayTimingGenerator([[new actions.Discard(spell)]]));
				} else {
					execTimingGenerators.push(abilityTimingGenerator(ability, spell, player));
				}
				// cards only ever have one of these
				break;
			}
		}
		super(stack, player,
			combinedTimingGenerator(...execTimingGenerators),
			combinedCostTimingGenerator(...costTimingGenerators)
		);
		this.spell = spell;
		this.spellItemZoneIndex = spellItemZoneIndex;
	}
	
	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.spell = this.spell.snapshot();
		return true;
	}
}