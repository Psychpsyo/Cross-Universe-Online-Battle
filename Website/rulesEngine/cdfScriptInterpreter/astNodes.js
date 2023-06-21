// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import * as blocks from "../blocks.js";
import {Card} from "../card.js";

let currentImplicitCard = null;
let currentImplicitActions = null;

class AstNode {
	async* eval(card, player, ability) {}
	// whether or not all actions in this tree can be done in full
	async* hasAllTargets(card, player, ability) {
		for (let childNode of this.getChildNodes()) {
			if (!(await (yield* childNode.hasAllTargets(card, player, ability)))) {
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
		let currentPhase = player.game.currentPhase();
		if (currentPhase.currentStack().index < 2) {
			return false;
		}
		currentImplicitActions = currentPhase.stacks[currentPhase.stacks.length - 2].getActions();

		let returnValue = await (yield* this.expression.eval(card, player, ability));

		currentImplicitActions = null;
		return returnValue;
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
				yield (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.Exile(card.cardRef));
				return;
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
						let manaCost = new actions.ChangeMana(player, -cards[i].cardRef.level.get());
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
					let cardId = (await (yield* this.parameters[1].eval(card, player, ability)))[0];
					cards.push(new Card(player, `id: ${cardId}
cardType: token
name: ${name}
level: ${level}
types: ${types.join(",")}
attack: ${attack}
defense: ${defense}`, false));
				}
				return cards;
			}
		}
	}
	async* hasAllTargets(card, player, ability) {
		player = (await (yield* this.player.eval(card, player, ability)))[0];
		switch (this.functionName) {
			case "COUNT": {
				return true;
			}
			case "DAMAGE": {
				return true;
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				return player.deckZone.cards.length >= (await (yield* this.parameters[0].eval(card, player, ability)))[0];
			}
			case "DESTROY": {
				return yield* this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "DISCARD": {
				return yield* this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "DRAW": {
				return true;
			}
			case "EXILE": {
				return yield* this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "GAINLIFE": {
				return true;
			}
			case "GAINMANA": {
				return true;
			}
			case "LOSELIFE": {
				return player.life + (await (yield* this.parameters[0].eval(card, player, ability)))[0] >= 0;
			}
			case "LOSEMANA": {
				return player.mana + (await (yield* this.parameters[0].eval(card, player, ability)))[0] >= 0;
			}
			case "SELECT": {
				let availableAmount = (await (yield* this.parameters[1].eval(card, player, ability))).length;
				if (this.parameters[0] instanceof AnyAmountNode && availableAmount > 0) {
					return true;
				}
				let amountsRequired = await (yield* this.parameters[0].eval(card, player, ability));
				return Math.min(...amountsRequired) <= availableAmount && await (yield* this.parameters[0].hasAllTargets(card, player, ability));
			}
			case "SELECTPLAYER": {
				return true;
			}
			case "SUM": {
				return true;
			}
			case "SUMMON": {
				return yield* this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "TOKENS": {
				return true;
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
			if (cardList instanceof ZoneNode) {
				cards.push(...((await (yield* cardList.eval(card, player, ability))).map(zone => zone.cards).flat()));
			} else {
				cards.push(...(await (yield* cardList.eval(card, player, ability))));
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
	async* hasAllTargets(card, player, ability) {
		return (await (yield* this.eval(card, player, ability))).length > 0;
	}
	getChildNodes() {
		return this.zoneNodes.concat(this.conditions);
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
					return card.names.get();
				}
				case "baseName": {
					return card.names.getBase();
				}
				case "level": {
					return card.level.get();
				}
				case "baseLevel": {
					return card.level.getBase();
				}
				case "types": {
					return card.types.get();
				}
				case "baseTypes": {
					return card.types.getBase();
				}
				case "attack": {
					return card.attack.get();
				}
				case "baseAttack": {
					return card.attack.getBase();
				}
				case "defense": {
					return card.defense.get();
				}
				case "baseDefense": {
					return card.defense.getBase();
				}
				case "cardType": {
					return card.cardTypes.get();
				}
				case "baseCardType": {
					return card.cardTypes.getBase();
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
				switch (this.accessor) {
					case "discarded":
					case "destroyed":
					case "exiled": {
						values.push(action.card);
						break;
					}
					case "summoned": {
						values.push(action.unit);
						break;
					}
					case "cast": {
						values.push(action.spell);
						break;
					}
					case "deployed": {
						values.push(action.item);
						break;
					}
					case "targeted": {
						values.push(action.attackTarget);
						break;
					}
					case "declared": {
						for (let attacker of action.attackers) {
							values.push(attacker);
						}
						break;
					}
					case "retired": {
						if (action.timing.block instanceof blocks.Retire) {
							values.push(action.card);
						}
						break;
					}
				}
			}
		}
		return values;
	}
}