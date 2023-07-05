// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import * as blocks from "../blocks.js";
import {Card} from "../card.js";
import {CardModifier} from "../cardValues.js";
import {Zone} from "../zones.js";

let currentImplicitCard = null;
let currentImplicitActions = null;

class AstNode {
	async* eval(card, player, ability) {}
	// evalFull() does the same as eval without being a generator function itself.
	// This means that player input and events generated inside of evalFull() will be ignored.
	async evalFull(card, player, ability) {
		let generator = this.eval(card, player, ability);
		let next;
		do {
			next = await generator.next();
		} while (!next.done);
		return next.value;
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	async hasAllTargets(card, player, ability) {
		for (let childNode of this.getChildNodes()) {
			if (!(await childNode.hasAllTargets(card, player, ability))) {
				return false;
			}
		}
		return true;
	}
	// Wether or not all actions in this tree can be done fully (as a cost)
	async canDoInFull(card, player, ability) {
		for (let childNode of this.getChildNodes()) {
			if (!(await childNode.canDoInFull(card, player, ability))) {
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
	async* eval(card, player, ability) {
		for (let step of this.steps) {
			yield* step.eval(card, player, ability);
		}
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
	async* eval(card, player, ability) {
		let returnValues = [];
		for (let part of this.parts) {
			returnValues = returnValues.concat(await (yield* part.eval(card, player, ability)));
		}
		if (returnValues.length > 0 && returnValues[0] instanceof actions.Action) {
			let timing = yield returnValues;
			returnValues = timing.actions;
		}

		if (this.assignTo) {
			ability.scriptVariables[this.assignTo] = returnValues;
		}
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
	async* eval(card, player, ability) {
		currentImplicitActions = player.game.currentPhase().lastActionList;

		let returnValue = await (yield* this.expression.eval(card, player, ability));

		currentImplicitActions = null;
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
	async* eval(card, player, ability) {
		let cardList = await (yield* this.expression.eval(card, player, ability));

		if (cardList.length > 0 && cardList[0] instanceof Zone) {
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
	async* eval(card, player, ability) {
		player = (await (yield* this.player.eval(card, player, ability)))[0];
		switch (this.functionName) {
			case "APPLY": {
				let modifier = await (await (yield* this.parameters[1].eval(card, player, ability))).bake();
				let until = await (yield* this.parameters[2].eval(card, player, ability));
				return (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.ApplyCardStatChange(card.cardRef, modifier, until));
			}
			case "COUNT": {
				let list = await (yield* this.parameters[0].eval(card, player, ability));
				return [list.length];
			}
			case "DAMAGE": {
				return [new actions.DealDamage(player, (await (yield* this.parameters[0].eval(card, player, ability)))[0])];
			}
			case "DECKTOP": {
				return player.deckZone.cards.slice(Math.max(0, player.deckZone.cards.length - (await (yield* this.parameters[0].eval(card, player, ability)))[0]), player.deckZone.cards.length);
			}
			case "DESTROY": {
				let cards = await (yield* this.parameters[0].eval(card, player, ability));
				return cards.map(card => new actions.Destroy(card.cardRef)).concat(cards.map(card => new actions.Discard(card.cardRef)));
			}
			case "DISCARD": {
				return (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.Discard(card.cardRef));
			}
			case "DRAW": {
				let amount = (await (yield* this.parameters[0].eval(card, player, ability)))[0];
				if (this.asManyAsPossible) {
					amount = Math.min(amount, player.deckZone.cards.length);
				}
				return [new actions.Draw(player, amount)];
			}
			case "EXILE": {
				return (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.Exile(card.cardRef));
			}
			case "GAINLIFE": {
				return [new actions.ChangeLife(player, (await (yield* this.parameters[0].eval(card, player, ability)))[0])];
			}
			case "GAINMANA": {
				return [new actions.ChangeMana(player, (await (yield* this.parameters[0].eval(card, player, ability)))[0])];
			}
			case "LOSELIFE": {
				return [new actions.ChangeLife(player, -(await (yield* this.parameters[0].eval(card, player, ability)))[0])];
			}
			case "LOSEMANA": {
				return [new actions.ChangeMana(player, -(await (yield* this.parameters[0].eval(card, player, ability)))[0])];
			}
			case "SELECT": {
				let responseCounts = await (yield* this.parameters[0].eval(card, player, ability));
				let eligibleCards = await (yield* this.parameters[1].eval(card, player, ability));
				if (eligibleCards.length == 0) {
					return [];
				}
				for (let card of eligibleCards) {
					card.hidden = false;
				}
				let selectionRequest = new requests.chooseCards.create(player, eligibleCards, responseCounts == "any"? [] : responseCounts, "cardEffect:" + ability.id);
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
				return requests.chooseCards.validate(responses[0].value, selectionRequest);
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
			case "SUM": {
				let list = await (yield* this.parameters[0].eval(card, player, ability));
				let sum = 0;
				for (let num of list) {
					sum += num;
				}
				return [sum];
			}
			case "SUMMON": {
				let cards = await (yield* this.parameters[0].eval(card, player, ability));
				let zone = (await (yield* this.parameters[1].eval(card, player, ability)))[0];
				let payCost = await (yield* this.parameters[2].eval(card, player, ability));

				let costs = [];
				for (let i = 0; i < cards.length; i++) {
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
						summons.push(new actions.Summon(player, cards[i].cardRef, zone, timing.actions.find(action => action instanceof actions.Place && action.costIndex == i).targetIndex));
					}
				}
				return  summons;
			}
			case "TOKENS": {
				let amount = (await (yield* this.parameters[0].eval(card, player, ability)))[0];
				let name = (await (yield* this.parameters[2].eval(card, player, ability)))[0];
				let level = (await (yield* this.parameters[3].eval(card, player, ability)))[0];
				let types = await (yield* this.parameters[4].eval(card, player, ability));
				let attack = (await (yield* this.parameters[5].eval(card, player, ability)))[0];
				let defense = (await (yield* this.parameters[6].eval(card, player, ability)))[0];
				let cards = [];
				for (let i = 0; i < amount; i++) {
					// TODO: Give player control over the specific token variant that gets selected
					let cardIds = await (yield* this.parameters[1].eval(card, player, ability));
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
	async hasAllTargets(card, player, ability) {
		player = (await this.player.evalFull(card, player, ability))[0];
		switch (this.functionName) {
			case "COUNT":
			case "DAMAGE":
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
				return await this.parameters[0].hasAllTargets(card, player, ability) && await this.parameters[1].hasAllTargets(card, player, ability);
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				return player.deckZone.cards.length >= (await this.parameters[0].evalFull(card, player, ability))[0];
			}
			case "DESTROY": {
				return this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "DISCARD": {
				return this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "EXILE": {
				return this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "SELECT": {
				let availableAmount = (await this.parameters[1].evalFull(card, player, ability)).length;
				if (this.parameters[0] instanceof AnyAmountNode && availableAmount > 0) {
					return true;
				}
				let amountsRequired = await this.parameters[0].evalFull(card, player, ability);
				return Math.min(...amountsRequired) <= availableAmount && await this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "SUMMON": {
				return this.parameters[0].hasAllTargets(card, player, ability);
			}
		}
	}
	async canDoInFull(card, player, ability) {
		player = (await this.player.evalFull(card, player, ability))[0];
		switch (this.functionName) {
			case "COUNT":
			case "DAMAGE":
			case "GAINLIFE":
			case "GAINMANA":
			case "DRAW":
			case "SELECTPLAYER":
			case "SUM":
			case "TOKENS": {
				return true;
			}
			case "APPLY": {
				return await this.parameters[0].canDoInFull(card, player, ability) && await this.parameters[1].canDoInFull(card, player, ability);
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				return player.deckZone.cards.length >= (await this.parameters[0].evalFull(card, player, ability))[0];
			}
			case "DESTROY": {
				return this.parameters[0].canDoInFull(card, player, ability);
			}
			case "DISCARD": {
				return this.parameters[0].canDoInFull(card, player, ability);
			}
			case "EXILE": {
				return this.parameters[0].canDoInFull(card, player, ability);
			}
			case "LOSELIFE": {
				return player.life + (await this.parameters[0].evalFull(card, player, ability))[0] >= 0;
			}
			case "LOSEMANA": {
				return player.mana + (await this.parameters[0].evalFull(card, player, ability))[0] >= 0;
			}
			case "SELECT": {
				let availableAmount = (await this.parameters[1].evalFull(card, player, ability)).length;
				if (this.parameters[0] instanceof AnyAmountNode && availableAmount > 0) {
					return true;
				}
				let amountsRequired = await this.parameters[0].evalFull(card, player, ability);
				return Math.min(...amountsRequired) <= availableAmount && await this.parameters[0].canDoInFull(card, player, ability);
			}
			case "SUMMON": {
				return this.parameters[0].canDoInFull(card, player, ability);
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
	async* eval(card, player, ability) {
		let cards = [];
		let matchingCards = [];
		for (let cardList of this.cardListNodes) {
			cardList = await (yield* cardList.eval(card, player, ability));
			if (cardList.length > 0 && (cardList[0] instanceof Zone)) {
				cards.push(...(cardList.map(zone => zone.cards).flat()));
			} else {
				cards.push(...cardList);
			}
		}
		for (let checkCard of cards) {
			if (checkCard == null) {
				continue;
			}
			let lastImplicitCard = currentImplicitCard;
			currentImplicitCard = checkCard;
			if ((!this.conditions || await (yield* this.conditions.eval(card, player, ability)))) {
				matchingCards.push(checkCard);
				currentImplicitCard = lastImplicitCard;
				continue;
			}
			currentImplicitCard = lastImplicitCard;
		}
		return matchingCards;
	}
	async hasAllTargets(card, player, ability) {
		return (await this.evalFull(card, player, ability)).length > 0;
	}
	getChildNodes() {
		return this.cardListNodes.concat(this.conditions);
	}
}
export class ThisCardNode extends AstNode {
	async* eval(card, player, ability) {
		return [card];
	}
}
export class ImplicitCardNode extends AstNode {
	async* eval(card, player, ability) {
		return [currentImplicitCard];
	}
}
export class ImplicitActionsNode extends AstNode {
	async* eval(card, player, ability) {
		return currentImplicitActions;
	}
}

export class CardPropertyNode extends AstNode {
	constructor(cards, property) {
		super();
		this.cards = cards;
		this.property = property;
	}

	async* eval(card, player, ability) {
		return (await (yield* this.cards.eval(card, player, ability))).map(card => {
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
					return card.zone.player;
				}
				case "self": {
					return card.cardRef;
				}
				case "zone": {
					return card.zone;
				}
			}
		}).flat();
	}
}

export class VariableNode extends AstNode {
	constructor(name) {
		super();
		this.name = name;
	}
	async* eval(card, player, ability) {
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
	async* eval(card, player, ability) {
		return this.values;
	}
}

export class AnyAmountNode extends AstNode {
	async* eval(card, player, ability) {
		return "any";
	}
}

export class AllTypesNode extends AstNode {
	async* eval(card, player, ability) {
		return player.game.allTypes;
	}
}

// Math and comparison operators with left and right operands
export class MathNode extends AstNode {
	constructor(leftSide, rightSide) {
		super();
		this.leftSide = leftSide;
		this.rightSide = rightSide;
	}
	getChildNodes() {
		return [this.leftSide, this.rightSide];
	}
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
	async* eval(card, player, ability) {
		return [(await (yield* this.leftSide.eval(card, player, ability)))[0] + (await (yield* this.rightSide.eval(card, player, ability)))[0]];
	}
}
export class MinusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return [(await (yield* this.leftSide.eval(card, player, ability)))[0] - (await (yield* this.rightSide.eval(card, player, ability)))[0]];
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
	async* eval(card, player, ability) {
		return [(await (yield* this.leftSide.eval(card, player, ability)))[0] * (await (yield* this.rightSide.eval(card, player, ability)))[0]];
	}
}
export class DivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return [(await (yield* this.leftSide.eval(card, player, ability)))[0] / (await (yield* this.rightSide.eval(card, player, ability)))[0]];
	}
}
export class FloorDivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return [Math.floor((await (yield* this.leftSide.eval(card, player, ability)))[0] / (await (yield* this.rightSide.eval(card, player, ability)))[0])];
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
	async* eval(card, player, ability) {
		let rightSideElements = await (yield* this.rightSide.eval(card, player, ability));
		for (let element of await (yield* this.leftSide.eval(card, player, ability))) {
			if (rightSideElements.includes(element)) {
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
	async* eval(card, player, ability) {
		let rightSideElements = await (yield* this.rightSide.eval(card, player, ability));
		for (let element of await (yield* this.leftSide.eval(card, player, ability))) {
			if (rightSideElements.includes(element)) {
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
	async* eval(card, player, ability) {
		for (let rightSide of await (yield* this.rightSide.eval(card, player, ability))) {
			for (let leftSide of await (yield* this.leftSide.eval(card, player, ability))) {
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
	async* eval(card, player, ability) {
		for (let rightSide of await (yield* this.rightSide.eval(card, player, ability))) {
			for (let leftSide of await (yield* this.leftSide.eval(card, player, ability))) {
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
	async* eval(card, player, ability) {
		return (await (yield* this.leftSide.eval(card, player, ability))) && (await (yield* this.rightSide.eval(card, player, ability)));
	}
}
export class OrNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return (await (yield* this.leftSide.eval(card, player, ability))) || (await (yield* this.rightSide.eval(card, player, ability)));
	}
}

// Unary operators
export class UnaryMinusNode extends AstNode {
	constructor(operand) {
		super();
		this.operand = operand;
	}
	async* eval(card, player, ability) {
		return (await (yield* this.operand.eval(card, player, ability))).map(value => -value);
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
	async* eval(card, player, ability) {
		return !(await (yield* this.operand.eval(card, player, ability)));
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
	async* eval(card, player, ability) {
		return this.value;
	}
}

export class PlayerNode extends AstNode {
	constructor(playerKeyword) {
		super();
		this.playerKeyword = playerKeyword;
	}
	async* eval(card, player, ability) {
		return this.playerKeyword == "you"? [player] : [player.next()];
	}
}
export class LifeNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	async* eval(card, player, ability) {
		return (await (yield* this.playerNode.eval(card, player, ability))).map(player => player.life);
	}
}
export class ManaNode extends AstNode {
	constructor(playerNode) {
		super();
		this.playerNode = playerNode;
	}
	async* eval(card, player, ability) {
		return (await (yield* this.playerNode.eval(card, player, ability))).map(player => player.mana);
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier, playerNode) {
		super();
		this.zoneIdentifier = zoneIdentifier;
		this.playerNode = playerNode;
	}
	async* eval(card, player, ability) {
		if (this.playerNode) {
			player = (await (yield* this.playerNode.eval(card, player, ability)))[0];
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
	getChildNodes() {
		return this.player? [this.player] : [];
	}
}

export class PhaseNode extends AstNode {
	constructor(playerNode, phaseIndicator) {
		super();
		this.playerNode = playerNode;
		this.phaseIndicator = phaseIndicator;
	}
	async* eval(card, player, ability) {
		let phaseAfterPrefix = this.phaseIndicator[0].toUpperCase() + this.phaseIndicator.slice(1);
		if (this.player) {
			let prefix = player == (await (yield* this.playerNode.eval(card, player, ability)))[0]? "your" : "opponent";
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
	async* eval(card, player, ability) {
		if (player == (await (yield* this.playerNode.eval(card, player, ability)))[0]) {
			return ["yourTurn"];
		}
		return ["opponentTurn"];
	}
}
export class CurrentPhaseNode extends AstNode {
	async* eval(card, player, ability) {
		let phaseTypes = [...player.game.currentPhase().types];
		let prefix = player == game.currentTurn().player? "your" : "opponent";
		for (let i = phaseTypes.length -1; i >= 0; i--) {
			phaseTypes.push(prefix + phaseTypes[i][0].toUpperCase() + phaseTypes[i].slice(1));
		}
		return phaseTypes;
	}
}
export class CurrentTurnNode extends AstNode {
	async* eval(card, player, ability) {
		return [player == game.currentTurn().player? "yourTurn" : "opponentTurn"];
	}
}


function addCardIfUnique(values, card) {
	if (values.find(inList => inList.cardRef == card.cardRef)) {
		return;
	}
	values.push(card);
}

export class ActionAccessorNode extends AstNode {
	constructor(actionsNode, accessor) {
		super();
		this.actionsNode = actionsNode;
		this.accessor = accessor;
	}
	async* eval(card, player, ability) {
		let actionType = {
			"discarded": actions.Discard,
			"destroyed": actions.Destroy,
			"exiled": actions.Exile,
			"summoned": actions.Summon,
			"cast": actions.Cast,
			"deployed": actions.Deploy,
			"targeted": actions.EstablishAttackDeclaration,
			"declared": actions.EstablishAttackDeclaration,
			"retired": actions.Discard
		}[this.accessor];

		let values = [];
		for (let action of await (yield* this.actionsNode.eval(card, player, ability))) {
			if (action instanceof actionType) {
				switch (action.constructor) {
					case actions.Discard:
						if (this.accessor == "retired" && !(action.timing.block instanceof blocks.Retire)) {
							break;
						}
					case actions.Destroy:
					case actions.Exile: {
						addCardIfUnique(values, action.card);
						break;
					}
					case actions.Summon: {
						addCardIfUnique(values, action.unit);
						break;
					}
					case actions.Cast: {
						addCardIfUnique(values, action.spell);
						break;
					}
					case actions.Deploy: {
						addCardIfUnique(values, action.item);
						break;
					}
					case actions.EstablishAttackDeclaration: {
						if (this.accessor == "targeted") {
							addCardIfUnique(values, action.attackTarget);
						}
						if (this.accessor == "declared") {
							for (let attacker of action.attackers) {
								addCardIfUnique(values, attacker);
							}
						}
						break;
					}
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
	async* eval(card, player, ability) {
		return new CardModifier(this.modifications, card, player, ability);
	}
}

export class UntilIndicatorNode extends AstNode {
	constructor(type) {
		super();
		this.type = type;
	}
	async* eval(card, player, ability) {
		return this.type;
	}
}