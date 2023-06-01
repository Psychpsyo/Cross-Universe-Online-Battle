// This module exports zone-related classes which define single zones as per the Cross Universe rules.

export class Zone {
	constructor(name, size, player, allowTokens) {
		this.name = name;
		this.size = size; // A size of -1 means a dynamically sized zone such as the deck, hand or discard pile
		this.allowTokens = allowTokens;
		this.player = player;
		this.cards = [];
		for (let i = 0; i < this.size; i++) {
			this.cards.push(null);
		}
		player.game.zones[name] = this;
	}
	
	// returns the index at which the card was inserted.
	add(card, index) {
		if (this.size > -1 && this.cards[index] !== null) {
			return this.cards[index] === card? index : -1;
		}
		if (this.size == -1 && card.location === this && this.cards.indexOf(card) < index) {
			index--;
		}
		card.location?.remove(card);
		if (this.allowTokens || !card.cardTypes.get().includes("token")) {
			if (this.size == -1) {
				this.cards.splice(index, 0, card);
			} else {
				this.cards[index] = card;
			}
		} else {
			index = -1;
		}
		card.location = this;
		return index;
	}
	
	remove(card) {
		let index = this.cards.findIndex(localCard => localCard == card);
		if (this.size == -1) {
			this.cards.splice(index, 1);
		} else {
			this.cards[index] = null;
		}
	}
	
	getLocalizedName() {
		return locale.cardSelector[this.name];
	}
	
	shuffle() {
		// Fisher-Yates shuffle
		for (let i = this.cards.length - 1; i >= 0; i--) {
			// pick a random element and swap it with the current element
			let rand = this.player.game.rng.nextInt(i);
			
			[this.cards[i], this.cards[rand]] = [this.cards[rand], this.cards[i]];
		}
	}
}