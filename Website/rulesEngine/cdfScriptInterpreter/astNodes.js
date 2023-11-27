// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as blocks from "../blocks.js";
import * as zones from "../zones.js";
import {BaseCard} from "../card.js";
import {CardModifier} from "../cardValues.js";
import {ScriptValue, ScriptContext, DeckPosition} from "./structs.js";
import {functions, initFunctions} from "./functions.js";

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

class AstNode {
	constructor(returnType) {
		this.returnType = returnType; // null indicates no return type
	}

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
		super(null);
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
		super(expression.returnType);
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
		super(expression.returnType);
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

// Represents the language's built-in functions
export class FunctionNode extends AstNode {
	constructor(functionName, parameters, player, asManyAsPossible) {
		super(functions[functionName].returnType);
		this.function = functions[functionName];
		this.parameters = parameters;
		this.player = player;
		this.asManyAsPossible = asManyAsPossible;
	}
	* eval(ctx) {
		let players = (yield* this.player.eval(ctx)).get(ctx.player);
		if (players.length == 1) {
			let value = yield* this.function.run(this, new ScriptContext(ctx.card, players[0], ctx.ability));
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
			let value = yield* this.function.run(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer));
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
	evalFull(ctx) {
		let players = this.player.evalFull(ctx)[0].get(ctx.player);
		if (players.length == 1) {
			let result = this.function.runFull?.(this, new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer));
			return result ?? super.evalFull(new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer));
		}
		// otherwise this is a both.FUNCTION() and must create split values, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);
		let values = [];
		for (const player of players) {
			values.push(this.function.runFull?.(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer)));
		}
		return cartesianProduct(values).map(list => {
			let valueMap = new Map();
			for (let i = 0; i < list.length; i++) {
				valueMap.set(players[i], list[i].get(players[i]));
			}
			return new ScriptValue(list[0].type, valueMap);
		});
	}
	hasAllTargets(ctx) {
		let players = this.player.evalFull(ctx)[0].get(ctx.player);
		for (const player of players) {
			if (!this.function.hasAllTargets(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer))) {
				return false;
			}
		}
		return true;
	}
	getChildNodes() {
		return this.parameters.concat([this.player]);
	}
}

