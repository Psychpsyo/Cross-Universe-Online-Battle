import * as events from "./events.js";
import * as requests from "./inputRequests.js";

// Base class for any action in the game.
class Action {
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

export class SummonAction extends Action {
	constructor(player, unit, unitZoneIndex) {
		super();
		this.player = player;
		this.unit = unit;
		this.unitZoneIndex = unitZoneIndex;
	}
	
	* run() {
		let summonEvent = events.createCardSummonedEvent(this.player, this.unit.location, this.unit.location?.cards.indexOf(this.unit), this.unitZoneIndex);
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
		let targetSelectRequest = new requests.selectAttackTarget.create(this.player, eligibleUnits);
		let responses = (yield [targetSelectRequest]).filter(choice => choice !== undefined);
		if (responses.length != 1) {
			throw new Error("Incorrect number of responses supplied during attack target selection. (expected 1, got " + responses.length + " instead)");
		}
		if (responses[0].type != "selectAttackTarget") {
			throw new Error("Incorrect response type supplied during attack target selection. (expected \"selectAttackTarget\", got \"" + responses[0].type + "\" instead)");
		}
		this.attackTarget = requests.selectAttackTarget.validate(responses[0].value, targetSelectRequest);
		
		// finish
		for (let attacker of this.attackers) {
			attacker.attackCount++;
		}
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
		this.attackTarget = this.attackTarget.snapshot();
		return events.createAttackDeclarationEstablishedEvent(this.player, this.attackTarget.location, this.attackTarget.location.cards.indexOf(this.attackTarget));
	}
}

export class DiscardAction extends Action {
	constructor(card) {
		super();
		this.card = card;
	}
	
	* run() {
		this.card = this.card.snapshot();
		let event = events.createCardDiscardedEvent(this.card.location, this.card.location.cards.indexOf(this.card.cardRef), this.card.owner.discardPile);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.cardRef.hidden = false;
		if (this.timing?.block.type == "retire") {
			this.timing.block.stack.phase.turn.hasRetired.push(this.card);
		}
		return event;
	}
	
	isImpossible() {
		if (this.card.location.type == "partner") {
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
		let event = events.createCardDestroyedEvent(this.card.location, this.card.location.cards.indexOf(this.card.cardRef), this.card.owner.discardPile);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.hidden = false;
		return event;
	}
	
	isImpossible() {
		if (this.card.location.type == "partner") {
			return true;
		}
		return false;
	}
}