
// Base class for all blocks
class Block {
	constructor(stack, type, costTiming, executionTimings) {
		this.stack = stack;
		this.type = type;
		this.costTiming = costTiming;
		this.executionTimings = executionTimings;
	}
	
	* run() {}
	
	getCostTiming() {
		return this.costTiming;
	}
	getExecutionTimings() {
		return this.executionTimings;
	}
}
