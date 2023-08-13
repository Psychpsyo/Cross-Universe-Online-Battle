
import * as game from "./game.js";
import * as actions from "./actions.js";
import * as abilities from "./abilities.js";
import * as timingGenerators from "./timingGenerators.js";

// Base class for all blocks
class Block {
	constructor(stack, player, timingRunner, costTimingRunner = null) {
		this.player = player;
		this.stack = stack;
		this.timingRunner = timingRunner;
		this.costTimingRunner = costTimingRunner;
		this.isCancelled = false;
	}

	async* runCost() {
		if (!this.costTimingRunner) {
			return true;
		}
		let costTimingSuccess = yield* this.costTimingRunner.run(this, true);
		if (!costTimingSuccess) {
			await (yield* this.undoCost());
		}
		return costTimingSuccess;
	}

	async* run() {
		if (this.getIsCancelled()) {
			return;
		}
		yield* this.timingRunner.run(this, false);
	}

	async* undoCost() {
		yield* this.costTimingRunner.undo();
	}

	async* undoExecution() {
		yield* this.timingRunner.undo();
	}

	// might be overwritten by subclasses to implement more complex checks.
	getIsCancelled() {
		return this.isCancelled;
	}

	getCostTimings() {
		return this.costTimingRunner?.timings ?? [];
	}
	getExecutionTimings() {
		return this.timingRunner.timings;
	}
	getCostActions() {
		if (this.costTimingRunner) {
			return this.costTimingRunner.timings.map(timing => timing.actions).flat();
		} else {
			return [];
		}
	}
	getExecutionActions() {
		return this.timingRunner.timings.map(timing => timing.actions).flat();
	}
}

export class StandardDraw extends Block {
	constructor(stack, player) {
		super(stack, player, new timingGenerators.TimingRunner(
			timingGenerators.arrayTimingGenerator([
				[new actions.Draw(player, 1)]
			])
		));
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
			new timingGenerators.TimingRunner(
				timingGenerators.arrayTimingGenerator([
					[new actions.Summon(player, placeAction)]
				])
			),
			new timingGenerators.TimingRunner(
				timingGenerators.combinedTimingGenerator([
					card.getSummoningCost(player),
					timingGenerators.arrayTimingGenerator([[
						placeAction
					]])
				])
			)
		);
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

export class Retire extends Block {
	constructor(stack, player, units) {
		super(stack, player, new timingGenerators.TimingRunner(timingGenerators.retireTimingGenerator(player, units)));
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
		let establishAction = new actions.EstablishAttackDeclaration(player, attackers);
		super(stack, player, new timingGenerators.TimingRunner(
			timingGenerators.arrayTimingGenerator([
				[establishAction]
			])
		));
		this.attackers = attackers;
		this.establishAction = establishAction;
	}

	async* run() {
		yield* super.run();

		this.attackTarget = this.establishAction.attackTarget; // already a snapshot
		this.player.game.currentAttackDeclaration = new game.AttackDeclaration(this.player.game, this.attackers, this.attackTarget.cardRef);
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
	}
}

export class Fight extends Block {
	constructor(stack, player) {
		super(stack, player, new timingGenerators.TimingRunner(timingGenerators.fightTimingGenerator(stack.phase.turn.game.currentAttackDeclaration)));
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

export class AbilityActivation extends Block {
	constructor(stack, player, card, ability) {
		super(stack, player,
			new timingGenerators.TimingRunner(
				timingGenerators.abilityTimingGenerator(ability, card, player)
			),
			new timingGenerators.TimingRunner(
				timingGenerators.abilityCostTimingGenerator(ability, card, player)
			)
		);
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

export class DeployItem extends Block {
	constructor(stack, player, card) {
		let placeAction = new actions.Place(player, card, player.spellItemZone);
		let costTimingGenerators = [
			card.getDeploymentCost(player),
			timingGenerators.arrayTimingGenerator([[placeAction]])
		];
		let execTimingGenerators = [
			timingGenerators.arrayTimingGenerator([[new actions.Deploy(player, placeAction)]])
		];
		if (card.values.cardTypes.includes("equipableItem")) {
			let selectEquipableAction = new actions.SelectEquipableUnit(card, player);
			costTimingGenerators.unshift(timingGenerators.arrayTimingGenerator([[selectEquipableAction]]));
			execTimingGenerators.unshift(timingGenerators.equipTimingGenerator(selectEquipableAction, player));
		}
		let deployAbility = null;
		for (let ability of card.values.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				deployAbility = ability;
				if (card.values.cardTypes.includes("standardItem")) {
					// standard items first activate and are only treated as briefly on the field after
					execTimingGenerators.unshift(timingGenerators.abilityTimingGenerator(ability, card, player));
					// and are then discarded.
					execTimingGenerators.push(timingGenerators.arrayTimingGenerator([[new actions.Discard(card)]]));
				} else {
					execTimingGenerators.push(timingGenerators.abilityTimingGenerator(ability, card, player));
				}
				// cards only ever have one of these
				break;
			}
		}
		super(stack, player,
			new timingGenerators.TimingRunner(timingGenerators.combinedTimingGenerator(execTimingGenerators)),
			new timingGenerators.TimingRunner(timingGenerators.combinedTimingGenerator(costTimingGenerators))
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
		let costTimingGenerators = [
			card.getCastingCost(player),
			timingGenerators.arrayTimingGenerator([[placeAction]])
		];
		let execTimingGenerators = [
			timingGenerators.arrayTimingGenerator([[new actions.Cast(player, placeAction)]])
		];
		if (card.values.cardTypes.includes("enchantSpell")) {
			let selectEquipableAction = new actions.SelectEquipableUnit(card, player);
			costTimingGenerators.unshift(timingGenerators.arrayTimingGenerator([[selectEquipableAction]]));
			execTimingGenerators.unshift(timingGenerators.equipTimingGenerator(selectEquipableAction, player));
		}
		let castAbility = null;
		for (let ability of card.values.abilities) {
			if (ability instanceof abilities.CastAbility) {
				castAbility = ability;
				if (card.values.cardTypes.includes("standardSpell")) {
					// standard spells first activate and are only treated as briefly on the field after
					execTimingGenerators.unshift(timingGenerators.abilityTimingGenerator(ability, card, player));
					// and are then discarded.
					execTimingGenerators.push(timingGenerators.arrayTimingGenerator([[new actions.Discard(card)]]));
				} else {
					execTimingGenerators.push(timingGenerators.abilityTimingGenerator(ability, card, player));
				}
				// cards only ever have one of these
				break;
			}
		}
		super(stack, player,
			new timingGenerators.TimingRunner(timingGenerators.combinedTimingGenerator(execTimingGenerators)),
			new timingGenerators.TimingRunner(timingGenerators.combinedTimingGenerator(costTimingGenerators))
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