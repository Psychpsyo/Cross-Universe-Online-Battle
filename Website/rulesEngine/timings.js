
// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actions, block) {
		this.index = 0;
		this.actions = actions;
		this.block = block; // block may be null
	}
	
	// returns whether or not any substitutions were handled
	* substitute() {
		let actionCount = this.actions.length;
		this.actions.filter(action => action.isPossible());
		
		if (actionCount != this.actions.length) {
			return true;
		}
		return false;
	}
	
	isFullyPossible() {
		for (let action of this.actions) {
			if (!action.isFullyPossible) {
				return false;
			}
		}
		return true;
	}
	
	// returns whether or not the timing completed sucessfully
	async* run(asCost = false) {
		this.index = game.lastTiming;
		while (yield* this.substitute()) {}
		
		if (asCost) {
			// empty cost counts as successful completion
			if (this.actions.length == 0) {
				game.lastTiming++;
				return true;
			}
			if (!this.isFullyPossible()) {
				return false;
			}
		}
		// regular, non-cost empty timings are not successful, they interrupt their block.
		if (this.actions.length == 0) {
			return false;
		}
		
		let events = [];
		for (let action of this.actions) {
			events.push(action.run());
		}
		yield events;
		game.lastTiming++;
		return true;
	}
	
	valueOf() {
		return this.index;
	}
}