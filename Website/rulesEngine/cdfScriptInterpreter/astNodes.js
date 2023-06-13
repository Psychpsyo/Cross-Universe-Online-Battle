// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";

class AstNode {
	async* eval(card, player) {}
	checkTargets() {}
}

// This serves as the root node of a card's script body
export class ScriptNode extends AstNode {
	constructor(steps) {
		super();
		this.steps = steps;
	}
	async* eval(card, player) {
		for (let step of this.steps) {
			yield await (yield* step.eval(card, player));
		}
	}
}

// Represents the language's built-in functions
export class FunctionNode extends AstNode {
	constructor(functionName, parameters) {
		super();
		this.functionName = functionName;
		this.parameters = parameters;
	}
	async* eval(card, player) {
		switch (this.functionName) {
			case "SELECT": {
				let responseCounts = [await (yield* this.parameters[0].eval(card, player))];
				let eligibleCards = await (yield* this.parameters[1].eval(card, player));
				let selectionRequest = new requests.chooseCards.create(player, eligibleCards, responseCounts, "cardEffect");
				let responses = (yield [selectionRequest]).filter(choice => choice !== undefined);
				if (responses.length != 1) {
					throw new Error("Incorrect number of responses supplied during card selection. (expected " + responseCounts + ", got " + responses.length + " instead)");
				}
				if (responses[0].type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + responses[0].type + "\" instead)");
				}
				return requests.chooseCards.validate(responses[0].value, selectionRequest);
			}
			case "DISCARD": {
				return (await (yield* this.parameters[0].eval(card, player))).map(card => new actions.Discard(card));
			}
			case "DESTROY": {
				return (await (yield* this.parameters[0].eval(card, player))).map(card => new actions.Destroy(card));
			}
			case "EXILE": {
				return (await (yield* this.parameters[0].eval(card, player))).map(card => new actions.Exile(card));
			}
			case "DRAW": {
				return [new actions.Draw(player, await (yield* this.parameters[0].eval(card, player)))];
			}
			case "DAMAGE": {
				return [new actions.DealDamage(await (yield* this.parameters[1].eval(card, player)), await (yield* this.parameters[0].eval(card, player)))];
			}
		}
	}
}

export class CardMatchNode extends AstNode {
	// TODO: implement card attribute matching
	constructor(cardTypes, zoneNodes) {
		super();
		this.cardTypes = cardTypes;
		this.zoneNodes = zoneNodes;
	}
	async* eval(card, player) {
		let cards = [];
		let zones = [];
		for (let zoneNode of this.zoneNodes) {
			zones.push(...(await (yield* zoneNode.eval(card, player))));
		}
		for (let zone of zones) {
			for (let checkCard of zone.cards) {
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

export class IntNode extends AstNode {
	constructor(value) {
		super();
		this.value = value;
	}
	async* eval(card, player) {
		return this.value;
	}
}

export class PlayerNode extends AstNode {
	constructor(playerKeyword) {
		super();
		this.playerKeyword = playerKeyword;
	}
	async* eval(card, player) {
		return this.playerKeyword == "you"? player : player.next();
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier) {
		super();
		this.zoneIdentifier = zoneIdentifier;
	}
	async* eval(card, player) {
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