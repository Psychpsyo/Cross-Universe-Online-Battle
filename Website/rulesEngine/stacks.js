
export class Stack {
	constructor(phase, index) {
		this.phase = phase;
		this.index = index;
		this.blocks = [];
	}
	
	* run() {}
	
	getTimings() {
		let costTimings = this.blocks.map(block => block.getCostTiming());
		let actionTimings = [...this.blocks].reverse().map(block => block.getExecutionTimings()).flat();
		return costTimings.concat(actionTimings);
	}
}