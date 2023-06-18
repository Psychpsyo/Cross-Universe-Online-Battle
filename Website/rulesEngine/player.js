// This module exports the Player class which holds all data relevant to one player in a game.

import {Card} from "./card.js";
import {Zone, FieldZone, DeckZone} from "./zones.js";

export class Player {
	constructor(game) {
		this.game = game;
		this.index = game.players.length;
		this.mana = 0;
		this.life = 1000;
		this.lost = false;
		this.loseReason = "";
		this.won = false;
		this.winReason = "";

		this.deckZone = new DeckZone(this);
		this.handZone = new Zone(this, "hand");
		this.unitZone = new FieldZone(this, "unit", 5);
		this.spellItemZone = new FieldZone(this, "spellItem", 4);
		this.partnerZone = new FieldZone(this, "partner", 1);
		this.discardPile = new Zone(this, "discard");
		this.exileZone = new Zone(this, "exile");

		this.isViewable = false; // determines whether or not this player's cards should be visible locally.
	}

	setDeck(cdfList) {
		for (let cdf of cdfList) {
			this.deckZone.add(new Card(this, cdf, true), this.deckZone.cards.length);
		}
	}

	getFieldCards() {
		let cards = [this.partnerZone.cards[0]];
		for (let card of this.unitZone.cards) {
			if (card) {
				cards.push(card);
			}
		}
		for (let card of this.spellItemZone.cards) {
			if (card) {
				cards.push(card);
			}
		}
		return cards;
	}

	next() {
		return this.game.players[(this.index + 1) % this.game.players.length];
	}
}