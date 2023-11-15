// This module exports zone-related classes which define single zones as per the Cross Universe rules.

import * as abilities from "./abilities.js";

export class Zone {
	constructor(player, type) {
		this.player = player;
		this.type = type;
		this.cards = [];
	}

	// returns the index at which the card was inserted.
	add(card, index, clearValues = true) {
		if (card.zone === this && card.index < index) {
			index--;
		}
		if (card.zone && card.zone.cards.includes(card)) {
			card.zone.remove(card);
		}
		if (card.placedTo) {
			card.placedTo.placed[card.index] = null;
			card.placedTo = null;
		}
		if (!card.isToken) {
			this.cards.splice(index, 0, card);
			this.reindex();
		} else {
			index = -1;
			card.isRemovedToken = true;
		}
		card.zone = this;

		if (clearValues) {
			// remove this card from relevant actions
			if (card.inRetire) {
				card.inRetire.units.splice(card.inRetire.units.indexOf(card), 1);
				card.inRetire = null;
			}
			if (card.isAttacking || card.isAttackTarget) {
				this.player.game.currentAttackDeclaration?.removeCard(card);
			}
			card.attackCount = 0; // reset AFTER removing card from the attack since removing it increases the attackCount
			card.canAttackAgain = false;
			for (const ability of card.values.abilities) {
				// All of the card's trigger abilities aren't met anymore.
				if (ability instanceof abilities.TriggerAbility) {
					ability.triggerMetOnStack = -1;
				} else if (ability instanceof abilities.StaticAbility) {
					// static abilities need to update their zone enter timer
					ability.zoneEnterTimingIndex = card.owner.game.nextTimingIndex - 1;
				}
			}
			// Effects that applied to the card before stop applying.
			card.modifierStack = [];
			// equipments get unequipped
			if (card.equippedTo) {
				card.equippedTo.equipments.splice(card.equippedTo.equipments.indexOf(card), 1);
				card.equippedTo = null;
			}
			for (const equipment of card.equipments) {
				equipment.equippedTo = null;
			}
			card.equipments = [];
			// Snapshots pointing to this card become invalid. (The card stops being tracked as that specific instance)
			card.invalidateSnapshots();
		}
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

	getFreeSpaceCount() {
		return Infinity;
	}
}

export class HandZone extends Zone {
	constructor(player) {
		super(player, "hand");
	}

	add(card, index, clearValues = true) {
		let insertedIndex = super.add(card, index, clearValues);
		for (const player of game.players) {
			if (player === this.player) {
				card.showTo(player);
			} else {
				card.hideFrom(player);
			}
		}
		return insertedIndex;
	}
}

export class DeckZone extends Zone {
	constructor(player) {
		super(player, "deck");
	}

	add(card, index, clearValues = true) {
		let insertedIndex = super.add(card, index, clearValues);
		card.hiddenFor = [...card.owner.game.players];
		return insertedIndex;
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

	undoShuffle() {
		let randomValues = this.player.game.undoRandom();
		// reverse Fisher-Yates shuffle
		for (let i = 1; i < this.cards.length; i++) {
			// pick a random element and swap it with the current element
			let rand = randomValues.pop();
			[this.cards[i], this.cards[rand]] = [this.cards[rand], this.cards[i]];
		}
		this.reindex();
	}
}

export class PileZone extends Zone {
	constructor(player, type) {
		super(player, type);
	}

	add(card, index, clearValues = true) {
		let insertedIndex = super.add(card, index, clearValues);
		card.hiddenFor = [];
		return insertedIndex;
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
	add(card, index, clearValues = true) {
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
		if (card.placedTo) {
			card.placedTo.placed[card.index] = null;
			card.placedTo = null;
		}
		if (clearValues) {
			// If the card came from outside the field, it stops being tracked as itself.
			if (!(card.zone instanceof FieldZone)) {
				card.invalidateSnapshots();

				// static abilities need to update their zone enter timer
				for (const ability of card.values.abilities) {
					if (ability instanceof abilities.StaticAbility) {
						ability.zoneEnterTimingIndex = card.owner.game.nextTimingIndex - 1;
					}
				}
			}
		}
		this.cards[index] = card;
		card.zone = this;

		card.index = index;
		card.hiddenFor = [];
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
			card.placedTo = this;
			card.index = index;
		}
	}

	get(index) {
		return this.placed[index] ?? this.cards[index];
	}

	getFreeSpaceCount() {
		let count = 0;
		for (let i = 0; i < this.cards.length; i++) {
			if (this.get(i) === null) {
				count++;
			}
		}
		return count;
	}
}