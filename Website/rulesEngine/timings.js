
import {createActionCancelledEvent} from "./events.js";

// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actions, block) {
		this.index = 0;
		this.actions = actions;
		this.block = block; // block may be null
		for (let action of this.actions) {
			action.timing = this;
		}
	}
	
	// returns whether or not any substitutions were handled
	* substitute() {
		let actionCount = this.actions.length;
		let actionCancelledEvents = []
		for (let action of this.actions) {
			if (action.isImpossible()) {
				actionCancelledEvents.push(createActionCancelledEvent(action));
			}
		}
		if (actionCancelledEvents.length > 0) {
			yield actionCancelledEvents;
		}
		this.actions = this.actions.filter(action => action.isPossible());
		
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
		this.index = game.nextTimingIndex;
		while (yield* this.substitute()) {}
		
		if (asCost) {
			// empty cost counts as successful completion
			if (this.actions.length == 0) {
				game.nextTimingIndex++;
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
			events.push(yield* action.run());
		}
		yield events;
		game.nextTimingIndex++;
		return true;
	}
	
	valueOf() {
		return this.index;
	}
}