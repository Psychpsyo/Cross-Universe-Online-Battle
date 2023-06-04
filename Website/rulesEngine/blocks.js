
import {Timing} from "./timings.js";
import * as actions from "./actions.js";

// Base class for all blocks
class Block {
	constructor(stack, player, type) {
		this.player = player;
		this.stack = stack;
		this.type = type;
		this.costTiming = null;
		this.executionTimings = [];
	}
	
	* runCost() {
		if (this.costTiming) {
			yield* this.costTiming.run(true);
		}
	}
	
	* run() {
		for (let timing of this.executionTimings) {
			yield* timing.run();
		}
	}
	
	getCostTiming() {
		return this.costTiming;
	}
	getExecutionTimings() {
		return this.executionTimings;
	}
}

export class StandardDraw extends Block {
	constructor(stack, player) {
		super(stack, player, "standardDraw");
		this.executionTimings = [new Timing(
			stack.phase.turn.game,
			[new actions.DrawAction(player, 1)],
			this
		)];
	}
}