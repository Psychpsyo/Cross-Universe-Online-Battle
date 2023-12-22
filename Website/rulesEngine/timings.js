
import {createActionCancelledEvent, createPlayerWonEvent, createGameDrawnEvent, createValueChangedEvent, createReplacementAbilityAppliedEvent} from "./events.js";
import {chooseAbilityOrder, applyReplacementAbility} from "./inputRequests.js";
import {Player} from "./player.js";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.js";
import {BaseCard} from "./card.js";
import {recalculateModifiedValuesFor, ActionReplaceModification} from "./valueModifiers.js";
import * as abilities from "./abilities.js";
import * as phases from "./phases.js";
import * as actions from "./actions.js";
import * as zones from "./zones.js";
import * as ast from "./cdfScriptInterpreter/astNodes.js";

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
		this.followupTiming = [];
	}

	// replaces the given action, if possible
	_replaceAction(action, replacements) {
		// replacing a destroy also replaces the corresponding discard
		if (action instanceof actions.Destroy) {
			this.actions.splice(this.actions.indexOf(action.discard), 1);
		}
		// replacing a destroy's internal discard needs to update the destroy.
		for (const destroy of this.actions) {
			if (destroy instanceof actions.Destroy && destroy.discard === action) {
				// TODO: figure out if a destroy's discard action can ever be replaced by multiple things
				destroy.replaceDiscardWith(replacements[0]);
			}
		}
		// actually replace the action
		this.actions.splice(this.actions.indexOf(action), 1, ...replacements);
	}

	// returns a list of actionCancelled events
	_cancelImpossibleActions() {
		const actionCancelledEvents = [];
		for (let i = 0; i < this.actions.length; i++) {
			if (this.actions[i].isImpossible()) {
				const action = this.actions[i];
				this.actions.splice(i, 1);
				i--;
				actionCancelledEvents.push(createActionCancelledEvent(action));
				if (action.costIndex >= 0) {
					this.costCompletions[action.costIndex] = false;
					for (let j = this.actions.length - 1; j >= 0; j--) {
						if (this.actions[j].costIndex === action.costIndex) {
							this.actions.splice(j, i);
							if (j <= i) {
								i--;
							}
						}
					}
				}
			}
		}
		return actionCancelledEvents;
	}

	// applies static abilities like that on 'Substitution Doll'
	* _handleSubstitutionAbilities() {
		const activeCards = game.players.map(player => player.getAllCards()).flat();
		const possibleTargets = activeCards.concat(game.players);
		const newApplications = new Map();
		for (const currentCard of activeCards) {
			for (const ability of currentCard.values.current.abilities) {
				if (ability instanceof abilities.StaticAbility && ability.modifier.modifications[0] instanceof ActionReplaceModification) {
					const eligibleTargets = ability.getTargets(currentCard, currentCard.currentOwner());
					for (const target of possibleTargets) {
						if (eligibleTargets.includes(target)) {
							// abilities are just dumped in a list here to be sorted later.
							const applications = newApplications.get(target) ?? [];
							applications.push(new StaticAbilityApplication(ability, currentCard));
							newApplications.set(target, applications);
						}
					}
				}
			}
		}

		for (const [target, applications] of newApplications) {
			for (const application of yield* orderStaticAbilityApplications(target, applications)) {
				const modifier = application.getModifier();
				for (const modification of modifier.modifications) {
					for (let i = 0; i < this.actions.length; i++) {
						ast.setImplicit([this.actions[i]], "action");
						const doesMatch = (yield* modification.toReplace.eval(modifier.ctx)).get();
						ast.clearImplicit("action");
						if (!doesMatch) continue;
						// otherwise, this action can be replaced

						// gather replacements
						let replacements = null;
						for (const output of modification.replacement.eval(modifier.ctx)) {
							if (output[0] instanceof actions.Action) {
								replacements = output;
								break;
							}
							yield output;
						}

						// process replacements
						let foundInvalidReplacement = false;
						for (const replacement of replacements) {
							replacement.costIndex = this.actions[i].costIndex;
							replacement.timing = this;

							if (!replacement.isFullyPossible()) {
								foundInvalidReplacement = true;
								break;
							}
						}
						if (foundInvalidReplacement) continue;

						// ask player if they want to apply optional replacement
						if (!application.ability.mandatory) {
							const response = yield [applyReplacementAbility.create(application.source.currentOwner(), application.ability, application.source)];
							response.value = applyReplacementAbility.validate(response.value);
							if (!response.value) continue;
						}

						// apply the replacements
						yield [createReplacementAbilityAppliedEvent(application.source, application.ability)];
						this._replaceAction(this.actions[i], replacements);
					}
				}
			}
		}
	}

	isFullyPossible(costIndex) {
		for (let action of this.actions) {
			if (action.costIndex == costIndex && !action.isFullyPossible()) {
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

		// cancel impossible actions
		const cancelEvents = this._cancelImpossibleActions();
		if (cancelEvents.length > 0) {
			yield cancelEvents;
		}

		// apply static substitution abilities to the rest
		yield* this._handleSubstitutionAbilities();

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
		// TODO: These need to be checked for legality and substitution just like the original actions
		let followupActions = this.actions;
		do {
			followupActions = this.getFollowupActions(game, followupActions);
			for (const action of followupActions) {
				this.actions.push(action);
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

		this.followupTiming = await (yield* runInterjectedTimings(this.game, isPrediction, this.actions));
	}

	* undo() {
		// check if this timing actually ran
		if (!this.successful) {
			return;
		}
		let events = [];
		for (let i = this.actions.length - 1; i >= 0; i--) {
			const event = this.actions[i].undo();
			if (event) {
				events.push(event);
			}
		}
		const valueChangeEvents = recalculateObjectValues(this.game);
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
			if ((action instanceof actions.Move || action instanceof actions.Return) && action.zone instanceof zones.DeckZone && action.targetIndex === null) {
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
			let discards = invalidEquipments.map(equipment => new actions.Discard(
				equipment.owner,
				equipment,
				new ScriptValue("dueToReason", ["invalidEquipment"]),
				new ScriptValue("card", [])
			));
			return discards.concat(discards.map(discard => new actions.Destroy(discard)));
		}
		return [];
	}

	valueOf() {
		return this.index;
	}
}

// used in ordering static abilities when applying them
class StaticAbilityApplication {
	constructor(ability, source) {
		this.ability = ability;
		this.source = source;
	}

	getModifier() {
		const player = this.source.currentOwner();
		return this.ability.modifier.evalFull(new ScriptContext(this.source, player, this.ability))[0].get(player);
	}
}

// This is run after every regular timing and right after blocks start and end.
// It takes care of updating static abilities.
export async function* runInterjectedTimings(game, isPrediction) {
	const timing = yield* getStaticAbilityPhasingTiming(game);
	if (timing) {
		await (yield* timing.run(isPrediction));
	}
	return timing;
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
	const modificationActions = []; // the list of Apply/UnapplyStaticAbility actions that this will return as a timing.
	const activeCards = game.players.map(player => player.getActiveCards()).flat();
	const possibleTargets = activeCards.concat(game.players);
	const newApplications = new Map();
	const abilityTargets = new Map(); // caches an abilities targets so they do not get recomputed

	// unapplying old modifiers
	for (const target of possibleTargets) {
		// unapplying old static abilities from this object
		for (const modifier of target.values.modifierStack) {
			// is this a regular static ability?
			if (!(modifier.ctx.ability instanceof abilities.StaticAbility) || (modifier.modifications[0] instanceof ActionReplaceModification)) continue;

			// has this ability been removed from its card?
			if (!modifier.ctx.card.values.current.abilities.includes(modifier.ctx.ability)) {
				modificationActions.push(new actions.UnapplyStaticAbility(
					modifier.ctx.card.currentOwner(), // have these be owned by the player that owns the card with the ability.
					target,
					modifier.ctx.ability
				));
				continue;
			}
			// else check if the object is still a valid target for the ability
			if (!abilityTargets.has(modifier.ctx.ability)) {
				abilityTargets.set(modifier.ctx.ability, modifier.ctx.ability.getTargets(modifier.ctx.card, modifier.ctx.card.currentOwner()));
			}
			if (!abilityTargets.get(modifier.ctx.ability).includes(target)) {
				modificationActions.push(new actions.UnapplyStaticAbility(
					modifier.ctx.card.currentOwner(), // have these be owned by the player that owns the card with the ability.
					target,
					modifier.ctx.ability
				));
			}
		}
	}

	// applying new modifiers
	for (const currentCard of activeCards) {
		for (const ability of currentCard.values.current.abilities) {
			// is this a regular static ability?
			if (!(ability instanceof abilities.StaticAbility) || (ability.modifier.modifications[0] instanceof ActionReplaceModification)) continue;

			if (!abilityTargets.has(ability)) {
				abilityTargets.set(ability, ability.getTargets(currentCard, currentCard.currentOwner()));
			}
			for (const target of possibleTargets) {
				if (abilityTargets.get(ability).includes(target)) {
					if (!target.values.modifierStack.find(modifier => modifier.ctx.ability === ability)) {
						// abilities are just dumped in a list here to be sorted later.
						let applications = newApplications.get(target) ?? [];
						applications.push(new StaticAbilityApplication(ability, currentCard));
						newApplications.set(target, applications);
					}
				}
			}
		}
	}

	for (const [target, applications] of newApplications) {
		for (const application of yield* orderStaticAbilityApplications(target, applications)) {
			modificationActions.push(new actions.ApplyStaticAbility(
				application.source.currentOwner(), // have these be owned by the player that owns the card with the ability.
				target,
				application.getModifier().bakeStatic(target)
			));
		}
	}

	if (modificationActions.length === 0) {
		return null;
	}
	return new Timing(game, modificationActions);
}

function* orderStaticAbilityApplications(target, applications) {
	const orderedApplications = [];

	const fieldEnterBuckets = {};
	for (let i = applications.length - 1; i >= 0; i--) {
		// a card's own abilities go first.
		if (target instanceof BaseCard && applications[i].source === target) {
			orderedApplications.push(applications[i]);
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
	for (const timing of Object.keys(fieldEnterBuckets)) {
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
				const request = chooseAbilityOrder.create(bucket.player, target, bucket.applications.map(elem => elem.ability), bucket.applications.map(elem => elem.source));
				const response = yield [request];
				if (response.type != "chooseAbilityOrder") {
					throw new Error("Wrong response type supplied during ability ordering (expected 'chooseAbilityOrder', got '" + response.type + "')");
				}
				orderedAbilities = chooseAbilityOrder.validate(response.value, request);
			}
			// actually apply the abilities
			for (const index of orderedAbilities) {
				orderedApplications.push(bucket.applications[index]);
			}
		}
	}

	return orderedApplications;
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