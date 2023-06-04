
import {Timing} from "./timings.js";
import * as actions from "./actions.js";

// Base class for all blocks
class Block {
	constructor(stack, player, type, costTiming, executionTimings) {
		this.player = player;
		this.stack = stack;
		this.type = type;
		this.costTiming = costTiming;
		this.executionTimings = executionTimings;
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
		super(stack, player, "standardDraw", null, [
			new Timing(
				stack.phase.turn.game,
				[new actions.DrawAction(player, 1)],
				this
			)
		]);
	}
}