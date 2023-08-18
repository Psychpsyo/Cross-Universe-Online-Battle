import * as interpreter from "./cdfScriptInterpreter/interpreter.js";
import * as blocks from "./blocks.js";
import * as timingGenerators from "./timingGenerators.js";

export class BaseAbility {
	constructor(id, game, condition) {
		this.id = id;
		this.condition = null;
		if (condition) {
			this.condition = interpreter.buildAST("condition", id, condition, game);
		}
	}

	canActivate(card, player) {
		return this.condition === null || this.condition.evalFull(card, player, this)[0];
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

	async canActivate(card, player) {
		if (!super.canActivate(card, player)) {
			return false;
		}
		if (this.cost === null) {
			return this.exec.hasAllTargets(card, player, this);
		}
		let timingRunner = new timingGenerators.TimingRunner(() => timingGenerators.abilityCostTimingGenerator(this, card, player), player.game, true);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, () => this.exec.hasAllTargets(card, player, this));
		return costOptionTree.valid;
	}

	* runCost(card, player) {
		if (this.cost) {
			yield* this.cost.eval(card, player, this);
		}
	}

	* run(card, player) {
		yield* this.exec.eval(card, player, this);
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

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during spell casting
	canActivate(card, player) {
		return (this.condition === null || this.condition.evalFull(card, player, this)[0]) &&
			(this.after === null || this.triggerMet);
	}

	checkTrigger(card, player) {
		if (this.after == null || this.after.evalFull(card, player, this)[0]) {
			this.triggerMet = true;
		}
	}
}

export class DeployAbility extends Ability {
	constructor(id, game, exec, cost, condition) {
		super(id, game, exec, cost, condition);
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during item deployment
	canActivate(card, player) {
		return (this.condition === null || this.condition.evalFull(card, player, this)[0]);
	}
}

export class OptionalAbility extends Ability {
	constructor(id, game, exec, cost, turnLimit, globalTurnLimit, gameLimit, condition) {
		super(id, game, exec, cost, condition);
		this.turnLimit = turnLimit;
		this.globalTurnLimit = globalTurnLimit;
		this.gameLimit = gameLimit;
		this.turnActivationCount = 0;
	}

	async canActivate(card, player) {
		return await (super.canActivate(card, player)) &&
		this.turnActivationCount < this.turnLimit &&
		(this.gameLimit === Infinity || player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.gameLimit) &&
		(this.globalTurnLimit === Infinity || player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.globalTurnLimit);
	}

	successfulActivation() {
		this.turnActivationCount++;
	}
}

export class FastAbility extends Ability {
	constructor(id, game, exec, cost, turnLimit, globalTurnLimit, gameLimit, condition) {
		super(id, game, exec, cost, condition);
		this.turnLimit = turnLimit;
		this.globalTurnLimit = globalTurnLimit;
		this.gameLimit = gameLimit;
		this.turnActivationCount = 0;
	}

	async canActivate(card, player) {
		return (await super.canActivate(card, player)) &&
		this.turnActivationCount < this.turnLimit &&
		(this.gameLimit === Infinity || player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.gameLimit) &&
		(this.globalTurnLimit === Infinity || player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.globalTurnLimit);
}

	successfulActivation() {
		this.turnActivationCount++;
	}
}

export class TriggerAbility extends Ability {
	constructor(id, game, exec, cost, mandatory, turnLimit, globalTurnLimit, gameLimit, during, after, condition) {
		super(id, game, exec, cost, condition);
		this.mandatory = mandatory;
		this.turnLimit = turnLimit;
		this.globalTurnLimit = globalTurnLimit;
		this.gameLimit = gameLimit;
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
		this.turnActivationCount = 0;
	}

	async canActivate(card, player) {
		return this.triggerMet &&
			this.turnActivationCount < this.turnLimit &&
			(this.gameLimit === Infinity || player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.gameLimit) &&
			(this.globalTurnLimit === Infinity || player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.globalTurnLimit) &&
			await super.canActivate(card, player);
	}

	checkTrigger(card, player) {
		if (this.after === null) {
			return;
		}
		if (this.after.evalFull(card, player, this)[0]) {
			this.triggerMet = true;
		}
	}

	checkDuring(card, player) {
		if (!this.during) {
			return;
		}
		if (!this.during.evalFull(card, player, this)[0]) {
			this.triggerMet = false;
			this.usedDuring = false;
		} else if (!this.usedDuring) {
			this.triggerMet = true;
		}
	}

	successfulActivation() {
		this.turnActivationCount++;
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
			return this.applyTo.evalFull(card, player, this)[0];
		}
		return [];
	}

	getModifier(card, player) {
		return this.modifier.evalFull(card, player, this)[0];
	}
}