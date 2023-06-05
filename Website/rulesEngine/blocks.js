
import {Timing} from "./timings.js";
import * as actions from "./actions.js";
import * as events from "./events.js";

// Base class for all blocks
class Block {
	constructor(stack, player) {
		this.player = player;
		this.stack = stack;
		this.costTiming = null;
		this.executionTimings = [];
	}
	
	async* runCost() {
		if (this.costTiming == null) {
			return true;
		}
		return yield* this.costTiming.run(true);
	}
	
	async* run() {
		for (let i = 0; i < this.executionTimings.length; i++) {
			// if a timing can't be done interrupt the block and remove all other queued timings.
			if (!(yield* this.executionTimings[i].run())) {
				this.executionTimings.splice(i);
				break;
			}
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
		super(stack, player);
		this.executionTimings = [new Timing(
			stack.phase.turn.game,
			[new actions.DrawAction(player, 1)],
			this
		)];
	}
}

export class StandardSummon extends Block {
	constructor(stack, player, unit, unitZoneIndex) {
		super(stack, player);
		this.unit = unit;
		this.unitZoneIndex = unitZoneIndex;
		this.costTiming = new Timing(
			stack.phase.turn.game,
			[new actions.ChangeManaAction(player, -unit.level.get())],
			this
		)
		this.executionTimings = [new Timing(
			stack.phase.turn.game,
			[new actions.SummonAction(player, unit, unitZoneIndex)],
			this
		)];
	}
	
	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.unit.hidden = false;
		let cardPlacedEvent = events.createCardPlacedEvent(this.player, this.player.handZone, this.player.handZone.cards.indexOf(this.unit), this.player.unitZone, this.unitZoneIndex);
		this.player.unitZone.place(this.unit, this.unitZoneIndex);
		yield [cardPlacedEvent];
		this.stack.phase.turn.hasStandardSummoned = this.unit.snapshot();
		return true;
	}
}

export class Retire extends Block {
	constructor(stack, player, units) {
		super(stack, player);
		this.units = units;
		this.executionTimings = [new Timing(
			stack.phase.turn.game,
			units.map(unit => new actions.DiscardAction(unit)),
			this
		)];
	}
	
	async* runCost() {
		let paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.stack.phase.turn.hasRetired = [];
		return true;
	}
	
	async* run() {
		let gainedMana = 0;
		for (const action of this.executionTimings[0].actions) {
			if (action instanceof actions.DiscardAction) {
				gainedMana += action.card.level.get();
			}
		}
		this.executionTimings[0].actions.push(new actions.ChangeManaAction(this.stack.phase.turn.player, gainedMana));
		yield* super.run();
	}
}

export class AttackDeclaration extends Block {
	constructor(stack, player, attackers) {
		super(stack, player);
		this.attackers = attackers;
		this.executionTimings = [new Timing(
			stack.phase.turn.game,
			new actions.EstablishAttackDeclaration(attackers),
			this
		)];
	}
}

export class Fight extends Block {
	constructor(stack, player) {
		super(stack, player);
	}
	
	async* run() {
		yield* super.run();
		this.stack.phase.turn.game.currentAttackDeclaration = null;
	}
}