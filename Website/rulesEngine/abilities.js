import {buildExecAST, buildCostAST, buildConditionAST} from "./cdfScriptInterpreter/interpreter.js";

export class BaseAbility {
	constructor(id, condition) {
		this.id = id;
		this.condition = null;
		if (condition) {
			this.condition = buildConditionAST(id, condition);
		}
	}

	async* canActivate(card, player) {
		return this.condition === null || await (yield* this.condition.eval(card, player, this));
	}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(id, exec, cost, condition) {
		super(id, condition);
		this.exec = buildExecAST(id, exec);
		this.cost =  null;
		if (cost) {
			this.cost = buildCostAST(id, cost);
		}
		this.scriptVariables = {};
	}

	async* canActivate(card, player) {
		return (await (yield* super.canActivate(card, player))) && (this.cost === null || await (yield* this.cost.hasAllTargets(card, player, this)));
	}

	async* runCost(card, player) {
		yield* this.cost.eval(card, player, this);
	}

	async* run(card, player) {
		yield* this.exec.eval(card, player, this);
		this.scriptVariables = {};
	}
}

export class CastAbility extends Ability {
	constructor(id, exec, cost, condition) {
		super(id, exec, cost, condition);
	}
}

export class DeployAbility extends Ability {
	constructor(id, exec, cost, condition) {
		super(id, exec, cost, condition);
	}
}

export class OptionalAbility extends Ability {
	constructor(id, exec, cost, turnLimit, condition) {
		super(id, exec, cost, condition);
		this.turnLimit = turnLimit;
		this.activationCount = 0;
	}

	async* canActivate(card, player) {
		return (await (yield* super.canActivate(card, player))) && this.activationCount < this.turnLimit;
	}
}

export class FastAbility extends Ability {
	constructor(id, exec, cost, turnLimit, condition) {
		super(id, exec, cost, condition);
		this.turnLimit = turnLimit;
		this.activationCount = 0;
	}

	async* canActivate(card, player) {
		return (await (yield* super.canActivate(card, player))) && this.activationCount < this.turnLimit;
	}
}

export class TriggerAbility extends Ability {
	constructor(id, exec, cost, mandatory, turnLimit, duringPhase, condition) {
		super(id, exec, cost, condition);
		this.mandatory = mandatory;
		this.turnLimit = turnLimit;
		this.duringPhase = duringPhase;
		this.activationCount = 0;
	}

	async* canActivate(card, player) {
		return (await (yield* super.canActivate(card, player))) &&
			this.activationCount < this.turnLimit &&
			(this.duringPhase == null || this.player.game.currentPhase().matches(this.duringPhase, player));
	}
}

export class StaticAbility extends BaseAbility {
	constructor(id, effect) {
		super(id);
	}
}