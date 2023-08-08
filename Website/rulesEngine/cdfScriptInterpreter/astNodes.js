// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import * as blocks from "../blocks.js";
import * as zones from "../zones.js";
import {Card, SnapshotCard} from "../card.js";
import {CardModifier} from "../cardValues.js";

let implicitCard = [null];
let implicitActions = [null];

// helper functions
function equalityCompare(a, b) {
	if (a instanceof SnapshotCard && a.cardRef) {
		a = a.cardRef;
	}
	if (b instanceof SnapshotCard && b.cardRef) {
		b = b.cardRef;
	}
	return a == b;
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
	evalFull(card, player, ability) {
		let generator = this.eval(card, player, ability);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [next.value];
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(card, player, ability) {
		for (let childNode of this.getChildNodes()) {
			if (!childNode.hasAllTargets(card, player, ability)) {
				return false;
			}
		}
		return true;
	}
	// Wether or not all actions in this tree can be done fully (as a cost)
	canDoInFull(card, player, ability) {
		for (let childNode of this.getChildNodes()) {
			if (!childNode.canDoInFull(card, player, ability)) {
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
	hasAllTargets(card, player, ability) {
		for (let i = 0; i < this.steps.length; i++) {
			if (!this.steps[i].hasAllTargets(card, player, ability)) {
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
					for (let j = i + 1; j < this.steps.length; j++) {
						if (!this.steps[j].hasAllTargets(card, player, ability)) {
							continue;
						} else if (j == this.steps.length - 1) {
							foundValidBranch = true;
						}
					}
				}
				ability.scriptVariables[this.steps[i].assignTo] = oldVarValue;
				return foundValidBranch;
			}
		}
		return true;
	}
	getChildNodes() {
		return this.steps;
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
	evalFull(card, player, ability) {
		// This must return all possible combinations of the possible values for every action on this line.
		let possibilityLists = [];
		for (let part of this.parts) {
			possibilityLists.push(part.evalFull(card, player, ability));
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
				return (yield* this.parameters[0].eval(card, player, ability)).map(card => new actions.ApplyCardStatChange(card.cardRef, modifier, until));
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
				let cards = (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.cardRef);
				let discards = cards.map(card => new actions.Discard(card.cardRef));
				return discards.concat(discards.map(discard => new actions.Destroy(discard)));
			}
			case "DIFFERENT": {
				let list = yield* this.parameters[0].eval(card, player, ability);
				for (let i = 0; i < list.length; i++) {
					for (let j = 0; j < list.length; j++) {
						if (i == j) {
							continue;
						}
						for (element of list[j]) {
							if (list[i].some(elem => equalityCompare(elem, element))) {
								return false;
							}
						}
					}
				}
				return true;
			}
			case "DISCARD": {
				return (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.cardRef).map(card => new actions.Discard(card.cardRef));
			}
			case "DRAW": {
				let amount = (yield* this.parameters[0].eval(card, player, ability))[0];
				if (this.asManyAsPossible) {
					amount = Math.min(amount, player.deckZone.cards.length);
				}
				return [new actions.Draw(player, amount)];
			}
			case "EXILE": {
				return (yield* this.parameters[0].eval(card, player, ability)).filter(card => card.cardRef).map(card => new actions.Exile(card.cardRef));
			}
			case "GAINLIFE": {
				return [new actions.ChangeLife(player, (yield* this.parameters[0].eval(card, player, ability))[0])];
			}
			case "GAINMANA": {
				return [new actions.ChangeMana(player, (yield* this.parameters[0].eval(card, player, ability))[0])];
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
				for (const card of cards) {
					if (card.cardRef === null) {
						continue;
					}
					setImplicitCard(card);
					let zone = (yield* this.parameters[1].eval(card, player, ability))[0];
					let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
					if (this.parameters[1] instanceof DeckPositionNode) {
						index = this.parameters[1].top? -1 : 0;
					}
					moveActions.push(new actions.Move(player, card.cardRef, zone, index));
					clearImplicitCard();
				}
				return moveActions;
			}
			case "SELECT": {
				let choiceAmount = yield* this.parameters[0].eval(card, player, ability);
				let eligibleCards = yield* this.parameters[1].eval(card, player, ability);
				if (eligibleCards.length == 0) {
					return [];
				}
				for (let card of eligibleCards) {
					if (!(["deck", "hand"].includes(card.zone.type) && !card.zone.player.isViewable)) {
						card.hidden = false;
					}
				}
				let selectionRequest = new requests.chooseCards.create(player, eligibleCards, choiceAmount == "any"? [] : choiceAmount, "cardEffect:" + ability.id);
				let responses = yield [selectionRequest];
				if (responses.length != 1) {
					throw new Error("Incorrect number of responses supplied during card selection. (expected 1, got " + responses.length + " instead)");
				}
				if (responses[0].type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + responses[0].type + "\" instead)");
				}
				for (let card of eligibleCards) {
					card.hidden = card.zone.type == "deck" || (card.zone.type == "hand" && !card.zone.player.isViewable);
				}
				return requests.chooseCards.validate(responses[0].value, selectionRequest).map(card => card.snapshot());
			}
			case "SELECTPLAYER": {
				let selectionRequest = new requests.choosePlayer.create(player, "cardEffect:" + ability.id);
				let responses = yield [selectionRequest];
				if (responses.length != 1) {
					throw new Error("Incorrect number of responses supplied during player selection. (expected 1, got " + responses.length + " instead)");
				}
				if (responses[0].type != "choosePlayer") {
					throw new Error("Incorrect response type supplied during player selection. (expected \"choosePlayer\", got \"" + responses[0].type + "\" instead)");
				}
				return requests.choosePlayer.validate(responses[0].value, selectionRequest);
			}
			case "SETATTACKTARGET": {
				let card = (yield* this.parameters[0].eval(card, player, ability))[0];
				return card.cardRef? [new actions.SetAttackTarget(card.cardRef)] : [];
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
					if (cards[i].cardRef === null) {
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
					let placeCost = new actions.Place(player, cards[i].cardRef, zone);
					placeCost.costIndex = i;
					costs.push(placeCost);
					placeActions.push(placeCost);


					if (payCost) {
						let manaCost = new actions.ChangeMana(player, -cards[i].cardRef.values.level);
						manaCost.costIndex = i;
						costs.push(manaCost);
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
defense: ${defense}`, false));
				}
				return cards;
			}
		}
	}
	evalFull(card, player, ability) {
		// TODO: Probably best to implement these on a case-by-case basis when cards actually need them
		switch (this.functionName) {
			case "SELECT": {
				let choiceAmounts = this.parameters[0].evalFull(card, player, ability)[0];
				let eligibleCards = this.parameters[1].evalFull(card, player, ability)[0];
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
					combinations = combinations.concat(nChooseK(eligibleCards.length, amount));
				}

				for (const combination of combinations) {
					for (let i = 0; i < combination.length; i++) {
						combination[i] = eligibleCards[combination[i]];
					}
				}
				return combinations;
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(card, player, ability).map(option => option.filter(card => card.cardRef).map(card => new actions.Discard(card.cardRef)));
			}
			case "EXILE": {
				return this.parameters[0].evalFull(card, player, ability).map(option => option.filter(card => card.cardRef).map(card => new actions.Exile(card.cardRef)));
			}
			case "MOVE": {
				let cardPossibilities = this.parameters[0].evalFull(card, player, ability);
				let moveActions = [];
				for (let cards of cardPossibilities) {
					moveActions.push([]);
					for (const card of cards) {
						if (card.cardRef === null) {
							continue;
						}
						setImplicitCard(card);
						let zone = (this.parameters[1].evalFull(card, player, ability))[0][0]; // TODO: this might need to handle multiple zone possibilities
						let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
						if (this.parameters[1] instanceof DeckPositionNode) {
							index = this.parameters[1].top? -1 : 0;
						}
						moveActions[moveActions.length - 1].push(new actions.Move(player, card.cardRef, zone, index));
						clearImplicitCard();
					}
				}
				return moveActions;
			}
			default: {
				return super.evalFull(card, player, ability);
			}
		}
	}
	hasAllTargets(card, player, ability) {
		player = this.player.evalFull(card, player, ability)[0][0];
		// check if all child nodes have their targets
		if (!super.hasAllTargets(card, player, ability)) {
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
			case "LOSELIFE":
			case "LOSEMANA":
			case "SELECTPLAYER":
			case "SUM":
			case "TOKENS": {
				return true;
			}
			case "APPLY": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				for (let amount of this.parameters[0].evalFull(card, player, ability)) {
					if (player.deckZone.cards.length >= amount[0]) {
						return true;
					}
				}
				return false;
			}
			case "DESTROY": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "EXILE": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "MOVE": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "SELECT": {
				let availableOptions = this.parameters[1].evalFull(card, player, ability);
				if (this.parameters[0] instanceof AnyAmountNode && availableOptions.find(list => list.length > 0) !== undefined) {
					return true;
				}
				let amountsRequired = this.parameters[0].evalFull(card, player, ability);
				for (let i = 0; i < availableOptions.length; i++) {
					if (Math.min(...amountsRequired[i]) <= availableOptions[i].length) {
						return true;
					}
				}
				return false;
			}
			case "SETATTACKTARGET": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "SUMMON": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
		}
	}
	canDoInFull(card, player, ability) {
		player = this.player.evalFull(card, player, ability)[0][0];
		// check if all child nodes can be done in full
		if (!super.canDoInFull(card, player, ability)) {
			return false;
		}
		switch (this.functionName) {
			case "CANCELATTACK":
			case "COUNT":
			case "DAMAGE":
			case "DIFFERENT":
			case "GAINLIFE":
			case "GAINMANA":
			case "DRAW":
			case "SELECTPLAYER":
			case "SUM":
			case "TOKENS": {
				return true;
			}
			case "APPLY": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				for (let amount of this.parameters[0].evalFull(card, player, ability)) {
					if (player.deckZone.cards.length >= amount[0]) {
						return true;
					}
				}
				return false;
			}
			case "DESTROY": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "DISCARD": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "EXILE": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "LOSELIFE": {
				for (let amount of this.parameters[0].evalFull(card, player, ability)) {
					if (player.life + amount[0] >= 0) {
						return true;
					}
				}
				return false;
			}
			case "LOSEMANA": {
				for (let amount of this.parameters[0].evalFull(card, player, ability)) {
					if (player.mana + amount[0] >= 0) {
						return true;
					}
				}
				return false;
			}
			case "MOVE": {
				let freeZoneSlots = this.parameters[1].evalFull(card, player, ability).map(zones => zones.map(zone => zone.getFreeSpaceCount()).flat());
				let moveAmounts = this.parameters[0].evalFull(card, player, ability).map(list => list.length);
				for (let free of freeZoneSlots) {
					for (let moveAmount of moveAmounts) {
						if (moveAmount > 0 && (free >= moveAmount || (free > 0 && this.asManyAsPossible))) {
							return true;
						}
					}
				}
				return false;
			}
			case "SELECT": {
				let availableOptions = this.parameters[1].evalFull(card, player, ability);
				if (this.parameters[0] instanceof AnyAmountNode && availableOptions.find(list => list.length > 0) !== undefined) {
					return true;
				}
				let amountsRequired = this.parameters[0].evalFull(card, player, ability).flat();
				return Math.min(...amountsRequired) <= availableAmount;
			}
			case "SETATTACKTARGET": {
				return this.parameters[0].evalFull(card, player, ability).find(list => list.length > 0) !== undefined;
			}
			case "SUMMON": {
				let freeZoneSlots = this.parameters[1].evalFull(card, player, ability).map(zones => zones.map(zone => zone.getFreeSpaceCount()).flat());
				let summonAmounts = this.parameters[0].evalFull(card, player, ability).map(list => list.length);
				for (let free of freeZoneSlots) {
					for (let summonAmount of summonAmounts) {
						if (summonAmount > 0 && (free >= summonAmount || (free > 0 && this.asManyAsPossible))) {
							return true;
						}
					}
				}
				return false;
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
	getChildNodes() {
		return this.cardListNodes.concat(this.conditions);
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
export class EquipmentsNode extends AstNode {
	* eval(card, player, ability) {
		return card.equipments;
	}
}
export class EquippedToNode extends AstNode {
	* eval(card, player, ability) {
		return [card.equippedTo];
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

	evalFull(card, player, ability) {
		return this.cards.evalFull(card, player, ability).map(possibility => possibility.map(card => this.accessProperty(card)).flat());
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
	evalFull(card, player, ability) {
		let left = this.leftSide.evalFull(card, player, ability);
		let right = this.rightSide.evalFull(card, player, ability);
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
		return [NaN];
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
		return [NaN];
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
	evalFull(card, player, ability) {
		return this.operand.evalFull(card, player, ability).map(values => values.map(value => -value));
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
	evalFull(card, player, ability) {
		return this.operand.evalFull(card, player, ability).map(value => !value);
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
		return this.playerKeyword == "you"? [player] : [player.next()];
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
	evalFull(card, player, ability) {
		let players;
		if (this.playerNode) {
			players = this.playerNode.evalFull(card, player, ability);
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
	evalFull(card, player, ability) {
		return this.playerNode.evalFull(card, player, ability).map(player => [player[0].deckZone]);
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
						values.push(action.placeAction.card);
					}
					break;
				}
				case "chosenTarget": {
					if (action instanceof actions.EstablishAttackDeclaration) {
						values.push(action.attackTarget);
					}
					break;
				}
				case "declared": {
					if (action instanceof actions.EstablishAttackDeclaration) {
						for (let attacker of action.attackers) {
							values.push(attacker);
						}
					}
					break;
				}
				case "deployed": {
					if (action instanceof actions.Deploy) {
						values.push(action.placeAction.card);
					}
					break;
				}
				case "destroyed": {
					if (action instanceof actions.Destroy) {
						values.push(action.discard.card);
					}
					break;
				}
				case "discarded": {
					if (action instanceof actions.Discard) {
						values.push(action.card);
					}
					break;
				}
				case "exiled": {
					if (action instanceof actions.Exile) {
						values.push(action.card);
					}
					break;
				}
				// TODO: This might need to be split up into separate selectors for cards getting added / returned to zones.
				//       (once / if there ever is a card that can replace one type of move with another)
				//       Though the exact behavior here would probably need to be clarified by a new ruling.
				case "moved": {
					if (action instanceof actions.Move) {
						values.push(action.card);
					}
					break;
				}
				case "retired": {
					if (action instanceof actions.Discard && action.timing.block instanceof blocks.Retire) {
						values.push(action.card);
					}
					break;
				}
				case "summoned": {
					if (action instanceof actions.Summon) {
						values.push(action.placeAction.card);
					}
					break;
				}
				case "targeted": {
					if (action instanceof actions.EstablishAttackDeclaration) {
						values.push(action.attackTarget);
					} else if (action instanceof actions.SetAttackTarget) {
						values.push(action.newTarget);
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