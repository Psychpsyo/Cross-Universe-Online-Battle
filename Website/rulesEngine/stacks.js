
import * as requests from "./inputRequests.js";
import * as blocks from "./blocks.js";
import {createBlockCreatedEvent, createBlockCreationAbortedEvent, createStackStartedEvent, createBlockStartedEvent} from "./events.js"

export class Stack {
	constructor(phase, index) {
		this.phase = phase;
		this.index = index;
		this.blocks = [];
		this.passed = false;
	}

	async* run() {
		while (true) {
			let inputRequests = this.phase.getBlockOptions(this);
			let responses = (yield inputRequests).filter(choice => choice !== undefined);

			if (responses.length != 1) {
				throw new Error("Incorrect number of responses supplied during block creation. (expected 1, got " + responses.length + " instead)");
			}

			let response = responses[0];
			response.value = requests[response.type].validate(response.value, inputRequests.find(request => request.type == response.type));

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
					nextBlock = new blocks.StandardSummon(this, this.getNextPlayer(),
						this.getNextPlayer().handZone.cards[response.value.handIndex],
						response.value.fieldIndex
					);
					break;
				}
				case "deployItem": {
					nextBlock = new blocks.DeployItem(this, this.getNextPlayer(),
						this.getNextPlayer().handZone.cards[response.value.handIndex],
						response.value.fieldIndex
					);
					break;
				}
				case "castSpell": {
					nextBlock = new blocks.CastSpell(this, this.getNextPlayer(),
						this.getNextPlayer().handZone.cards[response.value.handIndex],
						response.value.fieldIndex
					);
					break;
				}
				case "doAttackDeclaration": {
					nextBlock = new blocks.AttackDeclaration(this, this.getNextPlayer(), response.value);
					break;
				}
				case "doFight": {
					nextBlock = new blocks.Fight(this, this.getNextPlayer());
					break;
				}
				case "doRetire": {
					nextBlock = new blocks.Retire(this, this.getNextPlayer(), response.value);
					break;
				}
				case "activateOptionalAbility": {
					let ability = response.value.card.abilities.get()[response.value.index];
					nextBlock = new blocks.AbilityActivation(this, this.getNextPlayer(), response.value.card, ability);
					break;
				}
			}
			if (response.type != "pass") {
				if (await (yield* nextBlock.runCost())) {
					this.passed = false;
					this.blocks.push(nextBlock);
					yield [createBlockCreatedEvent(nextBlock)];
				} else {
					yield [createBlockCreationAbortedEvent(nextBlock)];
				}
			}
		}
	}

	getTimings() {
		let costTimings = this.blocks.map(block => block.getCostTiming());
		let executionTimings = [...this.blocks].reverse().map(block => block.getExecutionTimings()).flat();
		return costTimings.concat(executionTimings);
	}
	getActions() {
		let costActions = this.blocks.map(block => block.getCostActions());
		let executionActions = [...this.blocks].reverse().map(block => block.getExecutionActions()).flat();
		return costActions.concat(executionActions);
	}

	async* executeBlocks() {
		for (let i = this.blocks.length - 1; i >= 0; i--) {
			yield [createBlockStartedEvent(this.blocks[i])];
			yield* this.blocks[i].run();
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