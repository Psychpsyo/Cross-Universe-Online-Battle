// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as blocks from "../blocks.js";
import * as events from "../events.js";
import * as requests from "../inputRequests.js";
import * as zones from "../zones.js";
import {Card, BaseCard, SnapshotCard} from "../card.js";
import {CardModifier} from "../cardValues.js";
import {ScriptValue, ScriptContext} from "./structs.js";

let implicitCard = [null];
let implicitActions = [null];

// helper functions
function equalityCompare(a, b) {
	if (a instanceof BaseCard && b instanceof BaseCard) {
		return a.globalId === b.globalId;
	}
	return a === b;
}
export function setImplicitCard(card) {
	implicitCard.push(card);
}
export function clearImplicitCard() {
	implicitCard.pop();
}
export function setImplicitActions(actions) {
	implicitActions.push(actions);
}
export function clearImplicitActions() {
	implicitActions.pop();
}
// generates every possible combination [A1, A2, A3 ... Ax] so that An is from
// the n-th array that was passed in and x is the amount of input arrays.
function cartesianProduct(arrays) {
	if (arrays.length == 0) {
		return [];
	}
	let products = arrays[0].map(elem => [elem]);
	for (let i = 1; i < arrays.length; i++) {
		let newProducts = [];
		for (const elemA of products) {
			for (const elemB of arrays[i]) {
				newProducts.push([...elemA, elemB]);
			}
		}
		products = newProducts;
	}
	return products;
}
// returns all possible ways to choose k elements from a list of n elements.
function nChooseK(n, k) {
	let choices = [];
	for (let i = k - 1; i >= 0; i--) {
		choices.push(i);
	}
	let combinations = [];

	combinations.push([...choices]);
	while (choices[choices.length - 1] < n - k) {
		for (let i = 0; i < k; i++) {
			if (choices[i] < n - 1 - i) {
				choices[i]++;
				for (let j = 1; j <= i; j++) {
					choices[i - j] = choices[i] + j;
				}
				combinations.push([...choices]);
				break;
			}
		}
	}
	return combinations;
}

class AstNode {
	* eval(ctx) {}
	// evalFull() does the same as eval without being a generator function itself.
	// This means that it will return an array of all possible return values for every combination of choices
	// that the player could make.
	// If run with an evaluatingPlayer, information that is hidden from that player is ignored.
	// This means that card matchers, for example, will always return hidden cards, no matter if they actually match.
	evalFull(ctx) {
		let generator = this.eval(ctx);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [next.value];
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(ctx) {
		for (let childNode of this.getChildNodes()) {
			if (childNode && !childNode.hasAllTargets(ctx)) {
				return false;
			}
		}
		return true;
	}
	getChildNodes() {
		return [];
	}
}

// This serves as the root node of a card's script body
export class ScriptRootNode extends AstNode {
	constructor(steps) {
		super();
		this.steps = steps;
	}
	* eval(ctx) {
		for (let step of this.steps) {
			yield* step.eval(ctx);
		}
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(ctx) {
		return this.hasAllTargetsFromStep(0, ctx);
	}
	getChildNodes() {
		return this.steps;
	}

	hasAllTargetsFromStep(i, ctx) {
		for (; i < this.steps.length; i++) {
			if (!this.steps[i].hasAllTargets(ctx)) {
				return false;
			}
			// If this step is a variable assignment, we need to enumerate all possible values
			// of the right-hand expression (as it may depend on player choice) and then
			// check target availability for the rest of the script with those choices made.
			// If just one of those branches has all targets, the ability is said to have all targets.
			if (this.steps[i].assignTo) {
				let oldVarValue = ctx.ability.scriptVariables[this.steps[i].assignTo];
				let foundValidBranch = false;
				for (const possibility of this.steps[i].evalFull(ctx)) {
					ctx.ability.scriptVariables[this.steps[i].assignTo] = possibility;
					if (this.hasAllTargetsFromStep(i + 1, ctx)) {
						foundValidBranch = true;
						break;
					}
				}
				ctx.ability.scriptVariables[this.steps[i].assignTo] = oldVarValue;
				return foundValidBranch;
			}
		}
		return true;
	}
}

export class LineNode extends AstNode {
	constructor(expression, variable) {
		super();
		this.expression = expression;
		this.assignTo = variable;
	}
	* eval(ctx) {
		let returnValue = yield* this.expression.eval(ctx);
		if (this.assignTo) {
			ctx.ability.scriptVariables[this.assignTo] = returnValue;
		}
		return returnValue;
	}
	evalFull(ctx) {
		return this.expression.evalFull(ctx);
	}
	getChildNodes() {
		return [this.expression];
	}
}

export class TriggerRootNode extends AstNode {
	constructor(expression) {
		super();
		this.expression = expression;
	}
	* eval(ctx) {
		setImplicitActions(ctx.game.currentPhase().lastActionList);
		let returnValue = yield* this.expression.eval(ctx);
		clearImplicitActions();
		return returnValue;
	}
	getChildNodes() {
		return this.expression;
	}
}

// Used by the MOVE() function, primarily to figure out which field zone a given card needs to move to.
function getZoneForCard(zoneList, card) {
	for (let zone of zoneList) {
		if (zone instanceof zones.FieldZone) {
			switch (zone.type) {
				case "unit":
				case "partner": {
					if (card.values.cardTypes.includes("unit")) {
						return zone;
					}
					break;
				}
				case "spellItem": {
					if (card.values.cardTypes.includes("spell") || card.values.cardTypes.includes("item")) {
						return zone;
					}
					break;
				}
			}
		} else {
			return zone;
		}
	}
}

// Represents the language's built-in functions
export class FunctionNode extends AstNode {
	constructor(functionName, parameters, player, asManyAsPossible) {
		super();
		this.functionName = functionName;
		this.parameters = parameters;
		this.player = player;
		this.asManyAsPossible = asManyAsPossible;
	}
	* eval(ctx) {
		let players = (yield* this.player.eval(ctx)).get(ctx.player);
		if (players.length == 1) {
			let value = yield* this.runFunction(new ScriptContext(ctx.card, players[0], ctx.ability));
			if (value.type === "tempActions") { // actions need to be executed
				let timing = yield value.get(ctx.player);
				return new ScriptValue("action", timing.actions);
			} else {
				return value;
			}
		}
		// otherwise this is a both.FUNCTION() and must create a split value, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);
		let valueMap = new Map();
		let type;
		for (const player of players) {
			let value = yield* this.runFunction(new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer));
			type = value.type;
			valueMap.set(player, value.get(player));
		}

