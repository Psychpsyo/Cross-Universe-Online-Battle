// This module exports the Player class which holds all data relevant to one player in a game.

import {Card} from "/modules/card.js";
import {Zone} from "/modules/zone.js";

export class Player {
	constructor(game) {
		this.game = game;
		this.index = game.players.length;
		this.deck = null;
		this.mana = 0;
		this.life = 1000;
		
		this.nextCustomCardId = this.index + 1;
		
		this.deckZone = new Zone("deck" + this.index, -1, this, false);
		this.handZone = new Zone("hand" + this.index, -1, this, false);
		this.unitZone = new Zone("unit" + this.index, 5, this, true);
		this.spellItemZone = new Zone("spellItem" + this.index, 4, this, true);
		this.partnerZone = new Zone("partner" + this.index, 1, this, true);
		this.discardPile = new Zone("discard" + this.index, -1, this, false);
		this.exileZone = new Zone("exile" + this.index, -1, this, false);
		this.presentedZone = new Zone("presented" + this.index, -1, this, false);
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
				card.location = this.deckZone;
			}
		}
		this.deck = deck;
	}
}