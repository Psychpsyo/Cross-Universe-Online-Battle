import * as events from "./events.js";
import * as requests from "./inputRequests.js";

// Base class for any action in the game.
export class Action {
	constructor() {
		this.timing = null; // Is set by the Timing itself
	}
	
	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	* run() {}
	
	isImpossible() {
		return false;
	}
	isPossible() {
		return !this.isImpossible();
	}
	isFullyPossible() {
		return this.isPossible();
	}
}

export class ChangeManaAction extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
	}
	
	* run() {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}
	
	isImpossible() {
		return this.player.mana == 0 && this.amount < 0;
	}
	isFullyPossible() {
		return this.player.mana + this.amount >= 0;
	}
}

export class DrawAction extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
		this.drawnCards = [];
	}
	
	* run() {
		if (this.amount > this.player.deckZone.cards.length) {
			this.player.lost = true;
			this.player.loseReason = "drawFromEmptyDeck";
			return null;
		}
		for (let i = 0; i < this.amount; i++) {
			let drawCard = this.player.deckZone.cards[this.player.deckZone.cards.length - 1];
			this.player.handZone.add(drawCard, this.player.handZone.cards.length);
			if (this.player.isViewable) {
				drawCard.hidden = false;
			}
			this.drawnCards.push(drawCard.snapshot());
		}
		return events.createCardsDrawnEvent(this.player, this.amount);
	}
}

// places a card on the field without moving it there yet.
export class PlaceAction extends Action {
	constructor(player, card, zone, index) {
		super();
		this.player = player;
		this.card = card;
		this.zone = zone;
		this.index = index;
	}
	
	* run() {
		this.card.hidden = false;
		let cardPlacedEvent = events.createCardPlacedEvent(this.player, this.card.zone, this.card.index, this.zone, this.index);
		this.zone.place(this.card, this.index);
		this.card = this.card.snapshot();
		return cardPlacedEvent;
	}
	
	isImpossible() {
		let slotCard = this.zone.get(this.index);
		return slotCard != null && slotCard != this.card;
	}
}

export class SummonAction extends Action {
	constructor(player, unit, unitZoneIndex) {
		super();
		this.player = player;
		this.unit = unit;
		this.unitZoneIndex = unitZoneIndex;
	}
	
	* run() {
		let summonEvent = events.createCardSummonedEvent(this.player, this.unit.zone, this.unit.index, this.unitZoneIndex);
		this.unit.hidden = false;
		this.player.unitZone.add(this.unit, this.unitZoneIndex);
		this.unit = this.unit.snapshot();
		return summonEvent;
	}
	
	isImpossible() {
		let slotCard = this.player.unitZone.get(this.unitZoneIndex);
		return slotCard != null && slotCard != this.unit;
	}
}

export class EstablishAttackDeclaration extends Action {
	constructor(player, attackers) {
		super();
		this.player = player;
		this.attackers = attackers;
		this.attackTarget = null;
	}
	
	* run() {
		// determine possible attack targets
		let eligibleUnits = this.player.next().partnerZone.cards.concat(this.player.next().unitZone.cards.filter(card => card !== null));
		if (eligibleUnits.length > 1) {
			eligibleUnits.shift();
		}
		
		// send selection request
		let targetSelectRequest = new requests.chooseCards.create(this.player, eligibleUnits, [1], "selectAttackTarget");
		let responses = (yield [targetSelectRequest]).filter(choice => choice !== undefined);
		if (responses.length != 1) {
			throw new Error("Incorrect number of responses supplied during attack target selection. (expected 1, got " + responses.length + " instead)");
		}
		if (responses[0].type != "chooseCards") {
			throw new Error("Incorrect response type supplied during attack target selection. (expected \"chooseCards\", got \"" + responses[0].type + "\" instead)");
		}
		this.attackTarget = requests.chooseCards.validate(responses[0].value, targetSelectRequest)[0];
		
		// finish
		for (let attacker of this.attackers) {
			attacker.attackCount++;
		}
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
		this.attackTarget = this.attackTarget.snapshot();
		return events.createAttackDeclarationEstablishedEvent(this.player, this.attackTarget.zone, this.attackTarget.index);
	}
}

export class DealDamageAction extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
	}
	
	* run() {
		this.player.life = Math.max(this.player.life - this.amount, 0);
		if (this.player.life == 0) {
			this.player.lost = true;
			this.player.loseReason = "lifeZero";
		}
		return events.createDamageDealtEvent(this.player, this.amount);
	}
}

export class DiscardAction extends Action {
	constructor(card) {
		super();
		this.card = card;
	}
	
	* run() {
		this.card = this.card.snapshot();
		let event = events.createCardDiscardedEvent(this.card.zone, this.card.index, this.card.owner.discardPile);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.cardRef.hidden = false;
		if (this.timing?.block.type == "retire") {
			this.timing.block.stack.phase.turn.hasRetired.push(this.card);
		}
		return event;
	}
	
	isImpossible() {
		if (this.card.zone.type == "partner") {
			return true;
		}
		return false;
	}
}

export class DestroyAction extends Action {
	constructor(card) {
		super();
		this.card = card;
	}
	
	* run() {
		this.card = this.card.snapshot();
		let event = events.createCardDestroyedEvent(this.card.zone, this.card.index, this.card.owner.discardPile);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.hidden = false;
		return event;
	}
	
	isImpossible() {
		if (this.card.zone.type == "partner") {
			return true;
		}
		return false;
	}
}