		if (type === "tempActions") { // actions need to be executed
			let actions = [];
			for (const iterPlayer of players) {
				actions = actions.concat(valueMap.get(iterPlayer));
			}
			let timing = yield actions;
			valueMap = new Map();
			for (const action of timing.actions) {
				valueMap.set(action.player, (valueMap.get(action.player) ?? []).concat(action));
			}
			type = "action"
		}
		return new ScriptValue(type, valueMap);
	}
	* runFunction(ctx) {
		switch (this.functionName) {
			case "APPLY": {
				let until = (yield* this.parameters[2].eval(ctx)).get(ctx.player);
				let applyActions = [];
				for (const target of (yield* this.parameters[0].eval(ctx)).get(ctx.player)) {
					applyActions.push(new actions.ApplyCardStatChange(
						ctx.player,
						target.current(),
						(yield* this.parameters[1].eval(ctx)).get(ctx.player).bake(target.current()),
						until
					));
				}
				return new ScriptValue("tempActions", applyActions);
			}
			case "CANCELATTACK": {
				return new ScriptValue("tempActions", [new actions.CancelAttack(ctx.player)]);
			}
			case "COUNT": {
				let list = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				return new ScriptValue("number", [list.length]);
			}
			case "DAMAGE": {
				return new ScriptValue("tempActions", [new actions.DealDamage(ctx.player, (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0])]);
			}
			case "DECKTOP": {
				return new ScriptValue("card", ctx.player.deckZone.cards.slice(Math.max(0, ctx.player.deckZone.cards.length - (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0]), ctx.player.deckZone.cards.length));
			}
			case "DESTROY": {
				let cards = (yield* this.parameters[0].eval(ctx)).get(ctx.player).filter(card => card.current());
				let discards = cards.map(card => new actions.Discard(ctx.player, card.current()));
				return new ScriptValue("tempActions", discards.concat(discards.map(discard => new actions.Destroy(discard))));
			}
			case "DIFFERENT": {
				let list = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				for (let i = 0; i < list.length; i++) {
					for (let j = 0; j < list.length; j++) {
						if (i == j) {
							continue;
						}
						for (const element of list[j]) {
							if (equalityCompare(list[i], element)) {
								return new ScriptValue("bool", false);
							}
						}
					}
				}
				return new ScriptValue("bool", true);
			}
			case "DISCARD": {
				return new ScriptValue("tempActions", (yield* this.parameters[0].eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.Discard(ctx.player, card.current())));
			}
			case "DRAW": {
				let amount = (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0];
				if (this.asManyAsPossible) {
					amount = Math.min(amount, ctx.player.deckZone.cards.length);
				}
				return new ScriptValue("tempActions", [new actions.Draw(ctx.player, amount)]);
			}
			case "EXILE": {
				return new ScriptValue("tempActions", (yield* this.parameters[0].eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.Exile(ctx.player, card.current())));
			}
			case "GAINLIFE": {
				return new ScriptValue("tempActions", [new actions.ChangeLife(ctx.player, (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0])]);
			}
			case "GAINMANA": {
				return new ScriptValue("tempActions", [new actions.ChangeMana(ctx.player, (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0])]);
			}
			case "GETCOUNTERS": {
				let cards = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let type = (yield* this.parameters[1].eval(ctx)).get(ctx.player)[0];

				let total = 0;
				for (let card of cards) {
					if (card.counters[type]) {
						total += card.counters[type];
					}
				}

				return new ScriptValue("number", [total]);
			}
			case "GIVEATTACK": {
				let target = (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0];
				return new ScriptValue("tempActions", target.current()? [new actions.GiveAttack(ctx.player, target.current())] : []);
			}
			case "LOSELIFE": {
				return new ScriptValue("tempActions", [new actions.ChangeLife(ctx.player, -(yield* this.parameters[0].eval(ctx)).get(ctx.player)[0])]);
			}
			case "LOSEMANA": {
				return new ScriptValue("tempActions", [new actions.ChangeMana(ctx.player, -(yield* this.parameters[0].eval(ctx)).get(ctx.player)[0])]);
			}
			case "MOVE": {
				let cards = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let moveActions = [];
				let zoneMoveCards = new Map();
				for (const card of cards) {
					if (card.current() === null) {
						continue;
					}
					setImplicitCard(card);
					let zoneValue = yield* this.parameters[1].eval(new ScriptContext(card, ctx.player, ctx.ability, ctx.evaluatingPlayer));
					let zone = zoneValue.type === "deckPosition"? zoneValue.get(ctx.player).deck : getZoneForCard(zoneValue.get(ctx.player), card);
					let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
					if (zoneValue.type === "deckPosition") {
						index = zoneValue.get(ctx.player).isTop? -1 : 0;
					}
					moveActions.push(new actions.Move(ctx.player, card.current(), zone, index));
					zoneMoveCards.set(zone, (zoneMoveCards.get(zone) ?? []).concat(card.current()));
					clearImplicitCard();
				}

				for (const [zone, cards] of zoneMoveCards.entries()) {
					let freeSlots = zone.getFreeSpaceCount();
					if (freeSlots < cards.length) {
						let selectionRequest = new requests.chooseCards.create(ctx.player, cards, [freeSlots], "cardEffectMove:" + ctx.ability.id);
						let response = yield [selectionRequest];
						if (response.type != "chooseCards") {
							throw new Error("Incorrect response type supplied during card move selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
						}
						let movedCards = requests.chooseCards.validate(response.value, selectionRequest);
						for (let i = moveActions.length - 1; i >= 0; i--) {
							if (moveActions[i].zone === zone && !movedCards.includes(moveActions[i].card)) {
								moveActions.splice(i, 1);
							}
						}
					}
				}

				return new ScriptValue("tempActions", moveActions);
			}
			case "ORDER": {
				let toOrder = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let orderRequest = new requests.orderCards.create(ctx.player, toOrder, "cardEffect:" + ctx.ability.id);
				let response = yield [orderRequest];
				if (response.type != "orderCards") {
					throw new Error("Incorrect response type supplied during card ordering. (expected \"orderCards\", got \"" + response.type + "\" instead)");
				}
				return new ScriptValue("card", requests.orderCards.validate(response.value, orderRequest).map(card => new SnapshotCard(card.current())));
			}
			case "PUTCOUNTERS": {
				let cards = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let type = (yield* this.parameters[1].eval(ctx)).get(ctx.player)[0];
				let amount = (yield* this.parameters[2].eval(ctx)).get(ctx.player)[0];

				return new ScriptValue("tempActions", cards.map(card => new actions.ChangeCounters(ctx.player, ctx.card, type, amount)));
			}
			case "REMOVECOUNTERS": {
				let cards = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let type = (yield* this.parameters[1].eval(ctx)).get(ctx.player)[0];
				let amount = (yield* this.parameters[2].eval(ctx)).get(ctx.player)[0];

				return new ScriptValue("tempActions", cards.map(card => new actions.ChangeCounters(ctx.player, card, type, -amount)));
			}
			case "REVEAL": {
				return new ScriptValue("tempActions", (yield* this.parameters[0].eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.Reveal(ctx.player, card.current())));
			}
			case "SELECT": {
				let choiceAmount = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let eligibleCards = (yield* this.parameters[1].eval(ctx)).get(ctx.player);
				if (eligibleCards.length === 0) {
					return new ScriptValue("card", []);
				}
				for (let card of eligibleCards) {
					if (card.currentOwner() === ctx.player || !(["deck", "hand"].includes(card.zone.type))) {
						card.showTo(ctx.player);
					} else {
						// selecting from revealed hands is still random.
						card.hideFrom(ctx.player);
					}
				}
				let selectionRequest = new requests.chooseCards.create(ctx.player, eligibleCards, choiceAmount == "any"? [] : choiceAmount, "cardEffect:" + ctx.ability.id);
				let response = yield [selectionRequest];
				if (response.type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
				}
				for (let card of eligibleCards) {
					if (card.zone.type === "deck" || (card.zone.type === "hand" && card.currentOwner() !== ctx.player)) {
						card.hideFrom(ctx.player);
					}
				}
				let cards = requests.chooseCards.validate(response.value, selectionRequest);
				yield [events.createCardsSelectedEvent(ctx.player, cards.map(card => new SnapshotCard(card.current())))];
				return new ScriptValue("card", cards);
			}
			case "SELECTPLAYER": {
				let selectionRequest = new requests.choosePlayer.create(ctx.player, "cardEffect:" + ctx.ability.id);
				let response = yield [selectionRequest];
				if (response.type != "choosePlayer") {
					throw new Error("Incorrect response type supplied during player selection. (expected \"choosePlayer\", got \"" + response.type + "\" instead)");
				}
				let chosenPlayer = requests.choosePlayer.validate(response.value, selectionRequest);
				yield [events.createPlayerSelectedEvent(ctx.player, chosenPlayer)];
				return new ScriptValue("player", [chosenPlayer]);
			}
			case "SELECTTYPE": {
				let selectionRequest = new requests.chooseType.create(ctx.player, ctx.ability.id, (yield* this.parameters[0].eval(ctx)).get(ctx.player));
				let response = yield [selectionRequest];
				if (response.type != "chooseType") {
					throw new Error("Incorrect response type supplied during type selection. (expected \"chooseType\", got \"" + response.type + "\" instead)");
				}
				let type = requests.chooseType.validate(response.value, selectionRequest);
				yield [events.createTypeSelectedEvent(ctx.player, type)];
				return new ScriptValue("type", [type]);
			}
			case "SETATTACKTARGET": {
				let newTarget = (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0];
				return new ScriptValue("tempActions", newTarget.current()? [new actions.SetAttackTarget(ctx.player, newTarget.current())] : []);
			}
			case "SHUFFLE": {
				return new ScriptValue("tempActions", [new actions.Shuffle(ctx.player)]);
			}
			case "SUM": {
				let list = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let sum = 0;
				for (let num of list) {
					sum += num;
				}
				return new ScriptValue("number", [sum]);
			}
			case "SUMMON": {
				// TODO: Make player choose which cards to summon if only a limited amount can be summoned
				let cards = (yield* this.parameters[0].eval(ctx)).get(ctx.player);
				let zone = (yield* this.parameters[1].eval(ctx)).get(ctx.player)[0];
				let payCost = (yield* this.parameters[2].eval(ctx)).get(ctx.player);

				let costs = [];
				let placeActions = [];
				for (let i = 0; i < cards.length; i++) {
					if (cards[i].current() === null) {
						continue;
					}
					let availableZoneSlots = [];
					for (let i = 0; i < zone.cards.length; i++) {
						if (zone.get(i) === null) {
							availableZoneSlots.push(i);
						}
					}
					if (availableZoneSlots.length == 0) {
						break;
					}
					let placeCost = new actions.Place(ctx.player, cards[i].current(), zone);
					placeCost.costIndex = i;
					costs.push(placeCost);
					placeActions.push(placeCost);

					if (payCost) {
						let costActions = cards[i].getSummoningCost(ctx.player);
						// TODO: Figure out if this needs to account for multi-action costs and how to handle those.
						for (const actionList of costActions) {
							for (const action of actionList) {
								action.costIndex = i;
								costs.push(action);
							}
						}
					}
				}
				let timing = yield costs;
				let summons = [];
				for (let i = 0; i < timing.costCompletions.length; i++) {
					if (timing.costCompletions[i]) {
						summons.push(new actions.Summon(ctx.player, placeActions[i]));
					}
				}
				return new ScriptValue("tempActions", summons);
			}
			case "SWAP": {
				let cardA = (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0];
				let cardB = (yield* this.parameters[1].eval(ctx)).get(ctx.player)[0];
				let transferEquipments = false;
				if (this.parameters.length > 2) {
					transferEquipments = (yield* this.parameters[2].eval(ctx)).get(ctx.player);
				}
				return new ScriptValue("tempActions", [new actions.Swap(ctx.player, cardA, cardB, transferEquipments)]);
			}
			case "TOKENS": {
				let amount = (yield* this.parameters[0].eval(ctx)).get(ctx.player)[0];
				let name = (yield* this.parameters[2].eval(ctx)).get(ctx.player)[0];
				let level = (yield* this.parameters[3].eval(ctx)).get(ctx.player)[0];
				let types = (yield* this.parameters[4].eval(ctx)).get(ctx.player);
				let attack = (yield* this.parameters[5].eval(ctx)).get(ctx.player)[0];
				let defense = (yield* this.parameters[6].eval(ctx)).get(ctx.player)[0];
				let cards = [];
				for (let i = 0; i < amount; i++) {
					// TODO: Give player control over the specific token variant that gets selected
					let cardIds = (yield* this.parameters[1].eval(ctx)).get(ctx.player);
					cards.push(new Card(ctx.player, `id: CU${cardIds[i % cardIds.length]}
cardType: token
name: CU${name}
level: ${level}
types: ${types.join(",")}
attack: ${attack}
defense: ${defense}`));
				}
				return new ScriptValue("card", cards);
			}
			case "VIEW": {
				return new ScriptValue("tempActions", (yield* this.parameters[0].eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.View(ctx.player, card.current())));
			}
		}
	}
	evalFull(ctx) {
		let players = this.player.evalFull(ctx)[0].get(ctx.player);
		if (players.length == 1) {
			let result = this.runFunctionFull(new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer));
			return result ?? super.evalFull(new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer));
		}
		// otherwise this is a both.FUNCTION() and must create split values, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);
		let values = [];
		for (const player of players) {
			values.push(this.runFunctionFull(new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer)));
		}
		return cartesianProduct(values).map(list => {
			let valueMap = new Map();
			for (let i = 0; i < list.length; i++) {
				valueMap.set(players[i], list[i].get(players[i]));
			}
			return new ScriptValue(list[0].type, valueMap);
		});
	}
	runFunctionFull(ctx) {
		// TODO: Probably best to implement these on a case-by-case basis when cards actually need them
		switch (this.functionName) {
			case "DESTROY": {
				let cardLists = this.parameters[0].evalFull(ctx).map(option => option.get(ctx.player).filter(card => card.current()));
				let discardLists = cardLists.map(cards => cards.map(card => new actions.Discard(ctx.player, card.current())));
				return discardLists.map(discards => new ScriptValue("action", discards.concat(discards.map(discard => new actions.Destroy(discard)))));
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(ctx).map(option => new ScriptValue("action", option.get(ctx.player).filter(card => card.current()).map(card => new actions.Discard(ctx.player, card.current()))));
			}
			case "EXILE": {
				return this.parameters[0].evalFull(ctx).map(option => new ScriptValue("action", option.get(ctx.player).filter(card => card.current()).map(card => new actions.Exile(ctx.player, card.current()))));
			}
			case "MOVE": {
				let cardPossibilities = this.parameters[0].evalFull(ctx).map(possibilities => possibilities.get(ctx.player));
				let moveActions = [];
				for (let cards of cardPossibilities) {
					moveActions.push([]);
					for (const card of cards) {
						if (card.current() === null) {
							continue;
						}
						setImplicitCard(card);
						// TODO: this might need to handle multiple zone possibilities
						let zoneValue = this.parameters[1].evalFull(ctx)[0];
						let zone = zoneValue.type === "deckPosition"? zoneValue.get(ctx.player).deck : getZoneForCard(zoneValue.get(ctx.player), card);
						let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
						if (zoneValue.type === "deckPosition") {
							index = zoneValue.get(ctx.player).isTop? -1 : 0;
						}
						moveActions[moveActions.length - 1].push(new actions.Move(ctx.player, card.current(), zone, index));
						clearImplicitCard();
					}
				}
				return moveActions.map(actions => new ScriptValue("action", actions));
			}
			case "ORDER": {
				let toOrder = this.parameters[0].evalFull(ctx).map(toOrder => toOrder.get(ctx.player));
				let options = [];
				for (const cards of toOrder) {
					options = options.concat(new ScriptValue("number", nChooseK(cards.length, cards.length).map(i => toOrder[i])));
				}
				return options;
			}
			case "REVEAL": {
				return this.parameters[0].evalFull(ctx).map(option => new ScriptValue("action", option.get(ctx.player).filter(card => card.current()).map(card => new actions.Reveal(ctx.player, card.current()))));
			}
			case "SELECT": {
				let choiceAmounts = this.parameters[0].evalFull(ctx)[0].get(ctx.player);
				let eligibleCards = this.parameters[1].evalFull(ctx)[0].get(ctx.player);
				if (eligibleCards.length == 0) {
					return [new ScriptValue("card", [])];
				}
				if (choiceAmounts === "any") {
					choiceAmounts = [];
					for (let i = 1; i <= eligibleCards.length; i++) {
						choiceAmounts.push(i);
					}
				}

				let combinations = [];
				for (const amount of choiceAmounts) {
					combinations = combinations.concat(nChooseK(eligibleCards.length, amount).map(list => new ScriptValue("card", list.map(i => eligibleCards[i]))));
				}
				return combinations;
			}
			case "SELECTTYPE": {
				let types = this.parameters[0].evalFull(ctx).map(value => value.get(ctx.player)).flat();
				types = [...new Set(types)];
				return types.map(type => new ScriptValue("type", [type]));
			}
			case "VIEW": {
				return this.parameters[0].evalFull(ctx).map(option => new ScriptValue("action", option.get(ctx.player).filter(card => card.current()).map(card => new actions.View(ctx.player, card.current()))));
			}
		}
	}
	hasAllTargets(ctx) {
		let players = this.player.evalFull(ctx)[0].get(ctx.player);
		for (const player of players) {
			if (!this.runHasAllTargets(new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer))) {
				return false;
			}
		}
		return true;
	}
	runHasAllTargets(ctx) {
		// check if all child nodes have their targets
		if (!super.hasAllTargets(ctx)) {
			return false;
		}
		switch (this.functionName) {
			case "CANCELATTACK":
			case "COUNT":
			case "DAMAGE":
			case "DIFFERENT":
			case "DRAW":
			case "GAINLIFE":
			case "GAINMANA":
			case "GETCOUNTERS":
			case "LOSELIFE":
			case "LOSEMANA":
			case "ORDER": // technically can't order nothing but that should never matter in practice
			case "SELECTPLAYER":
			case "SELECTTYPE":
			case "SUM":
			case "TOKENS": {
				return true;
			}
			case "APPLY": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return ctx.player.deckZone.cards.length > 0;
				}
				for (let amount of this.parameters[0].evalFull(ctx)) {
					if (ctx.player.deckZone.cards.length >= amount.get(ctx.player)[0]) {
						return true;
					}
				}
				return false;
			}
			case "DESTROY": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "EXILE": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "GIVEATTACK": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "MOVE": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "PUTCOUNTERS": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "REMOVECOUNTERS": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "REVEAL": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "SELECT": {
				let availableOptions = this.parameters[1].evalFull(ctx).map(option => option.get(ctx.player));
				if (this.parameters[0] instanceof AnyAmountNode && availableOptions.find(list => list.length > 0) !== undefined) {
					return true;
				}
				let amountsRequired = this.parameters[0].evalFull(ctx);
				for (let i = 0; i < availableOptions.length; i++) {
					if (Math.min(...amountsRequired[i].get(ctx.player)) <= availableOptions[i].length) {
						return true;
					}
				}
				return false;
			}
			case "SETATTACKTARGET": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "SHUFFLE": {
				let excludableCardAmounts = this.parameters[0]?.evalFull(ctx)?.map(cardList => cardList.get(ctx.player).length) ?? [0];
				return ctx.player.deckZone.cards.length > Math.min(...excludableCardAmounts);
			}
			case "SUMMON": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "SWAP": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined &&
					   this.parameters[1].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
			case "VIEW": {
				return this.parameters[0].evalFull(ctx).find(list => list.get(ctx.player).length > 0) !== undefined;
			}
		}
	}
	getChildNodes() {
		return this.parameters.concat([this.player]);
	}
}

