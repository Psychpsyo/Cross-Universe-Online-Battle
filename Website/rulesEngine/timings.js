
import {createActionCancelledEvent, createPlayerLostEvent, createPlayerWonEvent, createGameDrawnEvent, createCardValueChangedEvent} from "./events.js";
import * as abilities from "./abilities.js";
import * as phases from "./phases.js";
import * as actions from "./actions.js";

// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actionList, block) {
		this.game = game;
		this.index = 0;
		this.actions = actionList;
		this.block = block; // block may be null
		for (const action of this.actions) {
			action.timing = this;
		}
		this.costCompletions = [];
		this.successful = false;
		this.followupTimings = [];
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
			let event = await (yield* action.run());
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
			staticsChanged = phaseStaticAbilities(this.game);
			yield* recalculateCardValues(this.game);
			yield* checkGameOver(this.game);
		}

		// check trigger ability conditions
		if (this.game.currentPhase() instanceof phases.StackPhase) {
			for (let player of game.players) {
				for (let card of player.getActiveCards()) {
					for (let ability of card.values.abilities) {
						if (ability instanceof abilities.TriggerAbility ||
							ability instanceof abilities.CastAbility ||
							ability instanceof abilities.DeployAbility) {
							ability.checkTrigger(card, player);
						}
					}
				}
			}
		}

		this.followupTimings = await (yield* runFollowupTimings(this.block, this.game));
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
		if (events.length > 0) {
			yield events;
		}
	}

	valueOf() {
		return this.index;
	}
}

export async function* runFollowupTimings(block, game) {
	let timings = [];
	let interjected = getFollowupTiming(block, game);
	while (interjected) {
		timings.push(interjected);
		await (yield* interjected.run());
		interjected = getFollowupTiming(block, game);
	}
	return timings;
}
function getFollowupTiming(block, game) {
	let invalidEquipments = [];
	for (const equipment of game.players.map(player => player.spellItemZone.cards).flat()) {
		if (equipment && (equipment.values.cardTypes.includes("equipableItem") || equipment.values.cardTypes.includes("enchantSpell")) &&
			!equipment.equipableTo.evalFull(equipment, equipment.zone.player, null).includes(equipment.equippedTo)
		) {
			invalidEquipments.push(equipment);
		}
	}
	if (invalidEquipments.length > 0) {
		let discards = invalidEquipments.map(equipment => new actions.Discard(equipment));
		return new Timing(game, discards.concat(discards.map(discard => new actions.Destroy(discard))), block);
	}
	return null;
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
function phaseStaticAbilities(game) {
	let abilitiesChanged = false;
	let activeCards = game.players.map(player => player.getActiveCards()).flat();
	for (let currentCard of activeCards) {
		for (let ability of currentCard.values.abilities) {
			if (ability instanceof abilities.StaticAbility) {
				let eligibleCards = ability.getTargetCards(currentCard, currentCard.zone.player);
				for (let otherCard of activeCards) {
					if (eligibleCards.includes(otherCard)) {
						if (!otherCard.modifierStack.find(modifier => modifier.ability === ability)) {
							otherCard.modifierStack.push(ability.getModifier(currentCard, currentCard.zone.player));
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
	return abilitiesChanged;
}

function* recalculateCardValues(game) {
	for (let player of game.players) {
		for (let card of player.getActiveCards()) {
			let cardBaseValues = card.baseValues;
			let cardValues = card.values;
			card.recalculateModifiedValues();

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