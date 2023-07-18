// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import * as blocks from "../blocks.js";
import {Card, SnapshotCard} from "../card.js";
import {CardModifier} from "../cardValues.js";
import {Zone} from "../zones.js";

let currentImplicitCard = null;
export function setCurrentImplicitCard(card) {
	currentImplicitCard = card;
}
let currentImplicitActions = null;

class AstNode {
	* eval(card, player, ability) {}
	// evalFull() does the same as eval without being a generator function itself.
	// This means that player input and events generated inside of evalFull() will be ignored.
	evalFull(card, player, ability) {
		let generator = this.eval(card, player, ability);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return next.value;
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
		currentImplicitActions = player.game.currentPhase().lastActionList;

		let returnValue = yield* this.expression.eval(card, player, ability);

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
	* eval(card, player, ability) {
		let cardList = yield* this.expression.eval(card, player, ability);

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
				let cards = yield* this.parameters[0].eval(card, player, ability);
				let discards = cards.map(card => new actions.Discard(card.cardRef));
				return discards.concat(discards.map(discard => new actions.Destroy(discard)));
			}
			case "DISCARD": {
				return (yield* this.parameters[0].eval(card, player, ability)).map(card => new actions.Discard(card.cardRef));
			}
			case "DRAW": {
				let amount = (yield* this.parameters[0].eval(card, player, ability))[0];
				if (this.asManyAsPossible) {
					amount = Math.min(amount, player.deckZone.cards.length);
				}
				return [new actions.Draw(player, amount)];
			}
			case "EXILE": {
				return (yield* this.parameters[0].eval(card, player, ability)).map(card => new actions.Exile(card.cardRef));
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
			case "SELECT": {
				let responseCounts = yield* this.parameters[0].eval(card, player, ability);
				let eligibleCards = yield* this.parameters[1].eval(card, player, ability);
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
			case "SETATTACKTARGET": {
				return [new actions.SetAttackTarget((yield* this.parameters[0].eval(card, player, ability))[0])];
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
				let cards = yield* this.parameters[0].eval(card, player, ability);
				let zone = (yield* this.parameters[1].eval(card, player, ability))[0];
				let payCost = yield* this.parameters[2].eval(card, player, ability);

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
	hasAllTargets(card, player, ability) {
		player = this.player.evalFull(card, player, ability)[0];
		switch (this.functionName) {
			case "CANCELATTACK":
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
				return this.parameters[0].hasAllTargets(card, player, ability) && this.parameters[1].hasAllTargets(card, player, ability);
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				return player.deckZone.cards.length >= this.parameters[0].evalFull(card, player, ability)[0];
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
				let availableAmount = this.parameters[1].evalFull(card, player, ability).length;
				if (this.parameters[0] instanceof AnyAmountNode && availableAmount > 0) {
					return true;
				}
				let amountsRequired = this.parameters[0].evalFull(card, player, ability);
				return Math.min(...amountsRequired) <= availableAmount && this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "SETATTACKTARGET": {
				return this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "SUMMON": {
				return this.parameters[0].hasAllTargets(card, player, ability);
			}
		}
	}
	canDoInFull(card, player, ability) {
		player = this.player.evalFull(card, player, ability)[0];
		switch (this.functionName) {
			case "CANCELATTACK":
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
				return this.parameters[0].canDoInFull(card, player, ability) && this.parameters[1].canDoInFull(card, player, ability);
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				return player.deckZone.cards.length >= this.parameters[0].evalFull(card, player, ability)[0];
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
				return player.life + this.parameters[0].evalFull(card, player, ability)[0] >= 0;
			}
			case "LOSEMANA": {
				return player.mana + this.parameters[0].evalFull(card, player, ability)[0] >= 0;
			}
			case "SELECT": {
				let availableAmount = this.parameters[1].evalFull(card, player, ability).length;
				if (this.parameters[0] instanceof AnyAmountNode && availableAmount > 0) {
					return true;
				}
				let amountsRequired = this.parameters[0].evalFull(card, player, ability);
				return Math.min(...amountsRequired) <= availableAmount && this.parameters[0].canDoInFull(card, player, ability);
			}
			case "SETATTACKTARGET": {
				return this.parameters[0].canDoInFull(card, player, ability);
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
	* eval(card, player, ability) {
		let cards = [];
		let matchingCards = [];
		for (let cardList of this.cardListNodes) {
			cardList = yield* cardList.eval(card, player, ability);
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
			if ((!this.conditions || (yield* this.conditions.eval(card, player, ability)))) {
				matchingCards.push(checkCard);
				currentImplicitCard = lastImplicitCard;
				continue;
			}
			currentImplicitCard = lastImplicitCard;
		}
		return matchingCards;
	}
	hasAllTargets(card, player, ability) {
		return this.evalFull(card, player, ability).length > 0;
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
export class EquipmentNode extends AstNode {
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
		return [currentImplicitCard];
	}
}
export class ImplicitActionsNode extends AstNode {
	* eval(card, player, ability) {
		return currentImplicitActions;
	}
}

export class CardPropertyNode extends AstNode {
	constructor(cards, property) {
		super();
		this.cards = cards;
		this.property = property;
	}

	* eval(card, player, ability) {
		return (yield* this.cards.eval(card, player, ability)).map(card => {
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
		}).flat();
	}

	getChildNodes() {
		return [this.cards];
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
	* eval(card, player, ability) {
		let left = (yield* this.leftSide.eval(card, player, ability))[0];
		let right = (yield* this.rightSide.eval(card, player, ability))[0];
		if (typeof left == "number" && typeof right == "number") {
			return [left + right];
		}
		return [NaN];
	}
}
export class MinusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	* eval(card, player, ability) {
		let left = (yield* this.leftSide.eval(card, player, ability))[0];
		let right = (yield* this.rightSide.eval(card, player, ability))[0];
		if (typeof left == "number" && typeof right == "number") {
			return [left - right];
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
	* eval(card, player, ability) {
		let left = (yield* this.leftSide.eval(card, player, ability))[0];
		let right = (yield* this.rightSide.eval(card, player, ability))[0];
		if (typeof left != "number" || typeof right != "number") {
			return [NaN];
		}
		return [left * right];
	}
}
export class DivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	* eval(card, player, ability) {
		let left = (yield* this.leftSide.eval(card, player, ability))[0];
		let right = (yield* this.rightSide.eval(card, player, ability))[0];
		if (typeof left != "number" || typeof right != "number") {
			return [NaN];
		}
		return [left / right];
	}
}
export class FloorDivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	* eval(card, player, ability) {
		let left = (yield* this.leftSide.eval(card, player, ability))[0];
		let right = (yield* this.rightSide.eval(card, player, ability))[0];
		if (typeof left != "number" || typeof right != "number") {
			return [NaN];
		}
		return [Math.floor(left / right)];
	}
}
export class ComparisonNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
}
function equalityCompare(a, b) {
	if (a instanceof SnapshotCard && a.cardRef) {
		a = a.cardRef;
	}
	if (b instanceof SnapshotCard && b.cardRef) {
		b = b.cardRef;
	}
	return a == b;
}
export class EqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	* eval(card, player, ability) {
		let rightSideElements = yield* this.rightSide.eval(card, player, ability);
		for (let element of yield* this.leftSide.eval(card, player, ability)) {
			if (rightSideElements.some(elem => equalityCompare(elem, element))) {
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
	* eval(card, player, ability) {
		let rightSideElements = yield* this.rightSide.eval(card, player, ability);
		for (let element of yield* this.leftSide.eval(card, player, ability)) {
			if (rightSideElements.some(elem => equalityCompare(elem, element))) {
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
	* eval(card, player, ability) {
		for (let rightSide of yield* this.rightSide.eval(card, player, ability)) {
			for (let leftSide of yield* this.leftSide.eval(card, player, ability)) {
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
	* eval(card, player, ability) {
		for (let rightSide of yield* this.rightSide.eval(card, player, ability)) {
			for (let leftSide of yield* this.leftSide.eval(card, player, ability)) {
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
	* eval(card, player, ability) {
		return (yield* this.leftSide.eval(card, player, ability)) && (yield* this.rightSide.eval(card, player, ability));
	}
}
export class OrNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	* eval(card, player, ability) {
		return (yield* this.leftSide.eval(card, player, ability)) || (yield* this.rightSide.eval(card, player, ability));
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
	* eval(card, player, ability) {
		let phaseAfterPrefix = this.phaseIndicator[0].toUpperCase() + this.phaseIndicator.slice(1);
		if (this.player) {
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
		let prefix = player == game.currentTurn().player? "your" : "opponent";
		for (let i = phaseTypes.length -1; i >= 0; i--) {
			phaseTypes.push(prefix + phaseTypes[i][0].toUpperCase() + phaseTypes[i].slice(1));
		}
		return phaseTypes;
	}
}
export class CurrentTurnNode extends AstNode {
	* eval(card, player, ability) {
		return [player == game.currentTurn().player? "yourTurn" : "opponentTurn"];
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
		for (let action of yield* this.actionsNode.eval(card, player, ability)) {
			switch (this.accessor) {
				case "cast": {
					if (action instanceof actions.Cast) {
						values.push(action.spell)
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
						values.push(action.item);
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
				case "retired": {
					if (action instanceof actions.Discard && action.timing.block instanceof blocks.Retire) {
						values.push(action.card);
					}
					break;
				}
				case "summoned": {
					if (action instanceof actions.Summon) {
						values.push(action.unit);
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