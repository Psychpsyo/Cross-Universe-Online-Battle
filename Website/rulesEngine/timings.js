
import {createActionCancelledEvent, createPlayerWonEvent, createGameDrawnEvent, createValueChangedEvent} from "./events.js";
import {chooseAbilityOrder} from "./inputRequests.js";
import {Player} from "./player.js";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.js";
import {BaseCard} from "./card.js";
import {recalculateModifiedValuesFor} from "./valueModifiers.js";
import * as abilities from "./abilities.js";
import * as phases from "./phases.js";
import * as actions from "./actions.js";
import * as zones from "./zones.js";

// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actionList) {
		this.game = game;
		this.index = 0;
		this.actions = actionList;
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
	async* run(isPrediction = false) {
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

		// run actions and collect events
		let events = [];
		for (const action of this.actions) {
			let event = await (yield* action.run());
			if (event) {
				events.push(event);
			}
		}

		// sometimes actions prompt certain other actions to be performed at the same time
		let followupActions = this.actions;
		do {
			followupActions = this.getFollowupActions(game, followupActions);
			for (const action of followupActions) {
				let event = await (yield* action.run());
				if (event) {
					events.push(event);
				}
			}
		} while (followupActions.length > 0);

		if (events.length > 0) {
			yield events;
		}

		this.successful = true;
		this.game.currentPhase().lastActionList = this.actions;

		// TODO: The following things have proper undo support yet.
		// This *should* only matter when units turn into spells/items so for now it does not matter(?)
		// (That's because in those cases, modifiers on the card are destroyed and wouldn't properly get restored)
		let valueChangeEvents = recalculateObjectValues(this.game);
		if (valueChangeEvents.length > 0) {
			yield valueChangeEvents;
		}
		this.game.currentAttackDeclaration?.removeInvalidAttackers();

		if (!isPrediction) {
			// check win/lose conditions
			yield* checkGameOver(this.game);

			// check trigger ability conditions
			if (this.game.currentPhase() instanceof phases.StackPhase) {
				for (let player of game.players) {
					for (let card of player.getAllCards()) {
						for (let ability of card.values.current.abilities) {
							if (ability instanceof abilities.TriggerAbility ||
								ability instanceof abilities.CastAbility) {
								ability.checkTrigger(card, player);
							}
						}
					}
				}
			}
		}

		for (const timing of await (yield* runInterjectedTimings(this.game, isPrediction, this.actions))) {
			this.followupTimings.push(timing);
		}
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
		let valueChangeEvents = recalculateObjectValues(this.game);
		if (valueChangeEvents.length > 0) {
			yield valueChangeEvents;
		}
		if (events.length > 0) {
			yield events;
		}
	}

	getFollowupActions(game, lastActions = []) {
		// cards need to be revealed if added from deck to hand
		let unrevealedCards = [];
		for (const action of lastActions) {
			if (action instanceof actions.Move && action.zone.type === "hand" && action.card.zone.type === "deck") {
				if (unrevealedCards.indexOf(action.card) === -1) {
					unrevealedCards.push(action.card);
				}
			}
		}

		// decks need to be shuffled after cards are added to them.
		let unshuffledDecks = [];
		for (const action of lastActions) {
			if (action instanceof actions.Move && action.zone instanceof zones.DeckZone && action.targetIndex === null) {
				if (unshuffledDecks.indexOf(action.zone) === -1) {
					unshuffledDecks.push(action.zone);
				}
			}
			if (action instanceof actions.Swap && action.cardA?.zone instanceof zones.DeckZone || action.cardB?.zone instanceof zones.DeckZone) {
				if (action.cardA.zone instanceof zones.DeckZone) {
					unshuffledDecks.push(action.cardA.zone);
				}
				if (action.cardB.zone instanceof zones.DeckZone) {
					unshuffledDecks.push(action.cardB.zone);
				}
			}
		}

		let allActions = unshuffledDecks.map(deck => new actions.Shuffle(deck.player)).concat(unrevealedCards.map(card => new actions.View(card.currentOwner().next(), card.current())));
		if (allActions.length > 0) {
			return allActions;
		}

		// Equipments might need to be destroyed
		let invalidEquipments = [];
		for (const equipment of game.players.map(player => player.spellItemZone.cards).flat()) {
			if (equipment && (equipment.values.current.cardTypes.includes("equipableItem") || equipment.values.current.cardTypes.includes("enchantSpell")) &&
				(equipment.equippedTo === null || !equipment.equipableTo.evalFull(new ScriptContext(equipment, equipment.currentOwner()))[0].get(equipment.currentOwner()).includes(equipment.equippedTo))
			) {
				invalidEquipments.push(equipment);
			}
		}
		if (invalidEquipments.length > 0) {
			let discards = invalidEquipments.map(equipment => new actions.Discard(equipment.owner, equipment));
			return discards.concat(discards.map(discard => new actions.Destroy(
				discard,
				new ScriptValue("dueToReason", ["invalidEquipment"]),
				new ScriptValue("card", [])
			)));
		}
		return [];
	}

	valueOf() {
		return this.index;
	}
}

