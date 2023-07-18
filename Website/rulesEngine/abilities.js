import * as interpreter from "./cdfScriptInterpreter/interpreter.js";

export class BaseAbility {
	constructor(id, game, condition) {
		this.id = id;
		this.condition = null;
		if (condition) {
			this.condition = interpreter.buildAST("condition", id, condition, game);
		}
	}

	canActivate(card, player) {
		return this.condition === null || this.condition.evalFull(card, player, this);
	}

	snapshot() {
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(id, game, exec, cost, condition) {
		super(id, game, condition);
		this.exec = interpreter.buildAST("exec", id, exec, game);
		this.cost =  null;
		if (cost) {
			this.cost = interpreter.buildAST("cost", id, cost, game);
		}
		this.scriptVariables = {};
	}

	canActivate(card, player) {
		return super.canActivate(card, player) && (this.cost === null || this.cost.canDoInFull(card, player, this));
	}

	* runCost(card, player) {
		if (this.cost) {
			yield* this.cost.eval(card, player, this);
		}
	}

	* run(card, player) {
		yield* this.exec.eval(card, player, this);
		this.scriptVariables = {};
	}

	successfulActivation() {}
}

export class CastAbility extends Ability {
	constructor(id, game, exec, cost, condition, after) {
		super(id, game, exec, cost, condition);
		this.after = null;
		if (after) {
			this.after = interpreter.buildAST("trigger", id, after, game);
		}
		this.triggerMet = false;
	}

	canActivate(card, player) {
		return super.canActivate(card, player) && (this.after == null || this.triggerMet);
	}

	checkTrigger(card, player) {
		if (this.after == null || this.after.evalFull(card, player, this)) {
			this.triggerMet = true;
		}
	}
}

export class DeployAbility extends Ability {
	constructor(id, game, exec, cost, condition, after) {
		super(id, game, exec, cost, condition);
		this.after = null;
		if (after) {
			this.after = interpreter.buildAST("trigger", id, after, game);
		}
		this.triggerMet = false;
	}

	canActivate(card, player) {
		return super.canActivate(card, player) && (this.after == null || this.triggerMet);
	}

	checkTrigger(card, player) {
		if (this.after == null || this.after.evalFull(card, player, this)) {
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

	canActivate(card, player) {
		return super.canActivate(card, player) && this.activationCount < this.turnLimit;
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

	canActivate(card, player) {
		return super.canActivate(card, player) && this.activationCount < this.turnLimit;
	}

	successfulActivation() {
		this.activationCount++;
	}
}

export class TriggerAbility extends Ability {
	constructor(id, game, exec, cost, mandatory, turnLimit, during, after, condition) {
		super(id, game, exec, cost, condition);
		this.mandatory = mandatory;
		this.turnLimit = turnLimit;
		this.during = null;
		if (during) {
			this.during = interpreter.buildAST("during", id, during, game);
		}
		this.usedDuring = false;
		this.after = null;
		if (after) {
			this.after = interpreter.buildAST("trigger", id, after, game);
		}
		this.triggerMet = false;
		this.activationCount = 0;
	}

	canActivate(card, player) {
		return super.canActivate(card, player) &&
			this.activationCount < this.turnLimit &&
			this.triggerMet;
	}

	checkTrigger(card, player) {
		if (!this.after) {
			return;
		}
		if (this.after.evalFull(card, player, this)) {
			this.triggerMet = true;
		}
	}

	checkDuring(card, player) {
		if (!this.during) {
			return;
		}
		if (!this.during.evalFull(card, player, this)) {
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
		this.modifier = interpreter.buildAST("modifier", id, modifier, game);
		this.applyTo = interpreter.buildAST("applyTarget", id, applyTo, game);
	}

	getTargetCards(card, player) {
		if (this.canActivate(card, player)) {
			return this.applyTo.evalFull(card, player, this);
		}
		return [];
	}

	getModifier(card, player) {
		return this.modifier.evalFull(card, player, this);
	}
}