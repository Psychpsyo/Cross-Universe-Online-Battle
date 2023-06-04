
// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actions, block) {
		game.lastTiming++;
		this.index = game.lastTiming;
		this.actions = actions;
		this.block = block; // block may be null
	}
	
	* run(asCost = false) {
		this.actions.filter(action => action.isPossible());
		
		let events = [];
		for (let action of this.actions) {
			events.push(action.run());
		}
		yield events;
		return this.actions.length;
	}
	
	valueOf() {
		return this.index;
	}
}