export class CardMatchNode extends AstNode {
	constructor(cardListNodes, conditions) {
		super();
		this.cardListNodes = cardListNodes;
		this.conditions = conditions;
	}
	* eval(ctx) {
		return new ScriptValue("card", yield* this.getMatchingCards(ctx));
	}
	evalFull(ctx) {
		let generator = this.getMatchingCards(ctx);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [new ScriptValue("card", next.value)];
	}
	getChildNodes() {
		return this.cardListNodes.concat(this.conditions);
	}

	* getMatchingCards(ctx) {
		let cards = [];
		let matchingCards = [];
		for (let cardList of this.cardListNodes) {
			cardList = (yield* cardList.eval(ctx)).get(ctx.player);
			if (cardList.length > 0 && (cardList[0] instanceof zones.Zone)) {
				cards.push(...(cardList.map(zone => zone.cards).flat()));
			} else {
				cards.push(...cardList);
			}
		}
		for (let checkCard of cards) {
			if (checkCard == null) {
				continue;
			}
			// If the evaluating player can't see the cards, they should all be treated as valid / matching.
			if (checkCard.hiddenFor.includes(ctx.evaluatingPlayer) && checkCard.zone !== ctx.evaluatingPlayer.deckZone) {
				matchingCards.push(checkCard);
				continue;
			}
			setImplicitCard(checkCard);
			if ((!this.conditions || (yield* this.conditions.eval(ctx)).get(ctx.player))) {
				matchingCards.push(checkCard);
				clearImplicitCard();
				continue;
			}
			clearImplicitCard();
		}
		return matchingCards;
	}
}
export class ThisCardNode extends AstNode {
	* eval(ctx) {
		return new ScriptValue("card", [ctx.card]);
	}
}
export class AttackTargetNode extends AstNode {
	* eval(ctx) {
		if (ctx.game.currentAttackDeclaration?.target) {
			return new ScriptValue("card", [ctx.game.currentAttackDeclaration.target]);
		}
		return new ScriptValue("card", []);
	}
}
export class AttackersNode extends AstNode {
	* eval(ctx) {
		if (ctx.game.currentAttackDeclaration) {
			return new ScriptValue("card", ctx.game.currentAttackDeclaration.attackers);
		}
		return new ScriptValue("card", []);
	}
}
export class ImplicitCardNode extends AstNode {
	* eval(ctx) {
		return new ScriptValue("card", [implicitCard[implicitCard.length - 1]]);
	}
}
export class ImplicitActionsNode extends AstNode {
	* eval(ctx) {
		return new ScriptValue("action", implicitActions[implicitActions.length - 1]);
	}
}

