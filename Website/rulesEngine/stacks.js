
import * as requests from "./inputRequests.js";
import * as blocks from "./blocks.js";

export class Stack {
	constructor(phase, index) {
		this.phase = phase;
		this.index = index;
		this.blocks = [];
		this.passed = false;
	}
	
	* run() {
		while (true) {
			let responses = (yield this.phase.getBlockOptions(this)).filter(choice => choice !== undefined);
			
			if (responses.length != 1) {
				throw new Error("Incorrect number of responses supplied during block creation. (expected 1, got " + responses.length + " instead)");
			}
			
			let response = responses[0];
			response.value = requests[response.type].validate(response.value);
			
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
					this.blocks.push(new blocks.StandardDraw(this, this.getNextPlayer()))
					break;
				}
			}
			if (response.type != "pass") {
				this.passed = false;
			}
		}
	}
	
	getTimings() {
		let costTimings = this.blocks.map(block => block.getCostTiming());
		let actionTimings = [...this.blocks].reverse().map(block => block.getExecutionTimings()).flat();
		return costTimings.concat(actionTimings);
	}
	
	* executeBlocks() {
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
}