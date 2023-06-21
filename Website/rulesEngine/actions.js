import * as events from "./events.js";
import * as requests from "./inputRequests.js";

// Base class for any action in the game.
export class Action {
	constructor() {
		this.timing = null; // Is set by the Timing itself
		this.costIndex = -1; // If this is positive, it indicates that this action is to be treated as a cost, together with other actions of the same costIndex
	}

	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	* run() {}

	undo() {}

	isImpossible(timing) {
		return false;
	}
	isPossible(timing) {
		return !this.isImpossible(timing);
	}
	isFullyPossible(timing) {
		return this.isPossible(timing);
	}
}

export class ChangeMana extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
	}

	* run() {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}

	undo() {
		this.player.mana -= this.amount;
		return events.createManaChangedEvent(this.player);
	}

	isImpossible(timing) {
		return this.player.mana == 0 && this.amount < 0;
	}
	isFullyPossible(timing) {
		return this.player.mana + this.amount >= 0;
	}
}

export class ChangeLife extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
	}

	* run() {
		this.player.life += this.amount;
		return events.createLifeChangedEvent(this.player);
	}

	undo() {
		this.player.life -= this.amount;
		return events.createLifeChangedEvent(this.player);
	}

	isFullyPossible(timing) {
		return this.player.life + this.amount >= 0;
	}
}

export class Draw extends Action {
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

	undo() {
		let movedCards = [];
		for (let i = this.drawnCards.length - 1; i >= 0; i++) {
			let card = this.drawnCards[i];
			movedCards.push({fromZone: card.cardRef.zone, fromIndex: card.cardRef.index, toZone: card.zone, toIndex: card.index});
			card.restore();
		}
		return events.createUndoCardsMovedEvent(movedCards);
	}
}

// places a card on the field without moving it there yet.
export class Place extends Action {
	constructor(player, card, zone) {
		super();
		this.player = player;
		this.card = card;
		this.zone = zone;
		this.targetIndex = null;
	}

	* run() {
		let zoneSlotRequest = new requests.chooseZoneSlot.create(this.player, this.zone, this.getAvailableZoneSlots());
		let zoneSlotResponse = (yield [zoneSlotRequest])[0];
		this.targetIndex = requests.chooseZoneSlot.validate(zoneSlotResponse.value, zoneSlotRequest);

		this.card.hidden = false;
		let cardPlacedEvent = events.createCardPlacedEvent(this.player, this.card.zone, this.card.index, this.zone, this.targetIndex);
		this.card = this.card.snapshot();
		this.zone.place(this.card.cardRef, this.targetIndex);
		return cardPlacedEvent;
	}

	undo() {
		this.zone.placed[index] = null;
		this.card.restore();
	}

	isImpossible(timing) {
		return this.getAvailableZoneSlots().length < timing.actions.filter(action => action instanceof Place).length;
	}

	getAvailableZoneSlots() {
		let slots = [];
		for (let i = 0; i < this.zone.cards.length; i++) {
			let slotCard = this.zone.get(i);
			if (slotCard === null || slotCard === this.card) {
				slots.push(i);
			}
		}
		return slots;
	}
}

export class Summon extends Action {
	constructor(player, unit, zone, zoneIndex) {
		super();
		this.player = player;
		this.unit = unit;
		this.zone = zone;
		this.zoneIndex = zoneIndex;
	}

	* run() {
		let summonEvent = events.createCardSummonedEvent(this.player, this.unit.zone, this.unit.index, this.zone, this.zoneIndex);
		this.zone.add(this.unit, this.zoneIndex);
		this.unit = this.unit.snapshot();
		return summonEvent;
	}

	undo() {
		this.zone.remove(this.unit.cardRef, this.zoneIndex);
	}

	isImpossible(timing) {
		let slotCard = this.zone.get(this.zoneIndex);
		return slotCard != null && slotCard != this.unit;
	}
}

export class Deploy extends Action {
	constructor(player, item, zone, zoneIndex) {
		super();
		this.player = player;
		this.item = item;
		this.zone = zone;
		this.zoneIndex = zoneIndex;
	}

	* run() {
		let deployEvent = events.createCardDeployedEvent(this.player, this.item.zone, this.item.index, this.zone, this.zoneIndex);
		this.zone.add(this.item, this.zoneIndex);
		this.item = this.item.snapshot();
		return deployEvent;
	}

	undo() {
		this.zone.remove(this.item.cardRef, this.zoneIndex);
	}

	isImpossible(timing) {
		let slotCard = this.zone.get(this.zoneIndex);
		return slotCard != null && slotCard != this.item;
	}
}

export class Cast extends Action {
	constructor(player, spell, zone, zoneIndex) {
		super();
		this.player = player;
		this.spell = spell;
		this.zone = zone;
		this.zoneIndex = zoneIndex;
	}

	* run() {
		let castEvent = events.createCardCastEvent(this.player, this.spell.zone, this.spell.index, this.zone, this.zoneIndex);
		this.zone.add(this.spell, this.zoneIndex);
		this.spell = this.spell.snapshot();
		return castEvent;
	}

	undo() {
		this.zone.remove(this.spell.cardRef, this.zoneIndex);
	}

	isImpossible(timing) {
		let slotCard = this.zone.get(this.zoneIndex);
		return slotCard != null && slotCard != this.spell;
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
		let responses = (yield [targetSelectRequest]);
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

	undo() {
		// This actually does not do anything noteworthy. Huh.
	}
}

export class DealDamage extends Action {
	constructor(player, amount) {
		super();
		this.player = player;
		this.amount = amount;
		this.oldAmount = null;
	}

	* run() {
		this.oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life - this.amount, 0);
		if (this.player.life == 0) {
			this.player.lost = true;
			this.player.loseReason = "lifeZero";
		}
		return events.createDamageDealtEvent(this.player, this.amount);
	}

	undo() {
		this.player.life = this.oldAmount;
		return events.createLifeChangedEvent(this.player);
	}
}

export class Discard extends Action {
	constructor(card) {
		super();
		this.card = card;
	}

	* run() {
		this.card = this.card.snapshot();
		let event = events.createCardDiscardedEvent(this.card.zone, this.card.index, this.card.owner.discardPile, this.card);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.cardRef.hidden = false;
		if (this.timing.block?.type == "retire") {
			this.timing.block.stack.phase.turn.hasRetired.push(this.card);
		}
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.cardRef.zone, fromIndex: this.card.cardRef.index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.card.zone?.type == "partner") {
			return true;
		}
		return false;
	}
}

export class Destroy extends Action {
	constructor(card) {
		super();
		this.card = card;
	}

	* run() {
		this.card = this.card.snapshot();
		let event = events.createCardDestroyedEvent(this.card.zone, this.card.index, this.card.owner.discardPile, this.card);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.hidden = false;
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.cardRef.zone, fromIndex: this.card.cardRef.index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.card.zone?.type == "partner") {
			return true;
		}
		return false;
	}
}

export class Exile extends Action {
	constructor(card) {
		super();
		this.card = card;
	}

	* run() {
		this.card = this.card.snapshot();
		let event = events.createCardExiledEvent(this.card.zone, this.card.index, this.card.owner.exileZone, this.card);
		this.card.owner.exileZone.add(this.card.cardRef, this.card.owner.exileZone.cards.length);
		this.card.cardRef.hidden = false;
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.cardRef.zone, fromIndex: this.card.cardRef.index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.card.zone.type == "partner") {
			return true;
		}
		return false;
	}
}