export class CardPropertyNode extends AstNode {
	constructor(cards, property) {
		super();
		this.cards = cards;
		this.property = property;
		this.returnType = {
			"name": "cardName",
			"baseName": "cardName",
			"level": "number",
			"baseLevel": "number",
			"types": "type",
			"baseTypes": "type",
			"abilities": "ability",
			"baseAbilities": "ability",
			"attack": "number",
			"baseAttack": "number",
			"defense": "number",
			"baseDefense": "number",
			"cardType": "cardType",
			"baseCardType": "cardType",
			"owner": "player",
			"baseOwner": "player",
			"equippedUnit": "card",
			"equipments": "card",
			"attackRights": "number",
			"attacksMade": "number",
			"doLifeDamage": "bool",
			"fightingAgainst": "card",
			"self": "card",
			"zone": "zone",
			"isToken": "bool"
		}[this.property];
	}

	* eval(ctx) {
		let cards = (yield* this.cards.eval(ctx)).get(ctx.player);
		if (this.property === "isToken") {
			let isToken = false;
			for (const c of cards) {
				if (c.isToken) {
					isToken = true;
					break;
				}
			}
			return new ScriptValue("bool", isToken);
		}
		return new ScriptValue(this.returnType, cards.map(card => this.accessProperty(card)).flat());
	}

