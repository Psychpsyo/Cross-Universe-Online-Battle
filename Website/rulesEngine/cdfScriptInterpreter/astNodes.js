// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import {Card} from "../card.js";

class AstNode {
	async* eval(card, player, ability) {}
	// whether or not all actions in this tree can be done in full
	async* hasAllTargets(card, player, ability) {
		return true;
	}
}

// This serves as the root node of a card's script body
export class ScriptNode extends AstNode {
	constructor(steps) {
		super();
		this.steps = steps;
	}
	async* eval(card, player, ability) {
		for (let step of this.steps) {
			yield* step.eval(card, player, ability);
		}
	}
	async* hasAllTargets(card, player, ability) {
		for (let step of this.steps) {
			if (!(await (yield* step.hasAllTargets(card, player, ability)))) {
				return false;
			}
		}
		return true;
	}
}

export class LineNode extends AstNode {
	constructor(parts) {
		super();
		this.parts = parts;
	}
	async* eval(card, player, ability) {
		let allActions = [];
		for (let part of this.parts) {
			if (part instanceof AssignmentNode) {
				yield* part.eval(card, player, ability);
			} else if (part instanceof FunctionNode) {
				allActions = allActions.concat(await (yield* part.eval(card, player, ability)))
			}
		}
		if (allActions.length > 0) {
			yield allActions;
		}
	}
	async* hasAllTargets(card, player, ability) {
		for (let part of this.parts) {
			if (!(await (yield* part.hasAllTargets(card, player, ability)))) {
				return false;
			}
		}
		return true;
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
		player = await (yield* this.player.eval(card, player, ability));
		switch (this.functionName) {
			case "COUNT": {
				let list = await (yield* this.parameters[0].eval(card, player, ability));
				return list.length;
			}
			case "DAMAGE": {
				return [new actions.DealDamage(await (yield* this.parameters[1].eval(card, player, ability)), await (yield* this.parameters[0].eval(card, player, ability)))];
			}
			case "DECKTOP": {
				return player.deckZone.cards.slice(Math.max(0, player.deckZone.cards.length - await (yield* this.parameters[0].eval(card, player, ability))), player.deckZone.cards.length);
			}
			case "DESTROY": {
				return (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.Destroy(card));
			}
			case "DISCARD": {
				return (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.Discard(card));
			}
			case "DRAW": {
				let amount = await (yield* this.parameters[0].eval(card, player, ability));
				if (this.asManyAsPossible) {
					amount = Math.min(amount, player.deckZone.cards.length);
				}
				return [new actions.Draw(player, amount)];
			}
			case "EXILE": {
				yield (await (yield* this.parameters[0].eval(card, player, ability))).map(card => new actions.Exile(card));
				return;
			}
			case "LIFE": {
				return [new actions.ChangeLife(player, await (yield* this.parameters[0].eval(card, player, ability)))];
			}
			case "MANA": {
				return [new actions.ChangeMana(player, await (yield* this.parameters[0].eval(card, player, ability)))];
			}
			case "SELECT": {
				let responseCounts = [await (yield* this.parameters[0].eval(card, player, ability))];
				let eligibleCards = await (yield* this.parameters[1].eval(card, player, ability));
				if (eligibleCards.length == 0) {
					return [];
				}
				let selectionRequest = new requests.chooseCards.create(player, eligibleCards, responseCounts, "cardEffect:" + ability.id);
				let responses = yield [selectionRequest];
				if (responses.length != 1) {
					throw new Error("Incorrect number of responses supplied during card selection. (expected " + responseCounts + ", got " + responses.length + " instead)");
				}
				if (responses[0].type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + responses[0].type + "\" instead)");
				}
				return requests.chooseCards.validate(responses[0].value, selectionRequest);
			}
			case "SELECTPLAYER": {
				let selectionRequest = new requests.choosePlayer.create(player, "cardEffect:" + ability.id);
				let responses = yield [selectionRequest];
				if (responses.length != 1) {
					throw new Error("Incorrect number of responses supplied during player selection. (expected " + responseCounts + ", got " + responses.length + " instead)");
				}
				if (responses[0].type != "choosePlayer") {
					throw new Error("Incorrect response type supplied during player selection. (expected \"choosePlayer\", got \"" + responses[0].type + "\" instead)");
				}
				return requests.choosePlayer.validate(responses[0].value, selectionRequest);
			}
			case "SUMMON": {
				let cards = await (yield* this.parameters[0].eval(card, player, ability));
				let zone = (await (yield* this.parameters[1].eval(card, player, ability)))[0];
				let payCost = await (yield* this.parameters[2].eval(card, player, ability));

				let costs = [];
				let targetSlots = [];
				// TODO: Let the player choose the order these are summoned in.
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
					let zoneSlotRequest = new requests.chooseZoneSlot.create(player, zone, availableZoneSlots);
					let zoneSlotResponse = (yield [zoneSlotRequest])[0];
					targetSlots[i] = requests.chooseZoneSlot.validate(zoneSlotResponse.value, zoneSlotRequest);
					let placeCost = new actions.Place(player, cards[i], zone, targetSlots[i]);
					placeCost.costIndex = i;
					costs.push(placeCost);

					if (payCost) {
						let manaCost = new actions.ChangeMana(player, -cards[i].level.get());
						manaCost.costIndex = i;
						costs.push(manaCost);
					}
				}
				for (card of cards) {
					card.zone?.remove(card);
				}
				let timing = yield costs;
				let summons = [];
				for (let i = 0; i < timing.costCompletions.length; i++) {
					if (timing.costCompletions[i]) {
						summons.push(new actions.Summon(player, cards[i], zone, targetSlots[i]));
					} else {
						cards[i].zone?.add(cards[i], cards[i].index);
					}
				}
				return  summons;
			}
			case "TOKENS": {
				let amount = await (yield* this.parameters[0].eval(card, player, ability));
				let name = await (yield* this.parameters[2].eval(card, player, ability));
				let level = await (yield* this.parameters[3].eval(card, player, ability));
				let types = await (yield* this.parameters[4].eval(card, player, ability));
				let attack = await (yield* this.parameters[5].eval(card, player, ability));
				let defense = await (yield* this.parameters[6].eval(card, player, ability));
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
		switch (this.functionName) {
			case "COUNT": {
				return yield* this.parameters[0].hasAllTargets(card, player, ability);
			}
			case "DAMAGE": {
				return player.life + (await (yield* this.parameters[0].eval(card, player, ability))) >= 0;
			}
			case "DECKTOP": {
				if (this.asManyAsPossible) {
					return player.deckZone.cards.length > 0;
				}
				return player.deckZone.cards.length >= await (yield* this.parameters[0].eval(card, player, ability));
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
			case "LIFE": {
				return player.life + (await (yield* this.parameters[0].eval(card, player, ability))) >= 0;
			}
			case "MANA": {
				return player.mana + (await (yield* this.parameters[0].eval(card, player, ability))) >= 0;
			}
			case "SELECT": {
				return Math.min(...[await (yield* this.parameters[0].eval(card, player, ability))]) <= ((await (yield* this.parameters[1].eval(card, player, ability))).length);
			}
			case "SELECTPLAYER": {
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
}

export class AssignmentNode extends AstNode {
	constructor(variable, newValue) {
		super();
		this.variable = variable;
		this.newValue = newValue;
	}
	async* eval(card, player, ability) {
		ability.scriptVariables[this.variable] = await (yield* this.newValue.eval(card, player, ability));
	}
	async* hasAllTargets(card, player, ability) {
		return yield* this.newValue.hasAllTargets(card, player, ability);
	}
}

export class CardMatchNode extends AstNode {
	// TODO: implement card attribute matching
	constructor(cardTypes, zoneNodes) {
		super();
		this.cardTypes = cardTypes;
		this.zoneNodes = zoneNodes;
	}
	async* eval(card, player, ability) {
		let cards = [];
		let zones = [];
		for (let zoneNode of this.zoneNodes) {
			zones.push(...(await (yield* zoneNode.eval(card, player, ability))));
		}
		for (let zone of zones) {
			for (let checkCard of zone.cards) {
				if (checkCard == null) {
					continue;
				}
				for (let cardType of this.cardTypes) {
					if (cardType == "card" || checkCard.cardTypes.get().includes(cardType)) {
						cards.push(checkCard);
						continue;
					}
				}
			}
		}
		return cards;
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

export class ThisCardNode extends AstNode {
	async* eval(card, player, ability) {
		return card;
	}
}

export class MathNode extends AstNode {
	constructor(leftSide, rightSide) {
		super();
		this.leftSide = leftSide;
		this.rightSide = rightSide;
	}
}
export class DashMathNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
}
export class DotMathNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
}
export class PlusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return (await (yield* this.leftSide.eval())) + (await (yield* this.rightSide.eval()));
	}
}
export class MinusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return (await (yield* this.leftSide.eval())) - (await (yield* this.rightSide.eval()));
	}
}
export class MultiplyNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return (await (yield* this.leftSide.eval())) * (await (yield* this.rightSide.eval()));
	}
}
export class CeilDivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return Math.ceil((await (yield* this.leftSide.eval())) / (await (yield* this.rightSide.eval())));
	}
}
export class FloorDivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	async* eval(card, player, ability) {
		return Math.floor((await (yield* this.leftSide.eval())) / (await (yield* this.rightSide.eval())));
	}
}

