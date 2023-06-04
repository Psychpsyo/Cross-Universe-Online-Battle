
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
	
	async* runCost() {
		if (this.costTiming == null) {
			return true;
		}
		return yield* this.costTiming.run(true);
	}
	
	async* run() {
		for (let i = 0; i < this.executionTimings.length; i++) {
			// if a timing can't be done interrupt the block and remove all other queued timings.
			if (!(yield* this.executionTimings[i].run())) {
				this.executionTimings.splice(i);
				break;
			}
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