	evalFull(ctx) {
		return this.cards.evalFull(ctx).map(possibility => new ScriptValue(this.returnType, possibility.get(ctx.player).map(card => this.accessProperty(card)).flat()));
	}

	getChildNodes() {
		return [this.cards];
	}

	accessProperty(card) {
		switch(this.property) {
			case "name": {
				return card.values.names;
			}
			case "baseName": {
				return card.baseValues.names;
			}
			case "level": {
				return card.values.level;
			}
			case "baseLevel": {
				return card.baseValues.level;
			}
			case "types": {
				return card.values.types;
			}
			case "baseTypes": {
				return card.baseValues.types;
			}
			case "abilities": {
				return card.values.abilities;
			}
			case "baseAbilities": {
				return card.values.abilities;
			}
			case "attack": {
				return card.values.attack;
			}
			case "baseAttack": {
				return card.baseValues.attack;
			}
			case "defense": {
				return card.values.defense;
			}
			case "baseDefense": {
				return card.baseValues.defense;
			}
			case "cardType": {
				return card.values.cardTypes;
			}
			case "baseCardType": {
				return card.baseValues.cardTypes;
			}
			case "owner": {
				return card.currentOwner();
			}
			case "baseOwner": {
				return card.owner;
			}
			case "equippedUnit": {
				return card.equippedTo? card.equippedTo : [];
			}
			case "equipments": {
				return card.equipments;
			}
			case "attackRights": {
				return card.values.attackRights;
			}
			case "attacksMade": {
				return card.attackCount;
			}
			case "doLifeDamage": {
				return card.values.doLifeDamage;
			}
			case "fightingAgainst": {
				let currentBlock = card.owner.game.currentBlock();
				if (currentBlock instanceof blocks.Fight) {
					if (card.isAttackTarget) {
						return currentBlock.attackDeclaration.attackers;
					}
					if (card.isAttacking) {
						return currentBlock.attackDeclaration.target? currentBlock.attackDeclaration.target : [];
					}
				}
				return [];
			}
			case "self": {
				return card;
			}
			case "zone": {
				return card.zone;
			}
		}
	}
}

