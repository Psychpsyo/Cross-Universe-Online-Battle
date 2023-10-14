// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import * as zones from "../zones.js";
import * as events from "../events.js";
import {Card, BaseCard, SnapshotCard} from "../card.js";
import {CardModifier} from "../cardValues.js";

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
	* eval(card, player, ability) {}
	// evalFull() does the same as eval without being a generator function itself.
	// This means that it will return an array of all possible return values for every combination of choices
	// that the player could make.
	// If run with an evaluatingPlayer, information that is hidden from that player is ignored.
	// This means that card matchers, for example, will always return hidden cards, no matter if they actually match.
	evalFull(card, player, ability, evaluatingPlayer = null) {
		let generator = this.eval(card, player, ability);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [next.value];
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(card, player, ability, evaluatingPlayer) {
		for (let childNode of this.getChildNodes()) {
			if (childNode && !childNode.hasAllTargets(card, player, ability, evaluatingPlayer)) {
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
	* eval(card, player, ability) {
		for (let step of this.steps) {
			yield* step.eval(card, player, ability);
		}
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(card, player, ability, evaluatingPlayer) {
		return this.hasAllTargetsFromStep(0, card, player, ability, evaluatingPlayer);
	}
	getChildNodes() {
		return this.steps;
	}

	hasAllTargetsFromStep(i, card, player, ability, evaluatingPlayer) {
		for (; i < this.steps.length; i++) {
			if (!this.steps[i].hasAllTargets(card, player, ability, evaluatingPlayer)) {
				return false;
			}
			// If this step is a variable assignment, we need to enumerate all possible values
			// of the right-hand expression (as it may depend on player choice) and then
			// check target availability for the rest of the script with those choices made.
			// If just one of those branches has all targets, the ability is said to have all targets.
			if (this.steps[i].assignTo) {
				let oldVarValue = ability.scriptVariables[this.steps[i].assignTo];
				let foundValidBranch = false;
				for (const possibility of this.steps[i].evalFull(card, player, ability)) {
					if (possibility.length > 0 && possibility[0] instanceof actions.Action) {
						// TODO: Check if these actions need to be processed somehow or if using un-executed actions works just fine.
					}
					ability.scriptVariables[this.steps[i].assignTo] = possibility;
					if (this.hasAllTargetsFromStep(i + 1, card, player, ability, evaluatingPlayer)) {
						foundValidBranch = true;
						break;
					}
				}
				ability.scriptVariables[this.steps[i].assignTo] = oldVarValue;
				return foundValidBranch;
			}
		}
		return true;
	}
}

export class LineNode extends AstNode {
	constructor(parts, variable) {
		super();
		this.parts = parts;
		this.assignTo = variable;
	}
	* eval(card, player, ability) {
		let returnValues = [];
		for (let part of this.parts) {
			returnValues = returnValues.concat(yield* part.eval(card, player, ability));
		}
		if (returnValues.length > 0 && returnValues[0] instanceof actions.Action) {
			let timing = yield returnValues;
			returnValues = timing.actions;
		}

		if (this.assignTo) {
			ability.scriptVariables[this.assignTo] = returnValues;
		}
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		// This must return all possible combinations of the possible values for every action on this line.
		let possibilityLists = [];
		for (let part of this.parts) {
			possibilityLists.push(part.evalFull(card, player, ability, evaluatingPlayer));
		}
		return cartesianProduct(possibilityLists).map(list => list.flat(1));
	}
	getChildNodes() {
		return this.parts;
	}
}

export class TriggerRootNode extends AstNode {
	constructor(expression) {
		super();
		this.expression = expression;
	}
	* eval(card, player, ability) {
		setImplicitActions(player.game.currentPhase().lastActionList);

		let returnValue = yield* this.expression.eval(card, player, ability);

		clearImplicitActions();
		return returnValue;
	}
	getChildNodes() {
		return this.expression;
	}
}

export class ApplyTargetRootNode extends AstNode {
	constructor(expression) {
		super();
		this.expression = expression;
	}
	* eval(card, player, ability) {
		let cardList = yield* this.expression.eval(card, player, ability);

		if (cardList.length > 0 && cardList[0] instanceof zones.Zone) {
			cardList = cardList.map(zone => zone.cards).flat();
		}
		return cardList;
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
	* eval(card, player, ability) {
		player = (yield* this.player.eval(card, player, ability))[0];
		switch (this.functionName) {
			case "APPLY": {
				let modifier = (yield* this.parameters[1].eval(card, player, ability)).bake();
				let until = yield* this.parameters[2].eval(card, player, ability);
				return (yield* this.parameters[0].eval(card, player, ability)).map(card => new actions.ApplyCardStatChange(card.current(), modifier, until));
			}
			case "CANCELATTACK": {
				return [new actions.CancelAttack()];
			}
			case "COUNT": {
				let list = yield* this.parameters[0].eval(card, player, ability);
				return [list.length];
			}
			case "DAMAGE": {
				return [new actions.DealDamage(player, (yield* this.parameters[0].eval(card, player, ability))[0])];
			}
			case "DECKTOP": {
				return player.deckZone.cards.slice(Math.max(0, player.deckZone.cards.length - (yield* this.parameters[0].eval(card, player, ability))[0]), player.deckZone.cards.length);
			}
			case "DESTROY": {
				let cards = (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.current());
				let discards = cards.map(card => new actions.Discard(card.current()));
				return discards.concat(discards.map(discard => new actions.Destroy(discard)));
			}
			case "DIFFERENT": {
				let list = yield* this.parameters[0].eval(card, player, ability);
				for (let i = 0; i < list.length; i++) {
					for (let j = 0; j < list.length; j++) {
						if (i == j) {
							continue;
						}
						for (const element of list[j]) {
							if (equalityCompare(list[i], element)) {
								return false;
							}
						}
					}
				}
				return true;
			}
			case "DISCARD": {
				return (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.current()).map(card => new actions.Discard(card.current()));
			}
			case "DRAW": {
				let amount = (yield* this.parameters[0].eval(card, player, ability))[0];
				if (this.asManyAsPossible) {
					amount = Math.min(amount, player.deckZone.cards.length);
				}
				return [new actions.Draw(player, amount)];
			}
			case "EXILE": {
				return (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.current()).map(card => new actions.Exile(card.current()));
			}
			case "GAINLIFE": {
				return [new actions.ChangeLife(player, (yield* this.parameters[0].eval(card, player, ability))[0])];
			}
			case "GAINMANA": {
				return [new actions.ChangeMana(player, (yield* this.parameters[0].eval(card, player, ability))[0])];
			}
			case "GETCOUNTERS": {
				let cards = (yield* this.parameters[0].eval(card, player, ability));
				let type = (yield* this.parameters[1].eval(card, player, ability))[0];

				let total = 0;
				for (let card of cards) {
					if (card.counters[type]) {
						total += card.counters[type];
					}
				}

				return [total];
			}
			case "GIVEATTACK": {
				let target = (yield* this.parameters[0].eval(card, player, ability))[0];
				return target.current()? [new actions.GainAttack(target.current())] : [];
			}
			case "LOSELIFE": {
				return [new actions.ChangeLife(player, -(yield* this.parameters[0].eval(card, player, ability))[0])];
			}
			case "LOSEMANA": {
				return [new actions.ChangeMana(player, -(yield* this.parameters[0].eval(card, player, ability))[0])];
			}
			case "MOVE": {
				// TODO: Make player choose which cards to move if only a limited amount can be moved
				let cards = yield* this.parameters[0].eval(card, player, ability);
				let moveActions = [];
				let zoneMoveCards = new Map();
				for (const card of cards) {
					if (card.current() === null) {
						continue;
					}
					setImplicitCard(card);
					let zone = getZoneForCard(yield* this.parameters[1].eval(card, player, ability), card);
					let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
					if (this.parameters[1] instanceof DeckPositionNode) {
						index = this.parameters[1].top? -1 : 0;
					}
					moveActions.push(new actions.Move(player, card.current(), zone, index));
					zoneMoveCards.set(zone, (zoneMoveCards.get(zone) ?? []).concat(card.current()));
					clearImplicitCard();
				}

				for (const [zone, cards] of zoneMoveCards.entries()) {
					let freeSlots = zone.getFreeSpaceCount();
					if (freeSlots < cards.length) {
						let selectionRequest = new requests.chooseCards.create(player, cards, [freeSlots], "cardEffectMove:" + ability.id);
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

				return moveActions;
			}
			case "ORDER": {
				let toOrder = yield* this.parameters[0].eval(card, player, ability);
				let orderRequest = new requests.orderCards.create(player, toOrder, "cardEffect:" + ability.id);
				let response = yield [orderRequest];
				if (response.type != "orderCards") {
					throw new Error("Incorrect response type supplied during card ordering. (expected \"orderCards\", got \"" + response.type + "\" instead)");
				}
				return requests.orderCards.validate(response.value, orderRequest).map(card => new SnapshotCard(card.current()));
			}
			case "PUTCOUNTERS": {
				let cards = (yield* this.parameters[0].eval(card, player, ability));
				let type = (yield* this.parameters[1].eval(card, player, ability))[0];
				let amount = (yield* this.parameters[2].eval(card, player, ability))[0];

				return cards.map(card => new actions.ChangeCounters(card, type, amount));
			}
			case "REMOVECOUNTERS": {
				let cards = (yield* this.parameters[0].eval(card, player, ability));
				let type = (yield* this.parameters[1].eval(card, player, ability))[0];
				let amount = (yield* this.parameters[2].eval(card, player, ability))[0];

				return cards.map(card => new actions.ChangeCounters(card, type, -amount));
			}
			case "REVEAL": {
				return (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.current()).map(card => new actions.Reveal(card.current(), player));
			}
			case "SELECT": {
				let choiceAmount = yield* this.parameters[0].eval(card, player, ability);
				let eligibleCards = yield* this.parameters[1].eval(card, player, ability);
				for (let card of eligibleCards) {
					if (card.zone.player === player || !(["deck", "hand"].includes(card.zone.type))) {
						card.showTo(player);
					} else {
						// selecting from revealed hands is still random.
						card.hideFrom(player);
					}
				}
				let selectionRequest = new requests.chooseCards.create(player, eligibleCards, choiceAmount == "any"? [] : choiceAmount, "cardEffect:" + ability.id);
				let response = yield [selectionRequest];
				if (response.type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
				}
				for (let card of eligibleCards) {
					if (card.zone.type === "deck" || (card.zone.type === "hand" && card.zone.player !== player)) {
						card.hideFrom(player);
					}
				}
				let cards = requests.chooseCards.validate(response.value, selectionRequest).map(card => new SnapshotCard(card.current()));
				yield [events.createCardsSelectedEvent(player, cards)];
				return cards;
			}
			case "SELECTPLAYER": {
				let selectionRequest = new requests.choosePlayer.create(player, "cardEffect:" + ability.id);
				let response = yield [selectionRequest];
				if (response.type != "choosePlayer") {
					throw new Error("Incorrect response type supplied during player selection. (expected \"choosePlayer\", got \"" + response.type + "\" instead)");
				}
				let chosenPlayer = requests.choosePlayer.validate(response.value, selectionRequest);
				yield [events.createPlayerSelectedEvent(player, chosenPlayer)];
				return chosenPlayer;
			}
			case "SELECTTYPE": {
				let selectionRequest = new requests.chooseType.create(player, ability.id, yield* this.parameters[0].eval(card, player, ability));
				let response = yield [selectionRequest];
				if (response.type != "chooseType") {
					throw new Error("Incorrect response type supplied during type selection. (expected \"chooseType\", got \"" + response.type + "\" instead)");
				}
				let type = requests.chooseType.validate(response.value, selectionRequest);
				yield [events.createTypeSelectedEvent(player, type)];
				return [type];
			}
			case "SETATTACKTARGET": {
				let newTarget = (yield* this.parameters[0].eval(card, player, ability))[0];
				return newTarget.current()? [new actions.SetAttackTarget(newTarget.current())] : [];
			}
			case "SHUFFLE": {
				return [new actions.Shuffle(player)];
			}
			case "SUM": {
				let list = yield* this.parameters[0].eval(card, player, ability);
				let sum = 0;
				for (let num of list) {
					sum += num;
				}
				return [sum];
			}
			case "SUMMON": {
				// TODO: Make player choose which cards to summon if only a limited amount can be summoned
				let cards = yield* this.parameters[0].eval(card, player, ability);
				let zone = (yield* this.parameters[1].eval(card, player, ability))[0];
				let payCost = yield* this.parameters[2].eval(card, player, ability);

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
					let placeCost = new actions.Place(player, cards[i].current(), zone);
					placeCost.costIndex = i;
					costs.push(placeCost);
					placeActions.push(placeCost);

					if (payCost) {
						let costActions = cards[i].getSummoningCost(player);
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
						summons.push(new actions.Summon(player, placeActions[i]));
					}
				}
				return  summons;
			}
			case "TOKENS": {
				let amount = (yield* this.parameters[0].eval(card, player, ability))[0];
				let name = (yield* this.parameters[2].eval(card, player, ability))[0];
				let level = (yield* this.parameters[3].eval(card, player, ability))[0];
				let types = yield* this.parameters[4].eval(card, player, ability);
				let attack = (yield* this.parameters[5].eval(card, player, ability))[0];
				let defense = (yield* this.parameters[6].eval(card, player, ability))[0];
				let cards = [];
				for (let i = 0; i < amount; i++) {
					// TODO: Give player control over the specific token variant that gets selected
					let cardIds = yield* this.parameters[1].eval(card, player, ability);
					cards.push(new Card(player, `id: CU${cardIds[i % cardIds.length]}
cardType: token
name: CU${name}
level: ${level}
types: ${types.join(",")}
attack: ${attack}
defense: ${defense}`));
				}
				return cards;
			}
			case "VIEW": {
				return (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.current()).map(card => new actions.View(card.current(), player));
			}
		}
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		// TODO: Probably best to implement these on a case-by-case basis when cards actually need them
		switch (this.functionName) {
			case "DESTROY": {
				let cardLists = this.parameters[0].evalFull(card, player, ability).map(option => option.filter(card => card.current()));
				let discardLists = cardLists.map(cards => cards.map(card => new actions.Discard(card.current())));
				return discardLists.map(discards => discards.concat(discards.map(discard => new actions.Destroy(discard))));
			}
			case "DESTROY": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).map(option => option.filter(card => card.current()).map(card => new actions.Destroy(card.current())));
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).map(option => option.filter(card => card.current()).map(card => new actions.Discard(card.current())));
			}
			case "EXILE": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).map(option => option.filter(card => card.current()).map(card => new actions.Exile(card.current())));
			}
			case "MOVE": {
				let cardPossibilities = this.parameters[0].evalFull(card, player, ability, evaluatingPlayer);
				let moveActions = [];
				for (let cards of cardPossibilities) {
					moveActions.push([]);
					for (const card of cards) {
						if (card.current() === null) {
							continue;
						}
						setImplicitCard(card);
						// TODO: this might need to handle multiple zone possibilities
						let zone = getZoneForCard((this.parameters[1].evalFull(card, player, ability, evaluatingPlayer))[0], card);
						let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
						if (this.parameters[1] instanceof DeckPositionNode) {
							index = this.parameters[1].top? -1 : 0;
						}
						moveActions[moveActions.length - 1].push(new actions.Move(player, card.current(), zone, index));
						clearImplicitCard();
					}
				}
				return moveActions;
			}
			case "ORDER": {
				let toOrder = this.parameters[0].evalFull(card, player, ability);
				let options = [];
				for (const cards of toOrder) {
					options = options.concat(nChooseK(cards.length, cards.length).map(i => toOrder[i]));
				}
				return options;
			}
			case "REVEAL": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).map(option => option.filter(card => card.current()).map(card => new actions.Reveal(card.current(), player)));
			}
			case "SELECT": {
				let choiceAmounts = this.parameters[0].evalFull(card, player, ability, evaluatingPlayer)[0];
				let eligibleCards = this.parameters[1].evalFull(card, player, ability, evaluatingPlayer)[0];
				if (eligibleCards.length == 0) {
					return [[]];
				}
				if (choiceAmounts === "any") {
					choiceAmounts = [];
					for (let i = 1; i <= eligibleCards.length; i++) {
						choiceAmounts.push(i);
					}
				}

				let combinations = [];
				for (const amount of choiceAmounts) {
					combinations = combinations.concat(nChooseK(eligibleCards.length, amount).map(i => eligibleCards[i]));
				}
				return combinations;
			}
			case "VIEW": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).map(option => option.filter(card => card.current()).map(card => new actions.View(card.current(), player)));
			}
			default: {
				return super.evalFull(card, player, ability, evaluatingPlayer);
			}
		}
	}
	hasAllTargets(card, player, ability, evaluatingPlayer) {
		player = this.player.evalFull(card, player, ability, evaluatingPlayer)[0][0];
		// check if all child nodes have their targets
		if (!super.hasAllTargets(card, player, ability, evaluatingPlayer)) {
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
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				for (let amount of this.parameters[0].evalFull(card, player, ability, evaluatingPlayer)) {
					if (player.deckZone.cards.length >= amount[0]) {
						return true;
					}
				}
				return false;
			}
			case "DESTROY": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "EXILE": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "GIVEATTACK": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "MOVE": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "PUTCOUNTERS": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "REMOVECOUNTERS": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "REVEAL": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "SELECT": {
				let availableOptions = this.parameters[1].evalFull(card, player, ability, evaluatingPlayer);
				if (this.parameters[0] instanceof AnyAmountNode && availableOptions.find(list => list.length > 0) !== undefined) {
					return true;
				}
				let amountsRequired = this.parameters[0].evalFull(card, player, ability, evaluatingPlayer);
				for (let i = 0; i < availableOptions.length; i++) {
					if (Math.min(...amountsRequired[i]) <= availableOptions[i].length) {
						return true;
					}
				}
				return false;
			}
			case "SETATTACKTARGET": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "SHUFFLE": {
				let excludableCardAmounts = this.parameters[0]?.evalFull(card, player, ability, evaluatingPlayer)?.map(cardList => cardList.length) ?? [0];
				return player.deckZone.cards.length > Math.min(...excludableCardAmounts);
			}
			case "SUMMON": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
			}
			case "VIEW": {
				return this.parameters[0].evalFull(card, player, ability, evaluatingPlayer).find(list => list.length > 0) !== undefined;
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
	* eval(card, player, ability) {
		return yield* this.getMatchingCards(card, player, ability);
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		let generator = this.getMatchingCards(card, player, ability, evaluatingPlayer);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [next.value];
	}
	getChildNodes() {
		return this.cardListNodes.concat(this.conditions);
	}

	* getMatchingCards(card, player, ability, evaluatingPlayer = null) {
		let cards = [];
		let matchingCards = [];
		for (let cardList of this.cardListNodes) {
			cardList = yield* cardList.eval(card, player, ability);
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
			if (checkCard.hiddenFor.includes(evaluatingPlayer) && checkCard.zone !== evaluatingPlayer.deckZone) {
				matchingCards.push(checkCard);
				continue;
			}
			setImplicitCard(checkCard);
			if ((!this.conditions || (yield* this.conditions.eval(card, player, ability)))) {
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
	* eval(card, player, ability) {
		return [card];
	}
}
export class AttackTargetNode extends AstNode {
	* eval(card, player, ability) {
		if (player.game.currentAttackDeclaration?.target) {
			return [player.game.currentAttackDeclaration.target];
		}
		return [];
	}
}
export class AttackersNode extends AstNode {
	* eval(card, player, ability) {
		if (player.game.currentAttackDeclaration) {
			return player.game.currentAttackDeclaration.attackers;
		}
		return [];
	}
}
export class ImplicitCardNode extends AstNode {
	* eval(card, player, ability) {
		return [implicitCard[implicitCard.length - 1]];
	}
}
export class ImplicitActionsNode extends AstNode {
	* eval(card, player, ability) {
		return implicitActions[implicitActions.length - 1];
	}
}

export class CardPropertyNode extends AstNode {
	constructor(cards, property) {
		super();
		this.cards = cards;
		this.property = property;
	}

	* eval(card, player, ability) {
		return (yield* this.cards.eval(card, player, ability)).map(card => this.accessProperty(card)).flat();
	}

	evalFull(card, player, ability, evaluatingPlayer = null) {
		return this.cards.evalFull(card, player, ability, evaluatingPlayer).map(possibility => possibility.map(card => this.accessProperty(card)).flat());
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
			case "baseOwner": {
				return card.owner;
			}
			case "owner": {
				return card.zone?.player ?? card.owner;
			}
			case "equippedUnit": {
				return card.equippedTo? [card.equippedTo] : [];
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
	* eval(card, player, ability) {
		if (ability.scriptVariables[this.name] === undefined) {
			throw new Error("Tried to access unitialized variable '" + this.name + "'.");
		}
		return ability.scriptVariables[this.name];
	}
}

export class ValueArrayNode extends AstNode {
	constructor(values) {
		super();
		this.values = values;
	}
	* eval(card, player, ability) {
		return this.values;
	}
}

export class AnyAmountNode extends AstNode {
	* eval(card, player, ability) {
		return "any";
	}
}

export class AllTypesNode extends AstNode {
	* eval(card, player, ability) {
		return player.game.config.allTypes;
	}
}

// Math and comparison operators with left and right operands
export class MathNode extends AstNode {
	constructor(leftSide, rightSide) {
		super();
		this.leftSide = leftSide;
		this.rightSide = rightSide;
	}
	* eval(card, player, ability) {
		let left = (yield* this.leftSide.eval(card, player, ability));
		let right = (yield* this.rightSide.eval(card, player, ability));
		return this.doOperation(left, right);
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		let left = this.leftSide.evalFull(card, player, ability, evaluatingPlayer);
		let right = this.rightSide.evalFull(card, player, ability, evaluatingPlayer);
		let results = [];
		for (const leftValue of left) {
			for (const rightValue of right) {
				results.push(this.doOperation(leftValue, rightValue))
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
		super(leftSide, rightSide);
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
		super(leftSide, rightSide);
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
		super(leftSide, rightSide);
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
		super(leftSide, rightSide);
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
	* eval(card, player, ability) {
		return (yield* this.operand.eval(card, player, ability)).map(value => -value);
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		return this.operand.evalFull(card, player, ability, evaluatingPlayer).map(values => values.map(value => -value));
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
	* eval(card, player, ability) {
		return !(yield* this.operand.eval(card, player, ability));
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		return this.operand.evalFull(card, player, ability, evaluatingPlayer).map(value => !value);
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
	* eval(card, player, ability) {
		return this.value;
	}
}

export class PlayerNode extends AstNode {
	constructor(playerKeyword) {
		super();
		this.playerKeyword = playerKeyword;
	}
	* eval(card, player, ability) {
		// a card that is not in a zone belongs to its owner as it is in the process of being summoned/cast/deployed
		let you = card.zone?.player ?? card.owner;
		switch(this.playerKeyword) {
			case "you":
				return [you];
			case "opponent":
				return [you.next()];
			case "both":
				return [you, you.next()];
			case "self":
				return [player];
		}
	}
}
export class LifeNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(card, player, ability) {
		return (yield* this.playerNode.eval(card, player, ability)).map(player => player.life);
	}
}
export class ManaNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(card, player, ability) {
		return (yield* this.playerNode.eval(card, player, ability)).map(player => player.mana);
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier, playerNode) {
		super();
		this.zoneIdentifier = zoneIdentifier;
		this.playerNode = playerNode;
	}
	* eval(card, player, ability) {
		if (this.playerNode) {
			player = (yield* this.playerNode.eval(card, player, ability))[0];
		}
		return this.getZone(player);
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		let players;
		if (this.playerNode) {
			players = this.playerNode.evalFull(card, player, ability, evaluatingPlayer);
		} else {
			players = [player];
		}
		return players.map(player => this.getZone(player));
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
	* eval(card, player, ability) {
		return [(yield* this.playerNode.eval(card, player, ability))[0].deckZone];
	}
	evalFull(card, player, ability, evaluatingPlayer = null) {
		return this.playerNode.evalFull(card, player, ability, evaluatingPlayer).map(player => [player[0].deckZone]);
	}
	getChildNodes() {
		return [this.playerNode];
	}
}

export class PhaseNode extends AstNode {
	constructor(playerNode, phaseIndicator) {
		super();
		this.playerNode = playerNode;
		this.phaseIndicator = phaseIndicator;
	}
	* eval(card, player, ability) {
		let phaseAfterPrefix = this.phaseIndicator[0].toUpperCase() + this.phaseIndicator.slice(1);
		if (this.playerNode) {
			let prefix = player == (yield* this.playerNode.eval(card, player, ability))[0]? "your" : "opponent";
			return [prefix + phaseAfterPrefix];
		}
		return ["your" + phaseAfterPrefix, "opponent" + phaseAfterPrefix];
	}
}
export class TurnNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	* eval(card, player, ability) {
		if (player == (yield* this.playerNode.eval(card, player, ability))[0]) {
			return ["yourTurn"];
		}
		return ["opponentTurn"];
	}
}
export class CurrentPhaseNode extends AstNode {
	* eval(card, player, ability) {
		let phaseTypes = [...player.game.currentPhase().types];
		let prefix = player === game.currentTurn().player? "your" : "opponent";
		for (let i = phaseTypes.length -1; i >= 0; i--) {
			phaseTypes.push(prefix + phaseTypes[i][0].toUpperCase() + phaseTypes[i].slice(1));
		}
		return phaseTypes;
	}
}
export class CurrentTurnNode extends AstNode {
	* eval(card, player, ability) {
		return [player == player.game.currentTurn().player? "yourTurn" : "opponentTurn"];
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
	* eval(card, player, ability) {
		let values = [];
		let actionList = [];
		if (this.actionsNode instanceof CurrentTurnNode) {
			actionList = game.currentTurn().getActions();
		} else {
			actionList = yield* this.actionsNode.eval(card, player, ability);
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
		return values;
	}
}

export class ModifierNode extends AstNode {
	constructor(modifications) {
		super();
		this.modifications = modifications;
	}
	* eval(card, player, ability) {
		return new CardModifier(this.modifications, card, player, ability);
	}
}

export class UntilIndicatorNode extends AstNode {
	constructor(type) {
		super();
		this.type = type;
	}
	* eval(card, player, ability) {
		return this.type;
	}
}