export class CardMatchNode extends AstNode {
	constructor(cardListNodes, conditions) {
		super("card");
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
	constructor() {
		super("card");
	}
	* eval(ctx) {
		return new ScriptValue("card", [ctx.card]);
	}
}
export class AttackTargetNode extends AstNode {
	constructor() {
		super("card");
	}
	* eval(ctx) {
		if (ctx.game.currentAttackDeclaration?.target) {
			return new ScriptValue("card", [ctx.game.currentAttackDeclaration.target]);
		}
		return new ScriptValue("card", []);
	}
}
export class AttackersNode extends AstNode {
	constructor() {
		super("card");
	}
	* eval(ctx) {
		if (ctx.game.currentAttackDeclaration) {
			return new ScriptValue("card", ctx.game.currentAttackDeclaration.attackers);
		}
		return new ScriptValue("card", []);
	}
}
export class ImplicitCardNode extends AstNode {
	constructor() {
		super("card");
	}
	* eval(ctx) {
		return new ScriptValue("card", [implicitCard[implicitCard.length - 1]]);
	}
}
export class ImplicitActionsNode extends AstNode {
	constructor() {
		super("action");
	}
	* eval(ctx) {
		return new ScriptValue("action", implicitActions[implicitActions.length - 1]);
	}
}

export class CardPropertyNode extends AstNode {
	constructor(cards, property) {
		super({
			"name": "cardId",
			"baseName": "cardId",
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
		}[property]);
		this.cards = cards;
		this.property = property;
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
	constructor(name, returnType) {
		super(returnType);
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
	constructor(values, returnType) {
		super(returnType);
		this.values = values;
	}
	* eval(ctx) {
		return new ScriptValue(this.returnType, this.values);
	}
}

export class AnyAmountNode extends AstNode {
	constructor() {
		super("number");
	}
	* eval(ctx) {
		return new ScriptValue("number", "any");
	}
}

export class AllTypesNode extends AstNode {
	constructor() {
		super("type");
	}
	* eval(ctx) {
		return new ScriptValue("type", ctx.game.config.allTypes);
	}
}

// Math and comparison operators with left and right operands
export class MathNode extends AstNode {
	constructor(leftSide, rightSide) {
		super(null); // return type is set later by the parser once it has consolidated the expression tree
		this.leftSide = leftSide;
		this.rightSide = rightSide;
	}
	* eval(ctx) {
		let left = (yield* this.leftSide.eval(ctx)).get(ctx.player);
		let right = (yield* this.rightSide.eval(ctx)).get(ctx.player);
		return new ScriptValue(this.returnType, this.doOperation(left, right));
	}
	evalFull(ctx) {
		let left = this.leftSide.evalFull(ctx).map(value => value.get(ctx.player));
		let right = this.rightSide.evalFull(ctx).map(value => value.get(ctx.player));
		let results = [];
		for (const leftValue of left) {
			for (const rightValue of right) {
				results.push(new ScriptValue(this.returnType, this.doOperation(leftValue, rightValue)));
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
		super("number");
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
		super("bool");
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
		super("bool");
		this.value = value == "yes";
	}
	* eval(ctx) {
		return new ScriptValue("bool", this.value);
	}
}

export class PlayerNode extends AstNode {
	constructor(playerKeyword) {
		super("player");
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
		super("number");
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		return new ScriptValue("number", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.life));
	}
}
export class ManaNode extends AstNode {
	constructor(playerNode) {
		super("number");
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		return new ScriptValue("number", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.mana));
	}
}
export class PartnerNode extends AstNode {
	constructor(playerNode) {
		super("card");
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		return new ScriptValue("card", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.partnerZone.cards[0]));
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier, playerNode) {
		super("zone");
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
		super("zone");
		this.playerNode = playerNode;
		this.top = position === "deckTop";
	}
	* eval(ctx) {
		return new ScriptValue("zone", new DeckPosition((yield* this.playerNode.eval(ctx)).get(ctx.player)[0].deckZone, this.top));
	}
	evalFull(ctx) {
		return this.playerNode.evalFull(ctx).map(p => new ScriptValue("zone", new DeckPosition(p.get(ctx.player)[0].deckZone, this.top)));
	}
	getChildNodes() {
		return [this.playerNode];
	}
}

export class BlockNode extends AstNode {
	constructor(blockType) {
		super("block");
		this.blockType = blockType;
	}
	* eval(ctx) {
		return new ScriptValue("block", [this.blockType]);
	}
}
export class PhaseNode extends AstNode {
	constructor(playerNode, phaseIndicator) {
		super("phase");
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
		super("turn");
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
	constructor() {
		super("block");
	}
	* eval(ctx) {
		let type = ctx.game.currentBlock()?.type;
		return new ScriptValue("block", type? [type] : []);
	}
}
export class CurrentPhaseNode extends AstNode {
	constructor() {
		super("phase");
	}
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
	constructor() {
		super("turn");
	}
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
		super({
			"cast": "card",
			"chosenTarget": "card",
			"declared": "card",
			"deployed": "card",
			"destroyed": "card",
			"discarded": "card",
			"exiled": "card",
			"moved": "card",
			"retired": "card",
			"viewed": "card",
			"summoned": "card",
			"targeted": "card"
		}[accessor]);
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
		super("modifier");
		this.modifications = modifications;
	}
	* eval(ctx) {
		return new ScriptValue("modifier", new CardModifier(this.modifications, ctx));
	}
}

export class UntilIndicatorNode extends AstNode {
	constructor(until) {
		super("untilIndicator");
		this.until = until;
	}
	* eval(ctx) {
		return new ScriptValue("untilIndicator", this.until);
	}
}

// Functions must be initialized at the end so that all nodes are defined to be used as default values.
initFunctions();