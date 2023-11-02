import * as interpreter from "./cdfScriptInterpreter/interpreter.js";
import * as blocks from "./blocks.js";
import * as timingGenerators from "./timingGenerators.js";

export class BaseAbility {
	constructor(id, game, condition, cancellable) {
		this.id = id;
		this.condition = null;
		this.cancellable = true;
		if (condition) {
			this.condition = interpreter.buildAST("condition", id, condition, game);
		}
	}

	canActivate(card, player, evaluatingPlayer = player) {
		return this.condition === null || this.condition.evalFull(card, player, this, evaluatingPlayer)[0].get(player);
	}

	snapshot() {
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(id, game, exec, cost, condition, cancellable) {
		super(id, game, condition, cancellable);
		this.exec = interpreter.buildAST("exec", id, exec, game);
		this.cost =  null;
		if (cost) {
			this.cost = interpreter.buildAST("cost", id, cost, game);
		}
		this.scriptVariables = {};
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		if (!super.canActivate(card, player, evaluatingPlayer)) {
			return false;
		}
		if (this.cost === null) {
			return this.exec.hasAllTargets(card, player, this, evaluatingPlayer);
		}
		let timingRunner = new timingGenerators.TimingRunner(() => timingGenerators.abilityCostTimingGenerator(this, card, player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, () => this.exec.hasAllTargets(card, player, this, evaluatingPlayer));
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

	// TODO: Override snapshot() to properly snapshot scriptVariables since it does not create a deep copy.
}

export class CastAbility extends Ability {
	constructor(ability, game) {
		super(ability.id, game, ability.exec, ability.cost, ability.condition, ability.cancellable);
		this.after = null;
		if (ability.after) {
			this.after = interpreter.buildAST("trigger", ability.id, ability.after, game);
		}
		this.triggerMetOnStack = -1;
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during spell casting
	canActivate(card, player, evaluatingPlayer = player) {
		return (this.condition === null || this.condition.evalFull(card, player, this, evaluatingPlayer)[0].get(player)) &&
			(this.after === null || this.triggerMetOnStack === player.game.currentStack().index - 1);
	}

	checkTrigger(card, player) {
		if (this.after == null || this.after.evalFull(card, player, this)[0].get(player)) {
			this.triggerMetOnStack = player.game.currentStack().index;
		}
	}
}

export class DeployAbility extends Ability {
	constructor(ability, game) {
		super(ability.id, game, ability.exec, ability.cost, ability.condition, ability.cancellable);
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during item deployment
	canActivate(card, player, evaluatingPlayer = player) {
		return (this.condition === null || this.condition.evalFull(card, player, this, evaluatingPlayer)[0].get(player));
	}
}

export class OptionalAbility extends Ability {
	constructor(ability, game) {
		super(ability.id, game, ability.exec, ability.cost, ability.condition, ability.cancellable);
		this.turnLimit = ability.turnLimit;
		this.globalTurnLimit = ability.globalTurnLimit;
		this.gameLimit = ability.gameLimit;
		this.turnActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		return this.turnActivationCount < this.turnLimit &&
		(this.gameLimit === Infinity || player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.gameLimit) &&
		(this.globalTurnLimit === Infinity || player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.globalTurnLimit) &&
		await (super.canActivate(card, player, evaluatingPlayer));
	}

	successfulActivation() {
		this.turnActivationCount++;
	}
}

export class FastAbility extends Ability {
	constructor(ability, game) {
		super(ability.id, game, ability.exec, ability.cost, ability.condition, ability.cancellable);
		this.turnLimit = ability.turnLimit;
		this.globalTurnLimit = ability.globalTurnLimit;
		this.gameLimit = ability.gameLimit;
		this.turnActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		return this.turnActivationCount < this.turnLimit &&
		(this.gameLimit === Infinity || player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.gameLimit) &&
		(this.globalTurnLimit === Infinity || player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.globalTurnLimit) &&
		await super.canActivate(card, player, evaluatingPlayer);
	}

	successfulActivation() {
		this.turnActivationCount++;
	}
}

export class TriggerAbility extends Ability {
	constructor(ability, game) {
		super(ability.id, game, ability.exec, ability.cost, ability.condition, ability.cancellable);
		this.mandatory = ability.mandatory;
		this.turnLimit = ability.turnLimit;
		this.globalTurnLimit = ability.globalTurnLimit;
		this.gameLimit = ability.gameLimit;
		this.during = null;
		if (ability.during) {
			this.during = interpreter.buildAST("during", ability.id, ability.during, game);
		}
		this.usedDuring = false;
		this.after = null;
		if (ability.after) {
			this.after = interpreter.buildAST("trigger", ability.id, ability.after, game);
		}
		this.triggerMetOnStack = -1;
		this.turnActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		return this.triggerMetOnStack === player.game.currentStack().index - 1 &&
			this.turnActivationCount < this.turnLimit &&
			(this.gameLimit === Infinity || player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.gameLimit) &&
			(this.globalTurnLimit === Infinity || player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length < this.globalTurnLimit) &&
			await super.canActivate(card, player, evaluatingPlayer);
	}

	checkTrigger(card, player) {
		if (this.after === null) {
			return;
		}
		if (this.after.evalFull(card, player, this)[0].get(player)) {
			this.triggerMetOnStack = player.game.currentStack().index;
		}
	}

	checkDuring(card, player) {
		if (!this.during) {
			return;
		}
		if (!this.during.evalFull(card, player, this)[0].get(player)) {
			this.triggerMetOnStack = -1;
			this.usedDuring = false;
		} else if (!this.usedDuring) {
			this.triggerMetOnStack = player.game.currentStack().index - 1;
		}
	}

	successfulActivation() {
		this.turnActivationCount++;
		this.triggerMetOnStack = -1;
		if (this.during) {
			this.usedDuring = true;
		}
	}
}

export class StaticAbility extends BaseAbility {
	constructor(ability, game) {
		super(ability.id, game, ability.condition, ability.cancellable);
		this.modifier = interpreter.buildAST("modifier", ability.id, ability.modifier, game);
		this.applyTo = interpreter.buildAST("applyTarget", ability.id, ability.applyTo, game);
		this.zoneEnterTimingIndex = 0;
	}

	getTargetCards(card, player, evaluatingPlayer = player) {
		if (this.canActivate(card, player, evaluatingPlayer = player)) {
			return this.applyTo.evalFull(card, player, this, evaluatingPlayer)[0].get(player);
		}
		return [];
	}

	getModifier(card, player) {
		return this.modifier.evalFull(card, player, this)[0].get(player);
	}
}