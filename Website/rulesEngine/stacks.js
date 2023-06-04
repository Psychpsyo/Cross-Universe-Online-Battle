
import * as requests from "./inputRequests.js";
import * as blocks from "./blocks.js";

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
				}
			}
			if (response.type != "pass") {
				this.passed = false;
				
				if (await (yield* nextBlock.runCost())) {
					this.blocks.push(nextBlock);
				}
			}
		}
	}
	
	getTimings() {
		let costTimings = this.blocks.map(block => block.getCostTiming());
		let actionTimings = [...this.blocks].reverse().map(block => block.getExecutionTimings()).flat();
		return costTimings.concat(actionTimings);
	}
	
	async* executeBlocks() {
		for (let i = this.blocks.length - 1; i >= 0; i--) {
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