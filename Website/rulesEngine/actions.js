import * as events from "./events.js";
import * as requests from "./inputRequests.js";
import * as zones from "./zones.js";
import {Timing} from "./timings.js";

// helper functions
function getAvailableZoneSlots(zone) {
	let slots = [];
	for (let i = 0; i < zone.cards.length; i++) {
		let slotCard = zone.get(i);
		if (slotCard === null) {
			slots.push(i);
		}
	}
	return slots;
}
function* queryZoneSlot(player, zone) {
	let zoneSlotRequest = new requests.chooseZoneSlot.create(player, zone, getAvailableZoneSlots(zone));
	let zoneSlotResponse = (yield [zoneSlotRequest])[0];
	return requests.chooseZoneSlot.validate(zoneSlotResponse.value, zoneSlotRequest);
}

// Base class for any action in the game.
export class Action {
	constructor() {
		this.timing = null; // Is set by the Timing itself
		this.costIndex = -1; // If this is positive, it indicates that this action is to be treated as a cost, together with other actions of the same costIndex
	}

	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	async* run() {}

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

	async* run() {
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

	async* run() {
		this.player.life += this.amount;
		if (this.player.life === 0) {
			this.player.next().won = true;
			this.player.next().victoryConditions.push("lifeZero");
		}
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

	async* run() {
		if (this.amount > this.player.deckZone.cards.length) {
			this.player.next().won = true;
			this.player.next().victoryConditions.push("drawFromEmptyDeck");
			return null;
		}
		let drawCardRefs = [];
		for (let i = 0; i < this.amount; i++) {
			let drawCard = this.player.deckZone.cards[this.player.deckZone.cards.length - 1];
			this.drawnCards.push(drawCard.snapshot());
			drawCardRefs.push(drawCard);
			this.player.handZone.add(drawCard, this.player.handZone.cards.length);
			drawCard.showTo(this.player)
		}
		for (let i = 0; i < drawCardRefs.length; i++) {
			this.drawnCards[i].cardRef = drawCardRefs[i];
			drawCardRefs[i].snapshots.push(this.drawnCards[i]);
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

	async* run() {
		this.targetIndex = yield* queryZoneSlot(this.player, this.zone);
		this.card = this.card.snapshot();
		this.card.cardRef.hiddenFor = [];
		let cardPlacedEvent = events.createCardPlacedEvent(this.player, this.card.zone, this.card.index, this.zone, this.targetIndex);
		this.zone.place(this.card.cardRef, this.targetIndex);
		return cardPlacedEvent;
	}

	undo() {
		this.zone.placed[this.targetIndex] = null;
		this.card.restore();
		return events.createUndoCardsMovedEvent([
			{fromZone: this.zone, fromIndex: this.targetIndex, toZone: this.card.zone, toIndex: this.card.index}
		]);
	}

	isImpossible(timing) {
		return getAvailableZoneSlots(this.zone).length < timing.actions.filter(action => action instanceof Place).length;
	}
}

export class Summon extends Action {
	constructor(player, placeAction) {
		super();
		this.player = player;
		this.placeAction = placeAction;
	}

	async* run() {
		let summonEvent = events.createCardSummonedEvent(this.player, this.placeAction.card.cardRef.zone, this.placeAction.card.cardRef.index, this.placeAction.zone, this.placeAction.targetIndex);
		let cardRef = this.placeAction.card.cardRef;
		this.placeAction.zone.add(this.placeAction.card.cardRef, this.placeAction.targetIndex);
		this.placeAction.card.cardRef = cardRef;
		cardRef.snapshots.push(this.placeAction.card);
		return summonEvent;
	}

	undo() {
		this.zone.remove(this.placeAction.card.cardRef, this.placeAction.targetIndex);
	}

	isImpossible(timing) {
		let slotCard = this.placeAction.zone.get(this.placeAction.targetIndex);
		return slotCard != null && slotCard != this.placeAction.card.cardRef;
	}
}

export class Deploy extends Action {
	constructor(player, placeAction) {
		super();
		this.player = player;
		this.placeAction = placeAction;
	}

	async* run() {
		let deployEvent = events.createCardDeployedEvent(this.player, this.placeAction.card.cardRef.zone, this.placeAction.card.cardRef.index, this.placeAction.zone, this.placeAction.targetIndex);
		let cardRef = this.placeAction.card.cardRef;
		this.placeAction.zone.add(this.placeAction.card.cardRef, this.placeAction.targetIndex);
		this.placeAction.card.cardRef = cardRef;
		cardRef.snapshots.push(this.placeAction.card);
		return deployEvent;
	}

	undo() {
		this.zone.remove(this.placeAction.card.cardRef, this.placeAction.targetIndex);
	}

	isImpossible(timing) {
		let slotCard = this.placeAction.zone.get(this.placeAction.targetIndex);
		return slotCard != null && slotCard != this.placeAction.card.cardRef;
	}
}

export class Cast extends Action {
	constructor(player, placeAction) {
		super();
		this.player = player;
		this.placeAction = placeAction;
	}

	async* run() {
		let castEvent = events.createCardCastEvent(this.player, this.placeAction.card.cardRef.zone, this.placeAction.card.cardRef.index, this.placeAction.zone, this.placeAction.targetIndex);
		let cardRef = this.placeAction.card.cardRef;
		this.placeAction.zone.add(this.placeAction.card.cardRef, this.placeAction.targetIndex);
		this.placeAction.card.cardRef = cardRef;
		cardRef.snapshots.push(this.placeAction.card);
		return castEvent;
	}

	undo() {
		this.zone.remove(this.placeAction.card.cardRef, this.placeAction.targetIndex);
	}

	isImpossible(timing) {
		let slotCard = this.placeAction.zone.get(this.placeAction.targetIndex);
		return slotCard != null && slotCard != this.placeAction.card.cardRef;
	}
}

export class Move extends Action {
	constructor(player, card, zone, targetIndex) {
		super();
		this.player = player;
		this.card = card;
		this.zone = zone;
		this.targetIndex = targetIndex;
		this.insertedIndex = null;
	}

	async* run() {
		if (this.targetIndex === null) {
			if (this.zone instanceof zones.DeckZone) {
				this.insertedIndex = this.zone.cards.length;
			} else {
				this.insertedIndex = yield* queryZoneSlot(this.player, this.zone);
			}
		} else if (this.targetIndex === -1) {
			this.insertedIndex = this.zone.cards.length;
		}
		let cardRef = this.card;
		this.card = this.card.snapshot();
		let cardMovedEvent = events.createCardMovedEvent(this.player, this.card.zone, this.card.index, this.zone, this.insertedIndex, this.card);
		this.zone.add(this.card.cardRef, this.insertedIndex);
		this.card.cardRef = cardRef;
		cardRef.snapshots.push(this.card);
		return cardMovedEvent;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.cardRef.zone, fromIndex: this.card.cardRef.index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.zone instanceof zones.FieldZone && getAvailableZoneSlots(this.zone).length < timing.actions.filter(action => action instanceof Move).length) {
			return true;
		}
		if (this.card.zone?.type == "partner") {
			return true;
		}
		return false;
	}
}

export class EstablishAttackDeclaration extends Action {
	constructor(player, attackers) {
		super();
		this.player = player;
		this.attackers = attackers;
		this.attackTarget = null;
	}

	async* run() {
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

	async* run() {
		this.oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life - this.amount, 0);
		if (this.player.life == 0) {
			this.player.next().won = true;
			this.player.next().victoryConditions.push("lifeZero");
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

	async* run() {
		let cardRef = this.card;
		this.card = this.card.snapshot();
		let event = events.createCardDiscardedEvent(this.card.zone, this.card.index, this.card.owner.discardPile, this.card);
		this.card.owner.discardPile.add(this.card.cardRef, this.card.owner.discardPile.cards.length);
		this.card.cardRef = cardRef;
		cardRef.snapshots.push(this.card);
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
	constructor(discard) {
		super();
		this.discard = discard;
	}

	async* run() {
		// destroying a card doesn't do anything.
		// Only the accompanying discard actually does something
	}

	isImpossible(timing) {
		if (this.discard.card.zone?.type == "partner") {
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

	async* run() {
		let cardRef = this.card;
		this.card = this.card.snapshot();
		let event = events.createCardExiledEvent(this.card.zone, this.card.index, this.card.owner.exileZone, this.card);
		this.card.owner.exileZone.add(this.card.cardRef, this.card.owner.exileZone.cards.length);
		this.card.cardRef = cardRef;
		cardRef.snapshots.push(this.card);
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

export class ApplyCardStatChange extends Action {
	constructor(card, modifier, until) {
		super();
		this.card = card;
		this.modifier = modifier;
		this.until = until;
	}

	async* run() {
		this.card = this.card.snapshot();
		this.card.cardRef.modifierStack.push(this.modifier);
		if (this.until == "forever") {
			return;
		}
		let removalTiming = new Timing(this.card.owner.game, [new RemoveCardStatChange(this.card.cardRef, this.modifier)], null);
		switch (this.until) {
			case "endOfTurn": {
				this.card.owner.game.currentTurn().endOfTurnTimings.push(removalTiming);
				break;
			}
			case "endOfNextTurn": {
				this.card.owner.game.endOfUpcomingTurnTimings[0].push(removalTiming);
				break;
			}
			case "endOfYourNextTurn": {
				let currentlyYourTurn = this.card.owner.game.currentTurn().player == this.modifier.card.zone.player;
				this.card.owner.game.endOfUpcomingTurnTimings[currentlyYourTurn? 1 : 0].push(removalTiming);
				break;
			}
			case "endOfOpponentNextTurn": {
				let currentlyOpponentTurn = this.card.owner.game.currentTurn().player != this.modifier.card.zone.player;
				this.card.owner.game.endOfUpcomingTurnTimings[currentlyOpponentTurn? 1 : 0].push(removalTiming);
				break;
			}
		}
	}

	undo() {
		this.card.cardRef.modifierStack.pop();
	}

	isImpossible(timing) {
		return !(this.card.zone instanceof zones.FieldZone) || this.modifier.modifications.length == 0;
	}
}

export class RemoveCardStatChange extends Action {
	constructor(card, modifier) {
		super();
		this.card = card;
		this.modifier = modifier;
		this.index = -1;
	}

	async* run() {
		this.card = this.card.snapshot();
		this.index = this.card.cardRef.modifierStack.indexOf(this.modifier);
		if (this.index != -1) {
			this.card.cardRef.modifierStack.splice(this.index, 1);
		}
	}

	undo() {
		this.card.cardRef.modifierStack.splice(this.index, 0, this.modifier);
	}
}

export class CancelAttack extends Action {
	constructor() {
		super();
		this.wasCancelled = null;
	}

	async* run() {
		if (this.timing.game.currentAttackDeclaration) {
			this.wasCancelled = this.timing.game.currentAttackDeclaration.isCancelled;
			this.timing.game.currentAttackDeclaration.isCancelled = true;
		}
	}

	undo() {
		if (this.timing.game.currentAttackDeclaration) {
			this.timing.game.currentAttackDeclaration.isCancelled = this.wasCancelled;
		}
	}
}

export class SetAttackTarget extends Action {
	constructor(newTarget) {
		super();
		this.newTarget = newTarget;
		this.oldTarget = null;
	}

	async* run() {
		if (this.timing.game.currentAttackDeclaration) {
			this.oldTarget = this.timing.game.currentAttackDeclaration.target;
			if (this.newTarget.zone instanceof zones.FieldZone) {
				this.timing.game.currentAttackDeclaration.target = this.newTarget;
			} else {
				this.timing.game.currentAttackDeclaration.target = null;
			}
		}
	}

	undo() {
		if (this.timing.game.currentAttackDeclaration) {
			this.timing.game.currentAttackDeclaration.target = this.oldTarget;
		}
	}
}

export class SelectEquipableUnit extends Action {
	constructor(spellItem, player) {
		super();
		this.spellItem = spellItem;
		this.player = player;
		this.chosenUnit = null;
	}

	async* run() {
		let selectionRequest = new requests.chooseCards.create(this.player, this.spellItem.equipableTo.evalFull(this.spellItem, this.player, null)[0], [1], "equipTarget:" + this.spellItem.cardId);
		let responses = yield [selectionRequest];
		if (responses.length != 1) {
			throw new Error("Incorrect number of responses supplied when selecting unit to equip to. (expected 1, got " + responses.length + " instead)");
		}
		if (responses[0].type != "chooseCards") {
			throw new Error("Incorrect response type supplied when selecting unit to equip to. (expected \"chooseCards\", got \"" + responses[0].type + "\" instead)");
		}
		this.chosenUnit = requests.chooseCards.validate(responses[0].value, selectionRequest)[0];
	}

	isImpossible(timing) {
		return this.spellItem.equipableTo.evalFull(this.spellItem, this.player, null)[0].length == 0;
	}
}

export class EquipCard extends Action {
	constructor(equipment, target, player) {
		super();
		this.equipment = equipment;
		this.target = target;
		this.player = player;
	}

	async* run() {
		this.equipment = this.equipment.snapshot();
		this.target = this.target.snapshot();
		let event = events.createCardEquippedEvent(this.equipment, this.target);
		this.equipment.cardRef.equippedTo = this.target.cardRef;
		this.target.cardRef.equipments.push(this.equipment.cardRef);
		return event;
	}

	undo() {
		this.target.cardRef.equipments.pop();
		this.equipment.equippedTo = null;
	}

	isImpossible(timing) {
		return !this.equipment.equipableTo.evalFull(this.spellItem, this.player, null)[0].includes(this.target);
	}
}

export class Shuffle extends Action {
	constructor(player) {
		super();
		this.player = player;
	}

	async* run() {
		await this.player.deckZone.shuffle();
		return events.createDeckShuffledEvent(this.player);
	}

	undo() {
		this.player.deckZone.undoShuffle();
	}
}

export class View extends Action {
	constructor(card, player) {
		super();
		this.card = card;
		this.player = player;
	}

	async* run() {
		let wasHidden = this.card.hiddenFor.includes(this.player);
		this.card.showTo(this.player);
		this.card = this.card.snapshot();
		if (wasHidden) {
			this.card.cardRef.hideFrom(this.player);
		}
		return events.createCardViewedEvent(this.player, this.card);
	}
}

export class Reveal extends Action {
	constructor(card) {
		super();
		this.card = card;
		this.oldHiddenState = null;
	}

	async* run() {
		this.oldHiddenState = this.card.hiddenFor;
		this.card.hiddenFor = [];
		this.card = this.card.snapshot();
		return events.createCardRevealedEvent(this.card);
	}

	undo() {
		this.card.cardRef.hiddenFor = this.oldHiddenState;
	}

	isImpossible(timing) {
		return this.card.hiddenFor.length == 0;
	}
}