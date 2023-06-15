import {buildExecAST, buildCostAST} from "./cdfScriptInterpreter/interpreter.js";

export class BaseAbility {
	constructor(id) {
		this.id = id;
	}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(id, exec, cost) {
		super(id);
		this.exec = buildExecAST(id, exec);
		this.cost =  null;
		if (cost) {
			this.cost = buildCostAST(id, cost);
		}
		this.scriptVariables = {};
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
	constructor(id, exec, cost) {
		super(id, exec, cost);
	}
}

export class DeployAbility extends Ability {
	constructor(id, exec, cost) {
		super(id, exec, cost);
	}
}

export class OptionalAbility extends Ability {
	constructor(id, exec, cost, turnLimit) {
		super(id, exec, cost);
		this.turnLimit = turnLimit;
		this.activationCount = 0;
	}
}

export class FastAbility extends Ability {
	constructor(id, exec, cost, turnLimit) {
		super(id, exec, cost);
		this.turnLimit = turnLimit;
		this.activationCount = 0;
	}
}

export class TriggerAbility extends Ability {
	constructor(id, exec, cost, mandatory, turnLimit) {
		super(id, exec, cost);
		this.mandatory = mandatory;
		this.turnLimit = turnLimit;
	}
}

export class StaticAbility extends BaseAbility {
	constructor(id, effect) {
		super(id);
	}
}