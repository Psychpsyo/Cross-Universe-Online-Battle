
// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(block, actions) {
		block.stack.phase.turn.game.lastTiming++;
		this.index = block.stack.phase.turn.game.lastTiming;
		this.block = block;
		this.actions = actions;
	}
	
	* run() {}
	
	valueOf() {
		return this.index;
	}
}