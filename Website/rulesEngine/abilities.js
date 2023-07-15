import * as interpreter from "./cdfScriptInterpreter/interpreter.js";

export class BaseAbility {
	constructor(id, game, condition) {
		this.id = id;
		this.condition = null;
		if (condition) {
			this.condition = interpreter.buildConditionAST(id, condition, game);
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
	constructor(id, game, exec, cost, condition) {
		super(id, game, condition);
		this.exec = interpreter.buildExecAST(id, exec, game);
		this.cost =  null;
		if (cost) {
			this.cost = interpreter.buildCostAST(id, cost, game);
		}
		this.scriptVariables = {};
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) && (this.cost === null || await this.cost.canDoInFull(card, player, this));
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
	constructor(id, game, exec, cost, condition, trigger) {
		super(id, game, exec, cost, condition);
		this.trigger = null;
		if (trigger) {
			this.trigger = interpreter.buildTriggerAST(id, trigger, game);
		}
		this.triggerMet = false;
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) && (this.trigger == null || this.triggerMet);
	}

	async checkTrigger(card, player) {
		if (this.trigger == null || await this.trigger.evalFull(card, player, this)) {
			this.triggerMet = true;
		}
	}
}

export class DeployAbility extends Ability {
	constructor(id, game, exec, cost, condition, trigger) {
		super(id, game, exec, cost, condition);
		this.trigger = null;
		if (trigger) {
			this.trigger = interpreter.buildTriggerAST(id, trigger, game);
		}
		this.triggerMet = false;
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) && (this.trigger == null || this.triggerMet);
	}

	async checkTrigger(card, player) {
		if (this.trigger == null || await this.trigger.evalFull(card, player, this)) {
			this.triggerMet = true;
		}
	}
}

export class OptionalAbility extends Ability {
	constructor(id, game, exec, cost, turnLimit, condition) {
		super(id, game, exec, cost, condition);
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
	constructor(id, game, exec, cost, turnLimit, condition) {
		super(id, game, exec, cost, condition);
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
	constructor(id, game, exec, cost, mandatory, turnLimit, during, trigger, condition) {
		super(id, game, exec, cost, condition);
		this.mandatory = mandatory;
		this.turnLimit = turnLimit;
		this.during = null;
		if (during) {
			this.during = interpreter.buildDuringAST(id, during, game);
		}
		this.usedDuring = false;
		this.trigger = null;
		if (trigger) {
			this.trigger = interpreter.buildTriggerAST(id, trigger, game);
		}
		this.triggerMet = false;
		this.activationCount = 0;
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) &&
			this.activationCount < this.turnLimit &&
			this.triggerMet;
	}

	async checkTrigger(card, player) {
		if (!this.trigger) {
			return;
		}
		if (await this.trigger.evalFull(card, player, this)) {
			this.triggerMet = true;
		}
	}

	async checkDuring(card, player) {
		if (!this.during) {
			return;
		}
		if (!(await this.during.evalFull(card, player, this))) {
			this.triggerMet = false;
			this.usedDuring = false;
		} else if (!this.usedDuring) {
			this.triggerMet = true;
		}
	}

	successfulActivation() {
		this.activationCount++;
		this.triggerMet = false;
		if (this.during) {
			this.usedDuring = true;
		}
	}
}

export class StaticAbility extends BaseAbility {
	constructor(id, game, modifier, applyTo, condition) {
		super(id, game, condition);
		this.modifier = interpreter.buildMofifierAST(id, modifier, game);
		this.applyTo = interpreter.buildApplyTargetAST(id, applyTo, game);
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