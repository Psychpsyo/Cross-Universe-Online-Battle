
import {Timing} from "./timings.js";
import {FieldZone} from "./zones.js";
import * as game from "./game.js";
import * as actions from "./actions.js";

async function* arrayTimingGenerator(actionArrays) {
	for (let actionList of actionArrays) {
		yield actionList;
	}
}

// Base class for all blocks
class Block {
	constructor(stack, player, timingGenerator) {
		this.player = player;
		this.stack = stack;
		this.costTiming = null;
		this.timingGenerator = timingGenerator;
		this.executionTimings = [];
	}
	
	async* runCost() {
		if (this.costTiming == null) {
			return true;
		}
		return yield* this.costTiming.run(true);
	}
	
	async* run() {
		let generatorOutput = await this.timingGenerator.next();
		while(!generatorOutput.done) {
			let actionList = generatorOutput.value;
			// Needs to first check for updates (events or requests) returned by the timing generator.
			if (actionList.length == 0 || !(actionList[0] instanceof actions.Action)) {
				yield actionList;
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
			[new actions.DrawAction(player, 1)]
		]));
	}
}

export class StandardSummon extends Block {
	constructor(stack, player, unit, unitZoneIndex) {
		super(stack, player, arrayTimingGenerator([
			[new actions.SummonAction(player, unit, unitZoneIndex)]
		]));
		this.unit = unit;
		this.unitZoneIndex = unitZoneIndex;
		this.costTiming = new Timing(
			stack.phase.turn.game,
			[
				new actions.ChangeManaAction(player, -unit.level.get()),
				new actions.PlaceAction(player, unit, player.unitZone, unitZoneIndex)
			],
			this
		)
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
	let discardTiming = yield units.map(unit => new actions.DiscardAction(unit));
	
	let gainedMana = 0;
	for (const action of discardTiming.actions) {
		if (action instanceof actions.DiscardAction) {
			gainedMana += action.card.level.get();
		}
	}
	if (gainedMana > 0) {
		yield [new actions.ChangeManaAction(player, gainedMana)];
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
	if (totalAttack > attackDeclaration.target.defense.get()) {
		let actionList = [new actions.DestroyAction(attackDeclaration.target)];
		if (attackDeclaration.target.zone.type == "partner") {
			actionList.push(new actions.DealDamageAction(attackDeclaration.target.zone.player, totalAttack - attackDeclaration.target.defense.get()));
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
	
	if (attackDeclaration.target.attack.get() > counterattackTarget.defense.get()) {
		let actionList = [new actions.DestroyAction(counterattackTarget)];
		if (counterattackTarget.zone.type == "partner") {
			actionList.push(new actions.DealDamageAction(counterattackTarget.zone.player, attackDeclaration.target.attack.get() - counterattackTarget.defense.get()));
		}
		yield actionList;
	}
}

export class Fight extends Block {
	constructor(stack, player) {
		super(stack, player, fightTimingGenerator(stack.phase.turn.game.currentAttackDeclaration));
	}
}