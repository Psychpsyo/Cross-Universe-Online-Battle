import * as interpreter from "./cdfScriptInterpreter/interpreter.js";

export class BaseAbility {
	constructor(id, condition) {
		this.id = id;
		this.condition = null;
		if (condition) {
			this.condition = interpreter.buildConditionAST(id, condition);
		}
	}

	async canActivate(card, player) {
		return this.condition === null || await this.condition.evalFull(card, player, this);
	}

	snapshot() {
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(id, exec, cost, condition) {
		super(id, condition);
		this.exec = interpreter.buildExecAST(id, exec);
		this.cost =  null;
		if (cost) {
			this.cost = interpreter.buildCostAST(id, cost);
		}
		this.scriptVariables = {};
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) && (this.cost === null || await this.cost.hasAllTargets(card, player, this));
	}

	async* runCost(card, player) {
		if (this.cost) {
			yield* this.cost.eval(card, player, this);
		}
	}

	async* run(card, player) {
		yield* this.exec.eval(card, player, this);
		this.scriptVariables = {};
	}

	successfulActivation() {}
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

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) && this.activationCount < this.turnLimit;
	}

	successfulActivation() {
		this.activationCount++;
	}
}

export class FastAbility extends Ability {
	constructor(id, exec, cost, turnLimit, condition) {
		super(id, exec, cost, condition);
		this.turnLimit = turnLimit;
		this.activationCount = 0;
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) && this.activationCount < this.turnLimit;
	}

	successfulActivation() {
		this.activationCount++;
	}
}

export class TriggerAbility extends Ability {
	constructor(id, exec, cost, mandatory, turnLimit, duringPhase, trigger, condition) {
		super(id, exec, cost, condition);
		this.mandatory = mandatory;
		this.turnLimit = turnLimit;
		this.duringPhase = duringPhase;
		this.trigger = interpreter.buildTriggerAST(id, trigger);
		this.triggerMet = false;
		this.activationCount = 0;
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) &&
			this.activationCount < this.turnLimit &&
			(this.duringPhase == null || player.game.currentPhase().matches(this.duringPhase, player)) &&
			(this.duringPhase != null || this.triggerMet)
	}

	async checkTrigger(card, player) {
		if (this.trigger == null || await this.trigger.evalFull(card, player, this)) {
			this.triggerMet = true;
		}
	}

	successfulActivation() {
		this.activationCount++;
		this.triggerMet = false;
	}
}

export class StaticAbility extends BaseAbility {
	constructor(id, modifier, applyTo, condition) {
		super(id, condition);
		this.modifier = interpreter.buildMofifierAST(id, modifier);
		this.applyTo = interpreter.buildApplyTargetAST(id, applyTo);
	}

	async getTargetCards(card, player) {
		if (await this.canActivate(card, player)) {
			return this.applyTo.evalFull(card, player, this);
		}
		return [];
	}

	async getModifier(card, player) {
		return this.modifier.evalFull(card, player, this);
	}
}