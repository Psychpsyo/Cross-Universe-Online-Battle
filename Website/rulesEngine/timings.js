
import {createActionCancelledEvent, createPlayerLostEvent, createPlayerWonEvent, createGameDrawnEvent, createCardValueChangedEvent} from "./events.js";
import {StaticAbility, TriggerAbility} from "./abilities.js";
import * as phases from "./phases.js";

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
		this.index = this.game.nextTimingIndex;

		for (let action of this.actions) {
			if (action.costIndex >= this.costCompletions.length) {
				this.costCompletions.push(true);
			}
		}

		while (yield* this.substitute()) {}

		if (this.costCompletions.length > 0) {
			// empty costs count as successful completion
			if (this.actions.length == 0 && this.costCompletions.includes(true)) {
				this.game.nextTimingIndex++;
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

		this.game.currentPhase().lastActionList = this.actions;
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
		this.game.nextTimingIndex++;
		this.successful = true;

		yield* recalculateCardValues(this.game);

		// static abilities and win/lose condition checks
		let staticsChanged = true;
		while (staticsChanged) {
			staticsChanged = await phaseStaticAbilities(this.game);
			yield* recalculateCardValues(this.game);
			yield* checkGameOver(this.game);
		}

		// check trigger ability conditions
		if (this.game.currentPhase() instanceof phases.StackPhase) {
			for (let player of game.players) {
				for (let card of player.getActiveCards()) {
					for (let ability of card.values.abilities) {
						if (ability instanceof TriggerAbility) {
							await ability.checkTrigger(card, player);
						}
					}
				}
			}
		}
	}

	async* undo() {
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
		yield* recalculateCardValues(this.game);
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
			gameOverEvents.push(createPlayerWonEvent(player));
		}
	}
	if (gameOverEvents.length > 0) {
		yield gameOverEvents;
		while (true) {
			yield [];
		}
	}
}

// iterates over all static abilities and activates/deactivates those that need it.
async function phaseStaticAbilities(game) {
	let abilitiesChanged = false;
	for (let player of game.players) {
		let activeCards = player.getActiveCards();
		for (let currentCard of activeCards) {
			for (let ability of currentCard.values.abilities) {
				if (ability instanceof StaticAbility) {
					let eligibleCards = await ability.getTargetCards(currentCard, player);
					for (let otherCard of activeCards) {
						if (eligibleCards.includes(otherCard)) {
							if (!otherCard.modifierStack.find(modifier => modifier.ability === ability)) {
								otherCard.modifierStack.push(await ability.getModifier(currentCard, player));
								abilitiesChanged = true;
							}
						} else {
							let modifierIndex = otherCard.modifierStack.findIndex(modifier => modifier.ability === ability);
							if (modifierIndex != -1) {
								otherCard.modifierStack.splice(modifierIndex, 1);
								abilitiesChanged = true;
							}
						}
					}
				}
			}
		}
	}
	return abilitiesChanged;
}

async function* recalculateCardValues(game) {
	for (let player of game.players) {
		for (let card of player.getActiveCards()) {
			let cardBaseValues = card.baseValues;
			let cardValues = card.values;
			await card.recalculateModifiedValues();

			let valueChangeEvents = [];
			for (let property of cardBaseValues.compareTo(card.baseValues)) {
				valueChangeEvents.push(createCardValueChangedEvent(card, property, true))
			}
			for (let property of cardValues.compareTo(card.values)) {
				valueChangeEvents.push(createCardValueChangedEvent(card, property, false))
			}
			if (valueChangeEvents.length > 0) {
				yield valueChangeEvents;
			}
		}
	}
}