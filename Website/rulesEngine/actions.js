import * as events from "./events.js";

// Base class for any action in the game.
class Action {
	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	run() {}
}

export class ChangeManaAction extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
	}
	
	run() {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}
}

export class DrawAction extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
		this.drawnCards = [];
	}
	
	run() {
		for (let i = 0; i < this.amount; i++) {
			let drawCard = this.player.deckZone.cards[this.player.deckZone.cards.length - 1];
			this.player.handZone.add(drawCard, this.player.handZone.cards.length);
			if (this.player.isViewable) {
				drawCard.hidden = false;
			}
			this.cards.push(drawCard.snapshot());
		}
		return events.createCardsDrawnEvent(this.player, this.amount);
	}
}

export class DiscardAction extends Action {
	constructor(card) {
		super();
		this.card = card;
	}
	
	run() {
		let event = events.createCardDiscardedEvent(this.card.location, this.card.location.cards.indexOf(this.card), card.owner.discardPile);
		this.card.owner.discardPile.add(this.card, this.card.owner.discardPile.cards.length);
		this.card = this.card.snapshot();
		return event;
	}
}

export class DestroyAction extends Action {
	constructor(card) {
		super();
		this.card = card;
	}
	
	run() {
		let event = events.createCardDestroyedEvent(this.card.location, this.card.location.cards.indexOf(this.card), card.owner.discardPile);
		this.card.owner.discardPile.add(this.card, this.card.owner.discardPile.cards.length);
		this.card = this.card.snapshot();
		return event;
	}
}