export class VariableNode extends AstNode {
	constructor(name) {
		super();
		this.name = name;
	}
	* eval(ctx) {
		let variable = ctx.ability.scriptVariables[this.name];
		if (variable === undefined) {
			throw new Error("Tried to access unitialized variable '" + this.name + "'.");
		}
		return new ScriptValue(variable.type, variable.get(ctx.player));
	}
}

export class ValueArrayNode extends AstNode {
	constructor(values, type) {
		super();
		this.values = values;
		this.type = type;
	}
	* eval(ctx) {
		return new ScriptValue(this.type, this.values);
	}
}

export class AnyAmountNode extends AstNode {
	* eval(ctx) {
		return new ScriptValue("number", "any");
	}
}

export class AllTypesNode extends AstNode {
	* eval(ctx) {
		return new ScriptValue("type", ctx.game.config.allTypes);
	}
}

// Math and comparison operators with left and right operands
export class MathNode extends AstNode {
	constructor(leftSide, rightSide, resultType) {
		super();
		this.leftSide = leftSide;
		this.rightSide = rightSide;
		this.resultType = resultType;
	}
	* eval(ctx) {
		let left = (yield* this.leftSide.eval(ctx)).get(ctx.player);
		let right = (yield* this.rightSide.eval(ctx)).get(ctx.player);
		return new ScriptValue(this.resultType, this.doOperation(left, right));
	}
	evalFull(ctx) {
		let left = this.leftSide.evalFull(ctx).map(value => value.get(ctx.player));
		let right = this.rightSide.evalFull(ctx).map(value => value.get(ctx.player));
		let results = [];
		for (const leftValue of left) {
			for (const rightValue of right) {
				results.push(new ScriptValue(this.resultType, this.doOperation(leftValue, rightValue)));
			}
		}
		return results;
	}
	getChildNodes() {
		return [this.leftSide, this.rightSide];
	}

