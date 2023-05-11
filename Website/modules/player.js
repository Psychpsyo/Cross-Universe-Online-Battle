// This module exports the Player class which holds all data relevant to one player in a game.
// TODO: migrate missing data from global variables into this file.
import {Card} from "/modules/card.js";
import {Zone} from "/modules/zone.js";

export class Player {
	constructor(game) {
		this.game = game;
		this.index = game.players.length;
		this.deck = null;
		this.mana = 0;
		this.life = 1000;
		
		this.nextCardId = this.index + 1;
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
				let card = await new Card(this.game, cardId);
				// TODO: The deck card area will at some point be merged into this class and IDs for cards will be phased out.
				card.id = this.nextCardId;
				this.nextCardId += this.game.players.length;
				cardAreas["deck" + this.index].cards.push(card);
				card.location = cardAreas["deck" + this.index];
				allCards.push(card);
			}
		}
		cardAreas["deck" + this.index].updateVisual();
		this.deck = deck;
	}
}