// This module exports zone-related classes which define single zones as per the Cross Universe rules.

import {TriggerAbility} from "./abilities.js";

export class Zone {
	constructor(player, type) {
		this.player = player;
		this.type = type;
		this.cards = [];
	}

	// returns the index at which the card was inserted.
	add(card, index) {
		if (card.zone === this && card.index < index) {
			index--;
		}
		if (card.zone && card.zone.cards.includes(card)) {
			card.zone.remove(card);
		}
		if (!card.values.cardTypes.includes("token")) {
			this.cards.splice(index, 0, card);
			this.reindex();
		} else {
			index = -1;
		}
		card.zone = this;

		// remove this card from relevant actions
		if (card.inRetire) {
			card.inRetire.units.splice(card.inRetire.units.indexOf(card), 1);
			card.inRetire = null;
		}
		card.attackCount = 0;
		if (this.player.game.currentAttackDeclaration) {
			if (this.player.game.currentAttackDeclaration.target == card) {
				this.player.game.currentAttackDeclaration.target = null;
				card.isAttackTarget = false;
			}
			let attackerIndex = this.player.game.currentAttackDeclaration.attackers.indexOf(card);
			if (attackerIndex != -1) {
				this.player.game.currentAttackDeclaration.attackers.splice(attackerIndex, 1);
				card.isAttacking = false;
			}
		}
		// All of the card's trigger abilities aren't met anymore.
		for (let ability of card.values.abilities) {
			if (ability instanceof TriggerAbility) {
				ability.triggerMet = false;
			}
		}
		// Effects that applied to the card before stop applying.
		card.modifierStack = [];
		// Snapshots pointing to this card become invalid. (The card stops being tracked as that specific instance)
		card.invalidateSnapshots();
		return index;
	}

	remove(card) {
		this.cards.splice(card.index, 1);
		this.reindex();
		card.zone = null;
	}

	reindex() {
		for (let i = 0; i < this.cards.length; i++) {
			this.cards[i].index = i;
		}
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
		let randomValues = await this.player.game.randomInts(randomRanges);
		// Fisher-Yates shuffle
		for (let i = this.cards.length - 1; i > 0; i--) {
			// pick a random element and swap it with the current element
			let rand = randomValues.shift();
			[this.cards[i], this.cards[rand]] = [this.cards[rand], this.cards[i]];
		}
		this.reindex();
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
		if (card.zone && card.zone.cards.includes(card)) {
			card.zone.remove(card);
		}
		// If the card came from outside the field, it stops being tracked as itself.
		if (!(card.zone instanceof FieldZone)) {
			card.invalidateSnapshots();
		}
		this.cards[index] = card;
		card.zone = this;
		card.index = index;
		return index;
	}

	remove(card) {
		let index = this.cards.findIndex(localCard => localCard == card);
		this.cards[index] = null;
		card.zone = null;
	}

	reindex() {} // not needed

	// This puts a card into the temporary "not in hand, not on field" position that they go to during summoning / casting / deploying
	place(card, index) {
		if (this.get(index) == null) {
			card.zone?.remove(card);
			this.placed[index] = card;
		}
	}

	get(index) {
		return this.placed[index] ?? this.cards[index];
	}
}