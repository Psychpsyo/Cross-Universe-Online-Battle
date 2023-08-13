
import {createActionCancelledEvent, createPlayerLostEvent, createPlayerWonEvent, createGameDrawnEvent, createCardValueChangedEvent} from "./events.js";
import * as abilities from "./abilities.js";
import * as phases from "./phases.js";
import * as actions from "./actions.js";
import {chooseAbilityOrder} from "./inputRequests.js";

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
		this.game.nextTimingIndex++;

		for (let action of this.actions) {
			if (action.costIndex >= this.costCompletions.length) {
				this.costCompletions.push(true);
			}
		}

		while (yield* this.substitute()) {}

		if (this.costCompletions.length > 0) {
			// empty costs count as successful completion
			if (this.actions.length == 0 && this.costCompletions.includes(true)) {
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
			this.game.nextTimingIndex--;
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
		this.successful = true;

		yield* recalculateCardValues(this.game);

		// static abilities and win/lose condition checks
		let staticsChanged = true;
		while (staticsChanged) {
			staticsChanged = yield* phaseStaticAbilities(this.game);
			yield* recalculateCardValues(this.game);
			yield* checkGameOver(this.game);
		}

		// check trigger ability conditions
		if (this.game.currentPhase() instanceof phases.StackPhase) {
			for (let player of game.players) {
				for (let card of player.getActiveCards()) {
					for (let ability of card.values.abilities) {
						if (ability instanceof abilities.TriggerAbility ||
							ability instanceof abilities.CastAbility) {
							ability.checkTrigger(card, player);
						}
					}
				}
			}
		}

		this.followupTimings = await (yield* runFollowupTimings(this.block, this.game, this));
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

export async function* runFollowupTimings(block, game, timing = null) {
	let timings = [];
	let interjected = getFollowupTiming(block, game, timing);
	while (interjected) {
		timings.push(interjected);
		await (yield* interjected.run());
		interjected = getFollowupTiming(block, game, interjected);
	}
	return timings;
}
function getFollowupTiming(block, game, timing) {
	if (timing) {
		// decks need to be shuffled after cards are added to them.
		let unshuffledDecks = [];
		for (const action of timing.actions) {
			if (action instanceof actions.Move && action.zone.type === "deck" && action.targetIndex === null) {
				if (unshuffledDecks.indexOf(action.zone) === -1) {
					unshuffledDecks.push(action.zone);
				}
			}
		}

		// cards need to be revealed if added from deck to hand
		let unrevealedCards = [];
		for (const action of timing.actions) {
			if (action instanceof actions.Move && action.zone.type === "hand" && action.card.zone.type === "deck") {
				if (unrevealedCards.indexOf(action.card) === -1) {
					unrevealedCards.push(action.card);
				}
			}
		}

		let allActions = unshuffledDecks.map(deck => new actions.Shuffle(deck.player)).concat(unrevealedCards.map(card => new actions.View(card.cardRef, card.zone.player.next())));
		if (allActions.length > 0) {
			return new Timing(game, allActions, block);
		}
	}

	let invalidEquipments = [];
	for (const equipment of game.players.map(player => player.spellItemZone.cards).flat()) {
		if (equipment && (equipment.values.cardTypes.includes("equipableItem") || equipment.values.cardTypes.includes("enchantSpell")) &&
			!equipment.equipableTo.evalFull(equipment, equipment.zone.player, null)[0].includes(equipment.equippedTo)
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
function* phaseStaticAbilities(game) {
	let abilitiesChanged = false;
	let activeCards = game.players.map(player => player.getActiveCards()).flat();
	let newApplications = new Map();
	for (let currentCard of activeCards) {
		for (let ability of currentCard.values.abilities) {
			if (ability instanceof abilities.StaticAbility) {
				let eligibleCards = ability.getTargetCards(currentCard, currentCard.zone.player);
				for (let otherCard of activeCards) {
					if (eligibleCards.includes(otherCard)) {
						if (!otherCard.modifierStack.find(modifier => modifier.ability === ability)) {
							// abilities are just dumped in a list here to be sorted later.
							let modifiers = newApplications.get(otherCard) ?? [];
							modifiers.push({
								ability: ability,
								source: currentCard
							});
							newApplications.set(otherCard, modifiers);
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

	for (const [card, value] of newApplications) {
		let fieldEnterBuckets = [{}, {}];
		for (let i = value.length - 1; i >= 0; i--) {
			if (value[i].source === card) {
				card.modifierStack.push(value[i].ability.getModifier(value[i].source, value[i].source.zone.player));
				value.splice(i, 1);
			} else {
				let fieldIndex = value[i].source.zone.player.index;
				let lastMoved = value[i].source.lastMoveTimingIndex;
				if (fieldEnterBuckets[fieldIndex][lastMoved] === undefined) {
					fieldEnterBuckets[fieldIndex][lastMoved] = [];
				}
				fieldEnterBuckets[fieldIndex][lastMoved].push(value[i]);
			}
		}

		for (const fieldIndex of [card.zone.player.index, card.zone.player.next().index]) {
			for (const timing of Object.keys(fieldEnterBuckets[fieldIndex]).sort()) {
				let orderedAbilities = [0];
				if (fieldEnterBuckets[fieldIndex][timing].length !== 1) {
					let request = chooseAbilityOrder.create(game.players[fieldIndex], card, fieldEnterBuckets[fieldIndex][timing].map(elem => elem.ability));
					let responses = yield [request];
					if (responses.length != 1) {
						throw new Error("Incorrect number of responses supplied during ability ordering. (expected 1, got " + responses.length + " instead)");
					}
					if (responses[0].type != "chooseAbilityOrder") {
						throw new Error("Wrong response type supplied during ability ordering (expected 'chooseAbilityOrder', got '" + responses[0].type + "')");
					}
					orderedAbilities = chooseAbilityOrder.validate(responses[0].value, request);
				}
				for (let index of orderedAbilities) {
					let application = fieldEnterBuckets[fieldIndex][timing][index];
					card.modifierStack.push(application.ability.getModifier(application.source, application.source.zone.player));
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