	doOperation(left, right) {}
}
export class DashMathNode extends MathNode {
	constructor(leftSide, rightSide) {
		// TODO: These don't always return number.
		super(leftSide, rightSide, "number");
	}
}
export class PlusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] == "number" && typeof right[0] == "number") {
			return [left[0] + right[0]];
		}
		// for non-number types this concatenates the two lists.
		return left.concat(right);
	}
}
export class MinusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] == "number" && typeof right[0] == "number") {
			return [left[0] - right[0]];
		}
		// for non-number types this subtracts the right list from the left one.
		let outputList = [];
		for (let element of left) {
			if (!right.some(elem => equalityCompare(elem, element))) {
				outputList.push(element);
			}
		}
		return outputList;
	}
}
export class DotMathNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide, "number");
	}
}
export class MultiplyNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] != "number" || typeof right[0] != "number") {
			return [NaN];
		}
		return [left[0] * right[0]];
	}
}
export class DivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] != "number" || typeof right[0] != "number") {
			return [NaN];
		}
		return [left[0] / right[0]];
	}
}
export class FloorDivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] != "number" || typeof right[0] != "number") {
			return [NaN];
		}
		return [Math.floor(left[0] / right[0])];
	}
}
export class ComparisonNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide, "bool");
	}
}
export class EqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let element of left) {
			if (right.some(elem => equalityCompare(elem, element))) {
				return true;
			}
		}
		return false;
	}
}
export class NotEqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let element of left) {
			if (right.some(elem => equalityCompare(elem, element))) {
				return false;
			}
		}
		return true;
	}
}
export class GreaterThanNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let rightSide of right) {
			for (let leftSide of left) {
				if (leftSide > rightSide) {
					return true;
				}
			}
		}
		return false;
	}
}
export class LessThanNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let rightSide of right) {
			for (let leftSide of left) {
				if (leftSide < rightSide) {
					return true;
				}
			}
		}
		return false;
	}
}
export class LogicNode extends MathNode {
	constructor(leftSide, rightSide) {
		// TODO: AndNode doesn't return bools when concatenating lists
		super(leftSide, rightSide, "bool");
	}
}
export class AndNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		return left && right;
	}
}
export class OrNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		return left || right;
	}
}

// Unary operators
export class UnaryMinusNode extends AstNode {
	constructor(operand) {
		super();
		this.operand = operand;
	}
	* eval(ctx) {
		return (yield* this.operand.eval(ctx)).map(value => -value.get(ctx.player));
	}
	evalFull(ctx) {
		return this.operand.evalFull(ctx).map(values => new ScriptValue("number", values.get(ctx.player).map(value => -value)));
	}
	getChildNodes() {
		return [this.operand];
	}
}
export class UnaryNotNode extends AstNode {
	constructor(operand) {
		super();
		this.operand = operand;
	}
	* eval(ctx) {
		return new ScriptValue("bool", !(yield* this.operand.eval(ctx)).get(ctx.player));
	}
	evalFull(ctx) {
		return this.operand.evalFull(ctx).map(value => new ScriptValue("bool", !value.get(ctx.player)));
	}
	getChildNodes() {
		return [this.operand];
	}
}

export class BoolNode extends AstNode {
	constructor(value) {
		super();
		this.value = value == "yes";
	}
	* eval(ctx) {
		return new ScriptValue("bool", this.value);
	}
}

export class PlayerNode extends AstNode {
	constructor(playerKeyword) {
		super();
		this.playerKeyword = playerKeyword;
	}
	* eval(ctx) {
		// a card that is not in a zone belongs to its owner as it is in the process of being summoned/cast/deployed
		let you = ctx.card.currentOwner();
		switch(this.playerKeyword) {
			case "you":
				return new ScriptValue("player", [you]);
			case "opponent":
				return new ScriptValue("player", [you.next()]);
			case "both":
				return new ScriptValue("player", [...you.game.players]);
			case "own":
				return new ScriptValue("player", [ctx.player]);
		}
	}
}
export class LifeNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		return new ScriptValue("number", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.life));
	}
}
export class ManaNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		return new ScriptValue("number", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.mana));
	}
}
export class PartnerNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		return new ScriptValue("card", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.partnerZone.cards[0]));
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier, playerNode) {
		super();
		this.zoneIdentifier = zoneIdentifier;
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		let player = ctx.player;
		if (this.playerNode) {
			player = (yield* this.playerNode.eval(ctx)).get(ctx.player)[0];
		}
		return new ScriptValue("zone", this.getZone(player));
	}
	evalFull(ctx) {
		let players;
		if (this.playerNode) {
			players = this.playerNode.evalFull(ctx).map(p => p.get(ctx.player));
		} else {
			players = [ctx.player];
		}
		return players.map(player => new ScriptValue("zone", this.getZone(player)));
	}
	getChildNodes() {
		return this.playerNode? [this.playerNode] : [];
	}

	getZone(player) {
		if (this.playerNode) {
			return ({
				field: [player.unitZone, player.spellItemZone, player.partnerZone],
				deck: [player.deckZone],
				discard: [player.discardPile],
				exile: [player.exileZone],
				hand: [player.handZone],
				unitZone: [player.unitZone],
				spellItemZone: [player.spellItemZone],
				partnerZone: [player.partnerZone]
			})[this.zoneIdentifier];
		}
		return ({
			field: [player.unitZone, player.spellItemZone, player.partnerZone, player.next().unitZone, player.next().spellItemZone, player.next().partnerZone],
			deck: [player.deckZone, player.next().deckZone],
			discard: [player.discardPile, player.next().discardPile],
			exile: [player.exileZone, player.next().exileZone],
			hand: [player.handZone, player.next().handZone],
			unitZone: [player.unitZone, player.next().unitZone],
			spellItemZone: [player.spellItemZone, player.next().spellItemZone],
			partnerZone: [player.partnerZone, player.next().partnerZone]
		})[this.zoneIdentifier];
	}
}
export class DeckPositionNode extends AstNode {
	constructor(playerNode, position) {
		super();
		this.playerNode = playerNode;
		this.top = position === "deckTop";
	}
	* eval(ctx) {
		return new ScriptValue("deckPosition", {deck: (yield* this.playerNode.eval(ctx)).get(ctx.player)[0].deckZone, isTop: this.top});
	}
	evalFull(ctx) {
		return this.playerNode.evalFull(ctx).map(p => new ScriptValue("deckPosition", {deck: p.get(ctx.player)[0].deckZone, isTop: this.top}));
	}
	getChildNodes() {
		return [this.playerNode];
	}
}

