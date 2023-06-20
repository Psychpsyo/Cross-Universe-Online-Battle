
import {createActionCancelledEvent, createPlayerLostEvent, createPlayerWonEvent, createGameDrawnEvent} from "./events.js";

// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actions, block) {
		this.game = game;
		this.index = 0;
		this.actions = actions;
		this.block = block; // block may be null
		for (let action of this.actions) {
			action.timing = this;
		}
		this.costCompletions = [];
		this.successful = false;
	}

	// returns whether or not any substitutions were handled
	* substitute() {
		let actionCount = this.actions.length;
		let actionCancelledEvents = []
		for (let i = 0; i < this.actions.length; i++) {
			if (this.actions[i].isImpossible(this)) {
				let action = this.actions[i];
				this.actions.splice(i, 1);
				i--;
				actionCancelledEvents.push(createActionCancelledEvent(action));
				if (action.costIndex >= 0) {
					this.costCompletions[action.costIndex] = false;
					for (let j = this.actions.length - 1; j >= 0; j--) {
						if (this.actions[j].costIndex == action.costIndex) {
							this.actions.splice(j, i);
							if (j <= i) {
								i--;
							}
						}
					}
				}
			}
		}
		if (actionCancelledEvents.length > 0) {
			yield actionCancelledEvents;
		}

		if (actionCount != this.actions.length) {
			return true;
		}
		return false;
	}

	isFullyPossible(costIndex) {
		for (let action of this.actions) {
			if (action.costIndex == costIndex && !action.isFullyPossible(this)) {
				return false;
			}
		}
		return true;
	}

	// returns whether or not the timing completed sucessfully
	async* run() {
		this.index = game.nextTimingIndex;

		for (let action of this.actions) {
			if (action.costIndex >= this.costCompletions.length) {
				this.costCompletions.push(true);
			}
		}

		while (yield* this.substitute()) {}

		if (this.costCompletions.length > 0) {
			// empty costs count as successful completion
			if (this.actions.length == 0 && this.costCompletions.includes(true)) {
				game.nextTimingIndex++;
				this.successful = true;
				return;
			}
			for (let i = 0; i < this.costCompletions.length; i++) {
				this.costCompletions[i] = this.costCompletions[i] && this.isFullyPossible(i);
			}
			for (let i = this.actions.length - 1; i >= 0; i--) {
				if (!this.costCompletions[this.actions[i].costIndex]) {
					this.actions.splice(i, 1);
				}
			}
		}
		// empty timings are not successful, they interrupt their block or indicate that paying all costs failed.
		if (this.actions.length == 0) {
			return;
		}

		let events = [];
		for (let action of this.actions) {
			let event = yield* action.run();
			if (event) {
				events.push(event);
			}
		}
		if (events.length > 0) {
			yield events;
		}
		game.nextTimingIndex++;
		this.successful = true;

		// check win/lose conditions
		yield* checkGameOver(this.game);
	}

	* undo() {
		// check if this timing actually ran
		if (!this.successful) {
			return;
		}
		let events = [];
		for (let action of this.actions) {
			let event = action.undo();
			if (event) {
				events.push(event);
			}
		}
		yield events;
	}

	valueOf() {
		return this.index;
	}
}

function* checkGameOver(game) {
	let gameOverEvents = [];
	for (let player of game.players) {
		if (player.lost) {
			if (player.next().lost || player.won) {
				gameOverEvents.push(createGameDrawnEvent());
				break;
			}
			gameOverEvents.push(createPlayerLostEvent(player));
		}
		if (player.won) {
			if (player.next().won || player.lost) {
				gameOverEvents.push(createGameDrawnEvent());
				break;
			}
			gameOverEvents.push(createPlayerLostEvent(player));
		}
	}
	if (gameOverEvents.length > 0) {
		yield gameOverEvents;
		while (true) {
			yield [];
		}
	}
}