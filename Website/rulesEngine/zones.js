// This module exports zone-related classes which define single zones as per the Cross Universe rules.

import * as blocks from "./blocks.js";

export class Zone {
	constructor(player, type) {
		this.player = player;
		this.type = type;
		this.cards = [];
	}
	
	// returns the index at which the card was inserted.
	add(card, index) {
		if (card.location === this && this.cards.indexOf(card) < index) {
			index--;
		}
		card.location?.remove(card);
		if (!card.cardTypes.get().includes("token")) {
			this.cards.splice(index, 0, card);
		} else {
			index = -1;
		}
		card.location = this;
		// remove this card from relevant actions
		let stacks = this.player.game.getStacks();
		if (stacks.length > 0) {
			if (stacks[stacks.length - 1].blocks[0] instanceof blocks.Retire) {
				let retire = stacks[stacks.length - 1].blocks[0];
				if (retire.units.includes(card)) {
					retire.units.splice(retire.units.indexOf(card), 1);
				}
			}
		}
		return index;
	}
	
	remove(card) {
		let index = this.cards.findIndex(localCard => localCard == card);
		this.cards.splice(index, 1);
	}
	
	get(index) {
		return this.cards[index];
	}
}

export class DeckZone extends Zone {
	constructor(player) {
		super(player, "deck");
	}
	
	async shuffle() {
		let randomRanges = [];
		for (let i = this.cards.length - 1; i > 0; i--) {
			randomRanges.push(i);
		}
		let randomValues = await this.player.game.rng.nextInts(randomRanges);
		// Fisher-Yates shuffle
		for (let i = this.cards.length - 1; i > 0; i--) {
			// pick a random element and swap it with the current element
			let rand = randomValues.shift();
			[this.cards[i], this.cards[rand]] = [this.cards[rand], this.cards[i]];
		}
	}
}

export class FieldZone extends Zone {
	constructor(player, type, size) {
		super(player, type);
		this.size = size;
		this.placed = [];
		for (let i = 0; i < this.size; i++) {
			this.cards.push(null);
			this.placed.push(null);
		}
	}
	
	// returns the index at which the card was inserted.
	add(card, index) {
		if (this.cards[index] !== null) {
			return this.cards[index] === card? index : -1;
		}
		if (this.placed[index] !== null) {
			if (this.placed[index] == card) {
				this.placed[index] = null;
			} else {
				return -1;
			}
		}
		card.location?.remove(card);
		this.cards[index] = card;
		card.location = this;
		return index;
	}
	
	remove(card) {
		let index = this.cards.findIndex(localCard => localCard == card);
		this.cards[index] = null;
	}
	
	// This puts a card into the temporary "not in hand, not on field" position that they go to during standard summons / casting / deploying
	place(card, index) {
		if (this.get(index) == null) {
			this.placed[index] = card;
		}
		card.location?.remove(card);
		card.location = null;
	}
	
	get(index) {
		return this.placed[index] ?? this.cards[index];
	}
}