export class BlockNode extends AstNode {
	constructor(blockType) {
		super();
		this.blockType = blockType;
	}
	* eval(ctx) {
		return new ScriptValue("block", [this.blockType]);
	}
}
export class PhaseNode extends AstNode {
	constructor(playerNode, phaseIndicator) {
		super();
		this.playerNode = playerNode;
		this.phaseIndicator = phaseIndicator;
	}
	* eval(ctx) {
		let phaseAfterPrefix = this.phaseIndicator[0].toUpperCase() + this.phaseIndicator.slice(1);
		if (this.playerNode) {
			let prefix = ctx.player === (yield* this.playerNode.eval(ctx)).get(ctx.player)[0]? "your" : "opponent";
			return new ScriptValue("phase", [prefix + phaseAfterPrefix]);
		}
		return new ScriptValue("phase", ["your" + phaseAfterPrefix, "opponent" + phaseAfterPrefix]);
	}
}
export class TurnNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		if (ctx.player === (yield* this.playerNode.eval(ctx)).get(ctx.player)[0]) {
			return new ScriptValue("turn", ["yourTurn"]);
		}
		return new ScriptValue("turn", ["opponentTurn"]);
	}
}
export class CurrentBlockNode extends AstNode {
	* eval(ctx) {
		let type = ctx.game.currentBlock()?.type;
		return new ScriptValue("block", type? [type] : []);
	}
}
export class CurrentPhaseNode extends AstNode {
	* eval(ctx) {
		let phaseTypes = [...ctx.game.currentPhase().types];
		let prefix = ctx.player === game.currentTurn().player? "your" : "opponent";
		for (let i = phaseTypes.length -1; i >= 0; i--) {
			phaseTypes.push(prefix + phaseTypes[i][0].toUpperCase() + phaseTypes[i].slice(1));
		}
		return new ScriptValue("phase", phaseTypes);
	}
}
export class CurrentTurnNode extends AstNode {
	* eval(ctx) {
		return new ScriptValue("turn", [ctx.player == ctx.game.currentTurn().player? "yourTurn" : "opponentTurn"]);
	}
}

// for the action accessor; pushes card to array if it is not in there yet.
function pushCardUnique(array, card) {
	if (array.findIndex(c => c.globalId === card.globalId) === -1) {
		array.push(card);
	}
}
export class ActionAccessorNode extends AstNode {
	constructor(actionsNode, accessor) {
		super();
		this.actionsNode = actionsNode;
		this.accessor = accessor;
	}
	* eval(ctx) {
		let values = [];
		let actionList = [];
		if (this.actionsNode instanceof CurrentTurnNode) {
			actionList = game.currentTurn().getActions();
		} else {
			actionList = (yield* this.actionsNode.eval(ctx)).get(ctx.player);
		}
		for (let action of actionList) {
			switch (this.accessor) {
				case "cast": {
					if (action instanceof actions.Cast) {
						pushCardUnique(values, action.placeAction.card);
					}
					break;
				}
				case "chosenTarget": {
					if (action instanceof actions.EstablishAttackDeclaration) {
						pushCardUnique(values, action.attackTarget);
					}
					break;
				}
				case "declared": {
					if (action instanceof actions.EstablishAttackDeclaration) {
						for (let attacker of action.attackers) {
							pushCardUnique(values, attacker);
						}
					}
					break;
				}
				case "deployed": {
					if (action instanceof actions.Deploy) {
						pushCardUnique(values, action.placeAction.card);
					}
					break;
				}
				case "destroyed": {
					if (action instanceof actions.Destroy) {
						pushCardUnique(values, action.discard.card);
					}
					break;
				}
				case "discarded": {
					if (action instanceof actions.Discard) {
						pushCardUnique(values, action.card);
					}
					break;
				}
				case "exiled": {
					if (action instanceof actions.Exile) {
						pushCardUnique(values, action.card);
					}
					break;
				}
				// TODO: This might need to be split up into separate selectors for cards getting added / returned to zones.
				//       (once / if there ever is a card that can replace one type of move with another)
				//       Though the exact behavior here would probably need to be clarified by a new ruling.
				case "moved": {
					if (action instanceof actions.Move) {
						pushCardUnique(values, action.card);
					}
					break;
				}
				case "retired": {
					if (action instanceof actions.Discard && action.isRetire) {
						pushCardUnique(values, action.card);
					}
					break;
				}
				case "viewed": {
					if (action instanceof actions.View) {
						pushCardUnique(values, action.card);
					}
					break;
				}
				case "summoned": {
					if (action instanceof actions.Summon) {
						pushCardUnique(values, action.placeAction.card);
					}
					break;
				}
				case "targeted": {
					if (action instanceof actions.EstablishAttackDeclaration) {
						pushCardUnique(values, action.attackTarget);
					} else if (action instanceof actions.SetAttackTarget) {
						pushCardUnique(values, action.newTarget);
					}
					break;
				}
			}
		}
		return new ScriptValue("card", values);
	}
}

export class ModifierNode extends AstNode {
	constructor(modifications) {
		super();
		this.modifications = modifications;
	}
	* eval(ctx) {
		return new ScriptValue("modifier", new CardModifier(this.modifications, ctx));
	}
}

export class UntilIndicatorNode extends AstNode {
	constructor(type) {
		super();
		this.type = type;
	}
	* eval(ctx) {
		return new ScriptValue("untilIndicator", this.type);
	}
}