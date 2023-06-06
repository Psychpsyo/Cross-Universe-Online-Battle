// This module exports the Player class which holds all data relevant to one player in a game.

import {Card} from "./card.js";
import {Zone, FieldZone, DeckZone} from "./zones.js";

export class Player {
	constructor(game) {
		this.game = game;
		this.index = game.players.length;
		this.deck = null;
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
		this.nextCustomCardId = this.index + 1;
	}
	
	async setDeck(deck) {
		// asynchronously load all missing card data up-front
		await Promise.all(deck.cards.filter(card => !card.id.startsWith("C") && !this.game.cardData[card.id]).map(card => {
			return this.game.registerCard(card.id);
		}));
		
		for (const card of deck.cards) {
			let cardId = card.id;
			if (card.id.startsWith("C")) {
				cardId = await this.game.registerCustomCard(deck.customs[parseInt(card.id.substr(1)) - 1], this);
				if (deck.suggestedPartner == card.id) {
					deck.suggestedPartner = cardId;
				}
			}
			
			for (let i = 0; i < card.amount; i++) {
				let card = await new Card(this, cardId, true);
				this.deckZone.add(card, this.deckZone.cards.length);
			}
		}
		this.deck = deck;
	}
	
	next() {
		return this.game.players[(this.index + 1) % this.game.players.length];
	}
}