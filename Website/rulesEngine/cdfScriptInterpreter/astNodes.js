// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as requests from "../inputRequests.js";
import {Card} from "../card.js";

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
			yield* step.eval(card, player);
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
			case "DAMAGE": {
				yield [new actions.DealDamage(await (yield* this.parameters[1].eval(card, player)), await (yield* this.parameters[0].eval(card, player)))];
				return;
			}
			case "DESTROY": {
				yield (await (yield* this.parameters[0].eval(card, player))).map(card => new actions.Destroy(card));
				return;
			}
			case "DISCARD": {
				yield (await (yield* this.parameters[0].eval(card, player))).map(card => new actions.Discard(card));
				return;
			}
			case "DRAW": {
				yield [new actions.Draw(player, await (yield* this.parameters[0].eval(card, player)))];
				return;
			}
			case "EXILE": {
				yield (await (yield* this.parameters[0].eval(card, player))).map(card => new actions.Exile(card));
				return;
			}
			case "LIFE": {
				yield [new actions.ChangeLife(player, await (yield* this.parameters[0].eval(card, player)))];
			}
			case "MANA": {
				yield [new actions.ChangeMana(player, await (yield* this.parameters[0].eval(card, player)))];
				return;
			}
			case "SELECT": {
				let responseCounts = [await (yield* this.parameters[0].eval(card, player))];
				let eligibleCards = await (yield* this.parameters[1].eval(card, player));
				let selectionRequest = new requests.chooseCards.create(player, eligibleCards, responseCounts, "cardEffect");
				let responses = yield [selectionRequest];
				if (responses.length != 1) {
					throw new Error("Incorrect number of responses supplied during card selection. (expected " + responseCounts + ", got " + responses.length + " instead)");
				}
				if (responses[0].type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + responses[0].type + "\" instead)");
				}
				return requests.chooseCards.validate(responses[0].value, selectionRequest);
			}
			case "SUMMON": {
				let cards = await (yield* this.parameters[0].eval(card, player));
				let zone = (await (yield* this.parameters[1].eval(card, player)))[0];
				let payCost = await (yield* this.parameters[2].eval(card, player));

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
				let timing = yield costs;
				let summons = [];
				for (let i = 0; i < timing.costCompletions.length; i++) {
					if (timing.costCompletions[i]) {
						summons.push(new actions.Summon(player, cards[i], zone, targetSlots[i]));
					}
				}
				yield summons;
				return;
			}
			case "TOKENS": {
				let amount = await (yield* this.parameters[0].eval(card, player));
				let name = await (yield* this.parameters[2].eval(card, player));
				let level = await (yield* this.parameters[3].eval(card, player));
				let types = await (yield* this.parameters[4].eval(card, player));
				let attack = await (yield* this.parameters[5].eval(card, player));
				let defense = await (yield* this.parameters[6].eval(card, player));
				let cards = [];
				for (let i = 0; i < amount; i++) {
					let cardId = await (yield* this.parameters[1].eval(card, player));
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

export class BoolNode extends AstNode {
	constructor(value) {
		super();
		this.value = value == "yes";
	}
	async* eval(card, player) {
		return this.value;
	}
}

export class CardIdNode extends AstNode {
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

export class TypesNode extends AstNode {
	constructor(value) {
		super();
		this.value = value;
	}
	async* eval(card, player) {
		return this.value;
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