// This is run after every regular timing and right after blocks start and end.
// It takes care of
export async function* runInterjectedTimings(game, isPrediction) {
	let timings = [];
	let staticAbilityPhasingTiming = yield* getStaticAbilityPhasingTiming(game);
	while (staticAbilityPhasingTiming) {
		timings.push(staticAbilityPhasingTiming);
		await (yield* staticAbilityPhasingTiming.run(isPrediction));
		staticAbilityPhasingTiming = yield* getStaticAbilityPhasingTiming(game);
	}
	return timings;
}

function* checkGameOver(game) {
	let gameOverEvents = [];
	for (let player of game.players) {
		if (player.victoryConditions.length > 0) {
			if (player.next().victoryConditions.length > 0) {
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
function* getStaticAbilityPhasingTiming(game) {
	let modificationActions = []; // the list of Apply/UnapplyStaticAbility actions that this will return as a timing.
	let activeCards = game.players.map(player => player.getAllCards()).flat();
	let possibleTargets = activeCards.concat(game.players);
	let newApplications = new Map();
	for (let currentCard of activeCards) {
		for (let ability of currentCard.values.current.abilities) {
			if (ability instanceof abilities.StaticAbility) {
				let eligibleTargets = ability.getTargets(currentCard, currentCard.currentOwner());
				for (let target of possibleTargets) {
					if (eligibleTargets.includes(target)) {
						if (!target.values.modifierStack.find(modifier => modifier.ctx.ability === ability)) {
							// abilities are just dumped in a list here to be sorted later.
							let modifiers = newApplications.get(target) ?? [];
							modifiers.push({
								ability: ability,
								source: currentCard
							});
							newApplications.set(target, modifiers);
						}
					} else {
						if (target.values.modifierStack.find(modifier => modifier.ctx.ability === ability)) {
							modificationActions.push(new actions.UnapplyStaticAbility(
								currentCard.currentOwner(), // have these be owned by the player that owns the card with the ability.
								target,
								ability
							));
						}
					}
				}
			}
		}
	}

	for (const [target, applications] of newApplications) {
		let fieldEnterBuckets = {};
		for (let i = applications.length - 1; i >= 0; i--) {
			// a card's own abilities go first.
			if (target instanceof BaseCard && applications[i].source === target) {
				modificationActions.push(new actions.ApplyStaticAbility(
					applications[i].source.currentOwner(), // have these be owned by the player that owns the card with the ability.
					target,
					applications[i].ability.getModifier(applications[i].source, applications[i].source.currentOwner())
				));
				applications.splice(i, 1);
			} else {
				// otherwise the applications get ordered by when they entered the field
				const lastMoved = applications[i].ability.zoneEnterTimingIndex;
				if (fieldEnterBuckets[lastMoved] === undefined) {
					fieldEnterBuckets[lastMoved] = [];
				}
				fieldEnterBuckets[lastMoved].push(applications[i]);
			}
		}

		// sort abilities by when they were put on the field, then by application category bucket. (whose field they are on)
		for (const timing of Object.keys(fieldEnterBuckets).sort()) {
			let applyBuckets = [];
			switch (true) {
				case target instanceof BaseCard: { // applying to cards
					applyBuckets.push({player: target.currentOwner(), applications: []}); // abilities on same side of field
					applyBuckets.push({player: target.currentOwner().next(), applications: []}); // abilities on other side of field
					for (const application of fieldEnterBuckets[timing]) {
						if (application.source.currentOwner() === target.currentOwner()) {
							applyBuckets[0].applications.push(application);
						} else {
							applyBuckets[1].applications.push(application);
						}
					}
					break;
				}
				case target instanceof Player: { // applying to players
					applyBuckets.push({player: target, applications: []}); // abilities on same side of field
					applyBuckets.push({player: target.next(), applications: []}); // abilities on other side of field
					for (const application of fieldEnterBuckets[timing]) {
						if (application.source.currentOwner() === target) {
							applyBuckets[0].applications.push(application);
						} else {
							applyBuckets[1].applications.push(application);
						}
					}
					break;
				}
				default: { // applying to everything else (game processes like fights)
					applyBuckets.push({player: game.currentTurn().player, applications: []}); // abilities owned by the turn player
					applyBuckets.push({player: game.currentTurn().player.next(), applications: []}); // abilities owned by the non-turn player
					for (const application of fieldEnterBuckets[timing]) {
						if (application.source.currentOwner() === buckets[0].player) {
							applyBuckets[0].applications.push(application);
						} else {
							applyBuckets[1].applications.push(application);
						}
					}
				}
			}

			// ordering abilities in the buckets
			for (const bucket of applyBuckets) {
				if (bucket.applications.length === 0) continue;

				let orderedAbilities = [0];
				// is sorting necessary for this bucket?
				if (bucket.applications.length !== 1) {
					const request = chooseAbilityOrder.create(bucket.player, target, bucket.applications.map(elem => elem.ability));
					const response = yield [request];
					if (response.type != "chooseAbilityOrder") {
						throw new Error("Wrong response type supplied during ability ordering (expected 'chooseAbilityOrder', got '" + response.type + "')");
					}
					orderedAbilities = chooseAbilityOrder.validate(response.value, request);
				}
				// actually apply the abilities
				for (const index of orderedAbilities) {
					const application = bucket.applications[index];
					modificationActions.push(new actions.ApplyStaticAbility(
						application.source.currentOwner(), // have these be owned by the player that owns the card with the ability.
						target,
						application.ability.getModifier(application.source, application.source.currentOwner())
					));
				}
			}
		}
	}

	if (modificationActions.length === 0) {
		return null;
	}
	return new Timing(game, modificationActions);
}

function recalculateObjectValues(game) {
	let valueChangeEvents = [];
	for (let player of game.players) {
		// recalculate the player's own values
		const oldPlayerValues = player.values.clone();
		recalculateModifiedValuesFor(player);
		for (let property of oldPlayerValues.base.compareTo(player.values.base)) {
			valueChangeEvents.push(createValueChangedEvent(player, property, true));
		}
		for (let property of oldPlayerValues.current.compareTo(player.values.current)) {
			valueChangeEvents.push(createValueChangedEvent(player, property, false));
		}

		// recalculate the values for the player's cards
		for (let card of player.getActiveCards()) {
			let oldCard = card.snapshot();
			let wasUnit = card.values.current.cardTypes.includes("unit");
			recalculateModifiedValuesFor(card);
			// once done, unit specific modifications may need to be removed.
			if (wasUnit && !card.values.current.cardTypes.includes("unit")) {
				card.canAttackAgain = false;
				for (let i = card.values.modifierStack.length - 1; i >= 0; i--) {
					if (card.values.modifierStack[i].removeUnitSpecificModifications()) {
						card.values.modifierStack.splice(i, 1);
					}
				}
			}

			for (let property of oldCard.values.base.compareTo(card.values.base)) {
				valueChangeEvents.push(createValueChangedEvent(card, property, true));
			}
			for (let property of oldCard.values.current.compareTo(card.values.current)) {
				if (valueChangeEvents.find(event => event.valueName === property) === undefined) {
					valueChangeEvents.push(createValueChangedEvent(card, property, false));
				}
			}
		}
	}
	return valueChangeEvents;
}