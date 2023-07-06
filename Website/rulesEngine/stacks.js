
import * as requests from "./inputRequests.js";
import * as blocks from "./blocks.js";
import {createBlockCreatedEvent, createBlockCreationAbortedEvent, createStackStartedEvent, createBlockStartedEvent} from "./events.js"
import * as abilities from "./abilities.js";

export class Stack {
	constructor(phase, index) {
		this.phase = phase;
		this.index = index;
		this.blocks = [];
		this.passed = false;
		this.processed = false;
	}

	async* run() {
		while (true) {
			let inputRequests = await this.phase.getBlockOptions(this);
			let responses = (yield inputRequests).filter(choice => choice !== undefined);

			if (responses.length != 1) {
				throw new Error("Incorrect number of responses supplied during block creation. (expected 1, got " + responses.length + " instead)");
			}

			let response = responses[0];
			let responseValue = requests[response.type].validate(response.value, inputRequests.find(request => request.type == response.type));

			let nextBlock;
			switch (response.type) {
				case "pass": {
					if (this.passed) {
						yield [createStackStartedEvent(this)];
						yield* this.executeBlocks();
						return;
					}
					this.passed = true;
					break;
				}
				case "doStandardDraw": {
					nextBlock = new blocks.StandardDraw(this, this.getNextPlayer());
					break;
				}
				case "doStandardSummon": {
					nextBlock = new blocks.StandardSummon(this, this.getNextPlayer(), this.getNextPlayer().handZone.cards[responseValue]);
					break;
				}
				case "deployItem": {
					nextBlock = new blocks.DeployItem(this, this.getNextPlayer(), this.getNextPlayer().handZone.cards[responseValue]);
					break;
				}
				case "castSpell": {
					nextBlock = new blocks.CastSpell(this, this.getNextPlayer(), this.getNextPlayer().handZone.cards[responseValue]);
					break;
				}
				case "doAttackDeclaration": {
					nextBlock = new blocks.AttackDeclaration(this, this.getNextPlayer(), responseValue);
					break;
				}
				case "doFight": {
					nextBlock = new blocks.Fight(this, this.getNextPlayer());
					break;
				}
				case "doRetire": {
					nextBlock = new blocks.Retire(this, this.getNextPlayer(), responseValue);
					break;
				}
				case "activateOptionalAbility":
				case "activateFastAbility":
				case "activateTriggerAbility": {
					let ability = responseValue.card.values.abilities[responseValue.index];
					nextBlock = new blocks.AbilityActivation(this, this.getNextPlayer(), responseValue.card, ability);
					break;
				}
			}
			if (response.type != "pass") {
				this.blocks.push(nextBlock);
				if (await (yield* nextBlock.runCost())) {
					this.passed = false;
					yield [createBlockCreatedEvent(nextBlock)];
				} else {
					this.blocks.pop();
					yield [createBlockCreationAbortedEvent(nextBlock)];
				}
			}
		}
	}

	getTimings() {
		let costTimings = this.blocks.map(block => block.getCostTimings()).flat();
		let executionTimings = this.blocks.toReversed().map(block => block.getExecutionTimings()).flat();
		return costTimings.concat(executionTimings);
	}
	getActions() {
		let costActions = this.blocks.map(block => block.getCostActions());
		let executionActions = this.blocks.toReversed().map(block => block.getExecutionActions()).flat();
		return costActions.concat(executionActions);
	}

	async* executeBlocks() {
		// unmeet trigger abilities
		for (let player of this.phase.turn.game.players) {
			for (let card of player.getActiveCards()) {
				for (let ability of card.values.abilities) {
					if (ability instanceof abilities.TriggerAbility ||
						ability instanceof abilities.CastAbility ||
						ability instanceof abilities.DeployAbility
					) {
						ability.triggerMet = false;
					}
				}
			}
		}

		for (let i = this.blocks.length - 1; i >= 0; i--) {
			yield [createBlockStartedEvent(this.blocks[i])];
			yield* this.blocks[i].run();
		}
		this.processed = true;
	}

	async* undoCreateBlock() {
		this.blocks.pop().undoCost();
	}

	async* undoExecuteBlocks() {
		for (let block of this.blocks) {
			yield* block.undoExecution();
		}
		this.processed = false;
	}

	async* undo() {
		if (this.processed) {
			yield* this.undoExecuteBlocks();
		}
		while (this.blocks.length > 0) {
			yield* this.undoCreateBlock();
		}
	}

	getNextPlayer() {
		let player = this.phase.turn.player;
		if (this.blocks.length > 0) {
			player = this.blocks[this.blocks.length - 1].player.next();
		}
		return this.passed? player.next() : player;
	}

	canDoNormalActions() {
		return this.blocks.length == 0 && this.index == 1 && this.getNextPlayer() == this.phase.turn.player;
	}
}