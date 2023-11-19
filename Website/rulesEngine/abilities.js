import * as interpreter from "./cdfScriptInterpreter/interpreter.js";
import * as blocks from "./blocks.js";
import * as timingGenerators from "./timingGenerators.js";
import {ScriptContext} from "./cdfScriptInterpreter/structs.js";

export class BaseAbility {
	constructor(ability, game) {
		this.id = ability.id;
		this.condition = null;
		this.cancellable = ability.cancellable;
		this.isCancelled = false;
		if (ability.condition) {
			this.condition = interpreter.buildAST("condition", ability.id, ability.condition, game);
		}
	}

	isConditionMet(card, player, evaluatingPlayer = player) {
		return this.condition === null || this.condition.evalFull(new ScriptContext(card, player, this, evaluatingPlayer))[0].get(player);
	}

	canActivate(card, player, evaluatingPlayer = player) {
		return !this.isCancelled && this.isConditionMet(card, player, evaluatingPlayer);
	}

	snapshot() {
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(ability, game) {
		super(ability, game);
		this.exec = interpreter.buildAST("exec", ability.id, ability.exec, game);
		this.cost =  null;
		if (ability.cost) {
			this.cost = interpreter.buildAST("cost", ability.id, ability.cost, game);
		}
		this.scriptVariables = {};
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		if (!super.canActivate(card, player, evaluatingPlayer)) {
			return false;
		}
		if (this.cost === null) {
			return this.exec.hasAllTargets(new ScriptContext(card, player, this, evaluatingPlayer));
		}
		let timingRunner = new timingGenerators.TimingRunner(() => timingGenerators.abilityCostTimingGenerator(this, card, player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, () => this.exec.hasAllTargets(new ScriptContext(card, player, this, evaluatingPlayer)));
		return costOptionTree.valid;
	}

	* runCost(card, player) {
		if (this.cost) {
			yield* this.cost.eval(new ScriptContext(card, player, this));
		}
	}

	* run(card, player) {
		yield* this.exec.eval(new ScriptContext(card, player, this));
	}

	successfulActivation() {}

	// TODO: Override snapshot() to properly snapshot scriptVariables since it does not create a deep copy.
}

export class CastAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.after = null;
		if (ability.after) {
			this.after = interpreter.buildAST("trigger", ability.id, ability.after, game);
		}
		this.triggerMetOnStack = -1;
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during spell casting
	canActivate(card, player, evaluatingPlayer = player) {
		return (this.isConditionMet(card, player, evaluatingPlayer)) &&
			(this.after === null || this.triggerMetOnStack === player.game.currentStack().index - 1);
	}

	checkTrigger(card, player) {
		if (this.after == null || this.after.evalFull(new ScriptContext(card, player, this))[0].get(player)) {
			this.triggerMetOnStack = player.game.currentStack().index;
		}
	}
}

export class DeployAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during item deployment
	canActivate(card, player, evaluatingPlayer = player) {
		return this.isConditionMet(card, player, evaluatingPlayer);
	}
}

export class OptionalAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.globalTurnLimit = interpreter.buildAST("globalTurnLimit", ability.id, ability.globalTurnLimit, game);
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
		this.turnActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		let ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnActivationCount >= this.turnLimit.evalFull(ctx)[0].getJsNum(player)) return false;

		let gameLimit = this.gameLimit.evalFull(ctx)[0].getJsNum(player);
		if (gameLimit !== Infinity && player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= gameLimit)
			return false;

		let globalTurnLimit = this.globalTurnLimit.evalFull(ctx)[0].getJsNum(player);
		if (globalTurnLimit !== Infinity && player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= globalTurnLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	successfulActivation() {
		this.turnActivationCount++;
	}
}

export class FastAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.globalTurnLimit = interpreter.buildAST("globalTurnLimit", ability.id, ability.globalTurnLimit, game);
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
		this.turnActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		let ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnActivationCount >= this.turnLimit.evalFull(ctx)[0].getJsNum(player)) return false;

		let gameLimit = this.gameLimit.evalFull(ctx)[0].getJsNum(player);
		if (gameLimit !== Infinity && player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= gameLimit)
			return false;

		let globalTurnLimit = this.globalTurnLimit.evalFull(ctx)[0].getJsNum(player);
		if (globalTurnLimit !== Infinity && player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= globalTurnLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	successfulActivation() {
		this.turnActivationCount++;
	}
}

export class TriggerAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.mandatory = ability.mandatory;
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.globalTurnLimit = interpreter.buildAST("globalTurnLimit", ability.id, ability.globalTurnLimit, game);
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
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
		if (this.triggerMetOnStack !== player.game.currentStack().index - 1) return false;

		let ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnActivationCount >= this.turnLimit.evalFull(ctx)[0].getJsNum(player)) return false;

		let gameLimit = this.gameLimit.evalFull(ctx)[0].getJsNum(player);
		if (gameLimit !== Infinity && player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= gameLimit)
			return false;

		let globalTurnLimit = this.globalTurnLimit.evalFull(ctx)[0].getJsNum(player);
		if (globalTurnLimit !== Infinity && player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= globalTurnLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	checkTrigger(card, player) {
		if (this.after === null) {
			return;
		}
		if (this.after.evalFull(new ScriptContext(card, player, this))[0].get(player)) {
			this.triggerMetOnStack = player.game.currentStack().index;
		}
	}

	checkDuring(card, player) {
		if (!this.during) {
			return;
		}
		if (!this.during.evalFull(new ScriptContext(card, player, this))[0].get(player)) {
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
		super(ability, game);
		this.modifier = interpreter.buildAST("modifier", ability.id, ability.modifier, game);
		this.applyTo = interpreter.buildAST("applyTarget", ability.id, ability.applyTo, game);
		this.zoneEnterTimingIndex = 0;
	}

	getTargetCards(card, player, evaluatingPlayer = player) {
		if (this.isConditionMet(card, player, evaluatingPlayer = player)) {
			return this.applyTo.evalFull(new ScriptContext(card, player, this, evaluatingPlayer))[0].get(player);
		}
		return [];
	}

	getModifier(card, player) {
		return this.modifier.evalFull(new ScriptContext(card, player, this))[0].get(player);
	}
}