export class IntNode extends AstNode {
	constructor(value) {
		super();
		this.value = value;
	}
	async* eval(card, player, ability) {
		return this.value;
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

export class CardIDsNode extends AstNode {
	constructor(value) {
		super();
		this.value = value;
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
		return this.playerKeyword == "you"? player : player.next();
	}
}

export class TypesNode extends AstNode {
	constructor(value) {
		super();
		this.value = value;
	}
	async* eval(card, player, ability) {
		return this.value;
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier) {
		super();
		this.zoneIdentifier = zoneIdentifier;
	}
	async* eval(card, player, ability) {
		let opponent = player.next();
		return ({
			field: [player.unitZone, player.spellItemZone, player.partnerZone, player.next().unitZone, player.next().spellItemZone, player.next().partnerZone],
			deck: [player.deckZone, opponent.deckZone],
			discard: [player.discardPile, opponent.discardPile],
			exile: [player.exileZone, opponent.exileZone],
			hand: [player.handZone, opponent.handZone],
			unitZone: [player.unitZone, opponent.unitZone],
			spellItemZone: [player.spellItemZone, opponent.spellItemZone],
			partnerZone: [player.partnerZone, opponent.partnerZone],
			yourField: [player.unitZone, player.spellItemZone, player.partnerZone],
			yourDeck: [player.deckZone],
			yourDiscard: [player.discardPile],
			yourExile: [player.exileZone],
			yourHand: [player.handZone],
			yourUnitZone: [player.unitZone],
			yourSpellItemZone: [player.spellItemZone],
			yourPartnerZone: [player.partnerZone],
			opponentField: [opponent.unitZone, opponent.spellItemZone, opponent.partnerZone],
			opponentDeck: [opponent.deckZone],
			opponentDiscard: [opponent.discardPile],
			opponentExile: [opponent.exileZone],
			opponentHand: [opponent.handZone],
			opponentUnitZone: [opponent.unitZone],
			opponentSpellItemZone: [opponent.spellItemZone],
			opponentPartnerZone: [opponent.partnerZone]
		})[this.zoneIdentifier];
	}
}