import * as ast from "./cdfScriptInterpreter/astNodes.js";
import * as events from "./events.js";
import * as requests from "./inputRequests.js";
import * as zones from "./zones.js";
import {ScriptContext} from "./cdfScriptInterpreter/structs.js";
import {SnapshotCard} from "./card.js";
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
	let zoneSlotResponse = yield [zoneSlotRequest];
	return requests.chooseZoneSlot.validate(zoneSlotResponse.value, zoneSlotRequest);
}

// Base class for any action in the game.
export class Action {
	constructor(player) {
		this.player = player;
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
		super(player);
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
		super(player);
		this.amount = amount;
		this.oldAmount = null;
	}

	async* run() {
		this.oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life + this.amount, 0);
		if (this.player.life === 0) {
			this.player.next().victoryConditions.push("lifeZero");
		}
		return events.createLifeChangedEvent(this.player);
	}

	undo() {
		if (this.player.life === 0) {
			this.player.next().victoryConditions.pop();
		}
		this.player.life = this.oldAmount;
		return events.createLifeChangedEvent(this.player);
	}

	isFullyPossible(timing) {
		return this.player.life + this.amount >= 0;
	}
}

export class Draw extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this.drawnCards = [];
	}

	async* run() {
		if (this.amount > this.player.deckZone.cards.length) {
			this.player.next().victoryConditions.push("drawFromEmptyDeck");
			return null;
		}
		let drawnCards = [];
		for (let i = 0; i < this.amount; i++) {
			let drawnCard = this.player.deckZone.cards[this.player.deckZone.cards.length - 1];
			this.drawnCards.push(new SnapshotCard(drawnCard));
			drawnCards.push(drawnCard);
			this.player.handZone.add(drawnCard, this.player.handZone.cards.length);
			drawnCard.showTo(this.player);
		}
		for (let i = 0; i < drawnCards.length; i++) {
			this.drawnCards[i].globalId = drawnCards[i].globalId;
		}
		return events.createCardsDrawnEvent(this.player, this.drawnCards);
	}

	undo() {
		if (this.drawnCards.length > 0) {
			let movedCards = [];
			for (let i = this.drawnCards.length - 1; i >= 0; i--) {
				let card = this.drawnCards[i];
				movedCards.push({fromZone: card.current().zone, fromIndex: card.current().index, toZone: card.zone, toIndex: card.index});
				card.restore();
			}
			return events.createUndoCardsMovedEvent(movedCards);
		}
		if (this.amount > this.player.deckZone.cards.length) {
			this.player.next().victoryConditions.pop();
		}
	}
}

// places a card on the field without moving it there yet.
export class Place extends Action {
	constructor(player, card, zone) {
		super(player);
		this.card = card;
		this.zone = zone;
		this.targetIndex = null;
	}

	async* run() {
		this.targetIndex = yield* queryZoneSlot(this.player, this.zone);
		this.card = new SnapshotCard(this.card);
		this.card.current().hiddenFor = [];
		let cardPlacedEvent = events.createCardPlacedEvent(this.player, this.card.zone, this.card.index, this.zone, this.targetIndex);
		this.zone.place(this.card.current(), this.targetIndex);
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
		super(player);
		this.placeAction = placeAction;
	}

	async* run() {
		let card = this.placeAction.card.current();
		let summonEvent = events.createCardSummonedEvent(this.player, this.placeAction.card, card.zone, card.index, this.placeAction.zone, this.placeAction.targetIndex);
		this.placeAction.zone.add(card, this.placeAction.targetIndex);
		this.placeAction.card.globalId = card.globalId;
		return summonEvent;
	}

	undo() {
		this.zone.remove(this.placeAction.card.current(), this.placeAction.targetIndex);
	}

	isImpossible(timing) {
		let slotCard = this.placeAction.zone.get(this.placeAction.targetIndex);
		return slotCard != null && slotCard != this.placeAction.card.current();
	}
}

export class Deploy extends Action {
	constructor(player, placeAction) {
		super(player);
		this.placeAction = placeAction;
	}

	async* run() {
		let card = this.placeAction.card.current() ?? this.placeAction.card;
		let deployEvent = events.createCardDeployedEvent(this.player, this.placeAction.card, card.zone, card.index, this.placeAction.zone, this.placeAction.targetIndex);
		if (this.placeAction.card.current()) {
			this.placeAction.zone.add(card, this.placeAction.targetIndex);
			this.placeAction.card.globalId = card.globalId;
		}
		return deployEvent;
	}

	undo() {
		this.zone.remove(this.placeAction.card.current(), this.placeAction.targetIndex);
	}

	isImpossible(timing) {
		let slotCard = this.placeAction.zone.get(this.placeAction.targetIndex);
		return slotCard != null && slotCard != this.placeAction.card.current();
	}
}

export class Cast extends Action {
	constructor(player, placeAction) {
		super(player);
		this.placeAction = placeAction;
	}

	async* run() {
		let card = this.placeAction.card.current() ?? this.placeAction.card;
		let castEvent = events.createCardCastEvent(this.player, this.placeAction.card, card.zone, card.index, this.placeAction.zone, this.placeAction.targetIndex);
		if (this.placeAction.card.current()) {
			this.placeAction.zone.add(card, this.placeAction.targetIndex);
			this.placeAction.card.globalId = card.globalId;
		}
		return castEvent;
	}

	undo() {
		this.zone.remove(this.placeAction.card.current(), this.placeAction.targetIndex);
	}

	isImpossible(timing) {
		let slotCard = this.placeAction.zone.get(this.placeAction.targetIndex);
		return slotCard != null && slotCard != this.placeAction.card.current();
	}
}

export class Move extends Action {
	constructor(player, card, zone, targetIndex) {
		super(player);
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
		let card = this.card;
		this.card = new SnapshotCard(this.card);
		this.zone.add(this.card.current(), this.insertedIndex);
		this.card.globalId = card.globalId;
		return events.createCardMovedEvent(this.player, this.card.zone, this.card.index, this.zone, this.insertedIndex, this.card);
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.current().zone, fromIndex: this.card.current().index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.card.isRemovedToken ||
			this.card.zone?.type == "partner" ||
			(this.zone instanceof zones.FieldZone && getAvailableZoneSlots(this.zone).length < timing.actions.filter(action => action instanceof Move).length)
		) {
			return true;
		}
		return false;
	}
}

export class Swap extends Action {
	constructor(player, cardA, cardB, transferEquipments) {
		super(player);
		this.cardA = cardA;
		this.cardB = cardB;
		this.transferEquipments = transferEquipments;
	}

	async* run() {
		let cardA = this.cardA;
		let cardB = this.cardB;
		this.cardA = new SnapshotCard(this.cardA);
		this.cardB = new SnapshotCard(this.cardB);

		this.cardA.zone.remove(cardA);
		this.cardB.zone.remove(cardB);
		this.cardA.zone.add(cardB, this.cardA.index);
		this.cardB.zone.add(cardA, this.cardB.index);

		this.cardA.globalId = cardA.globalId;
		this.cardB.globalId = cardB.globalId;

		if (this.transferEquipments) {
			if (cardA.zone instanceof zones.FieldZone) {
				for (const equipment of this.cardB.equipments) {
					cardA.equipments.push(equipment.current());
					equipment.current().equippedTo = cardA;
				}
			}
			if (cardB.zone instanceof zones.FieldZone) {
				for (const equipment of this.cardA.equipments) {
					cardB.equipments.push(equipment.current());
					equipment.current().equippedTo = cardB;
				}
			}
		}

		return events.createCardsSwappedEvent(this.player, this.cardA, this.cardB, this.transferEquipments);
	}

	undo() {
		let event = events.createUndoCardsSwappedEvent(this.cardA, this.cardB);

		this.cardA.current().zone.remove(this.cardA.current());
		this.cardB.current().zone.remove(this.cardB.current());
		this.cardA.restore();
		this.cardB.restone();

		return event;
	}

	isImpossible(timing) {
		if ((this.cardA.isToken && !(this.cardB.zone instanceof FieldZone)) ||
			(this.cardB.isToken && !(this.cardA.zone instanceof FieldZone)) ||
			this.cardA.isRemovedToken ||
			this.cardB.isRemovedToken
		) {
			return true;
		}
		return false;
	}
}

export class EstablishAttackDeclaration extends Action {
	constructor(player, attackers) {
		super(player);
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
		let response = yield [targetSelectRequest];
		if (response.type != "chooseCards") {
			throw new Error("Incorrect response type supplied during attack target selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
		}
		this.attackTarget = requests.chooseCards.validate(response.value, targetSelectRequest)[0];

		// handle remaining attack rights
		this.attackers = this.attackers.map(attacker => new SnapshotCard(attacker));
		this.attackTarget = new SnapshotCard(this.attackTarget);

		return events.createAttackDeclarationEstablishedEvent(this.player, this.attackTarget, this.attackers);
	}
}

export class DealDamage extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this.oldAmount = null;
	}

	async* run() {
		this.oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life - this.amount, 0);
		if (this.player.life == 0) {
			this.player.next().victoryConditions.push("lifeZero");
		}
		return events.createDamageDealtEvent(this.player, this.amount);
	}

	undo() {
		if (this.player.life === 0) {
			this.player.next().victoryConditions.pop();
		}
		this.player.life = this.oldAmount;
		return events.createLifeChangedEvent(this.player);
	}
}

export class Discard extends Action {
	constructor(player, card, isRetire = false) {
		super(player);
		this.card = card;
		this.isRetire = isRetire;
	}

	async* run() {
		let card = this.card;
		this.card = new SnapshotCard(this.card);
		let event = events.createCardDiscardedEvent(this.card.zone, this.card.index, this.card.owner.discardPile, this.card);
		this.card.owner.discardPile.add(this.card.current(), this.card.owner.discardPile.cards.length);
		this.card.globalId = card.globalId;
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.current().zone, fromIndex: this.card.current().index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.card.zone?.type === "partner") {
			return true;
		}
		return false;
	}
}

export class Destroy extends Action {
	constructor(discard) {
		super(discard.player);
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
	constructor(player, card) {
		super(player);
		this.card = card;
	}

	async* run() {
		let card = this.card;
		this.card = new SnapshotCard(this.card);
		let event = events.createCardExiledEvent(this.card.zone, this.card.index, this.card.owner.exileZone, this.card);
		this.card.owner.exileZone.add(this.card.current(), this.card.owner.exileZone.cards.length);
		this.card.globalId = card.globalId;
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.current().zone, fromIndex: this.card.current().index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible(timing) {
		if (this.card.zone?.type === "partner") {
			return true;
		}
		return false;
	}
}

export class ApplyCardStatChange extends Action {
	constructor(player, card, modifier, until) {
		super(player);
		this.card = card;
		this.modifier = modifier;
		this.until = until;
	}

	async* run() {
		// remove invalid modifications
		ast.setImplicitCard(this.modifier.card);
		for (let i = this.modifier.modifications.length - 1; i >= 0; i--) {
			if (!this.modifier.modifications[i].canApplyTo(this.card, this.modifier.card, this.modifier.player, this.modifier.ability)) {
				this.modifier.modifications.splice(i, 1);
			}
		}
		ast.clearImplicitCard();

		this.card = new SnapshotCard(this.card);
		this.card.current().modifierStack.push(this.modifier);
		if (this.until == "forever") {
			return;
		}
		let removalTiming = new Timing(this.card.owner.game, [new RemoveCardStatChange(this.player, this.card.current(), this.modifier)]);
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
				let currentlyYourTurn = this.card.owner.game.currentTurn().player == this.modifier.card.currentOwner();
				this.card.owner.game.endOfUpcomingTurnTimings[currentlyYourTurn? 1 : 0].push(removalTiming);
				break;
			}
			case "endOfOpponentNextTurn": {
				let currentlyOpponentTurn = this.card.owner.game.currentTurn().player != this.modifier.card.currentOwner();
				this.card.owner.game.endOfUpcomingTurnTimings[currentlyOpponentTurn? 1 : 0].push(removalTiming);
				break;
			}
		}
	}

	undo() {
		this.card.current().modifierStack.pop();
	}

	isImpossible(timing) {
		// cannot apply stat-changes to cards that are not on the field
		if (!(this.card.zone instanceof zones.FieldZone)) {
			return true;
		}
		// check un-appliable stat-changes
		let validModifications = 0;
		ast.setImplicitCard(this.modifier.card);
		for (const modification of this.modifier.modifications) {
			if (!modification.canApplyTo(this.card, this.modifier.card, this.modifier.player, this.modifier.ability)) {
				continue;
			}
			validModifications++;
		}
		ast.clearImplicitCard();
		return validModifications === 0;
	}
}

export class RemoveCardStatChange extends Action {
	constructor(player, card, modifier) {
		super(player);
		this.card = card;
		this.modifier = modifier;
		this.index = -1;
	}

	async* run() {
		this.card = new SnapshotCard(this.card);
		this.index = this.card.current().modifierStack.indexOf(this.modifier);
		if (this.index != -1) {
			this.card.current().modifierStack.splice(this.index, 1);
		}
	}

	undo() {
		this.card.current().modifierStack.splice(this.index, 0, this.modifier);
	}
}

export class CancelAttack extends Action {
	constructor(player) {
		super(player);
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
	constructor(player, newTarget) {
		super(player);
		this.newTarget = newTarget;
		this.oldTarget = null;
	}

	async* run() {
		if (this.timing.game.currentAttackDeclaration) {
			this.oldTarget = this.timing.game.currentAttackDeclaration.target;
			this.timing.game.currentAttackDeclaration.target = this.newTarget;
		}
	}

	undo() {
		if (this.timing.game.currentAttackDeclaration) {
			this.timing.game.currentAttackDeclaration.target = this.oldTarget;
		}
	}

	isImpossible(timing) {
		return !(this.newTarget.values.cardTypes.includes("unit") && this.newTarget.zone instanceof zones.FieldZone);
	}
}

export class GiveAttack extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
		this.oldCanAttackAgain = null;
	}

	async* run() {
		this.oldCanAttackAgain = this.card.canAttackAgain;
		this.card.canAttackAgain = true;
	}

	undo() {
		this.card.canAttackAgain = this.oldCanAttackAgain;
	}

	isImpossible(timing) {
		if (this.card.isRemovedToken) return true;
		return !this.card.values.cardTypes.includes("unit");
	}
}

export class SelectEquipableUnit extends Action {
	constructor(player, spellItem) {
		super(player);
		this.spellItem = spellItem;
		this.chosenUnit = null;
	}

	async* run() {
		let selectionRequest = new requests.chooseCards.create(this.player, this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player))[0].get(this.player), [1], "equipTarget:" + this.spellItem.cardId);
		let response = yield [selectionRequest];
		if (response.type != "chooseCards") {
			throw new Error("Incorrect response type supplied when selecting unit to equip to. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
		}
		this.chosenUnit = requests.chooseCards.validate(response.value, selectionRequest)[0];
	}

	isImpossible(timing) {
		return this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player))[0].get(this.player).length == 0;
	}
}

export class EquipCard extends Action {
	constructor(player, equipment, target) {
		super(player);
		this.equipment = equipment;
		this.target = target;
	}

	async* run() {
		this.equipment = new SnapshotCard(this.equipment);
		this.target = new SnapshotCard(this.target);
		let event = events.createCardEquippedEvent(this.equipment, this.target);
		this.equipment.current().equippedTo = this.target.current();
		this.target.current().equipments.push(this.equipment.current());
		return event;
	}

	undo() {
		this.target.current().equipments.pop();
		this.equipment.equippedTo = null;
	}

	isImpossible(timing) {
		return !this.equipment.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player))[0].get(this.player).includes(this.target);
	}
}

export class Shuffle extends Action {
	constructor(player) {
		super(player);
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
	constructor(player, card) {
		super(player);
		this.card = card;
	}

	async* run() {
		let wasHidden = this.card.hiddenFor.includes(this.player);
		this.card.showTo(this.player);
		this.card = new SnapshotCard(this.card);
		if (wasHidden) {
			this.card.current().hideFrom(this.player);
		}
		return events.createCardViewedEvent(this.player, this.card);
	}

	isImpossible(timing) {
		return this.card.isRemovedToken;
	}
}

export class Reveal extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
		this.oldHiddenState = null;
	}

	async* run() {
		this.oldHiddenState = this.card.hiddenFor;
		this.card.hiddenFor = [];
		this.card = new SnapshotCard(this.card);
		return events.createCardRevealedEvent(this.player, this.card);
	}

	undo() {
		this.card.current().hiddenFor = this.oldHiddenState;
	}

	isImpossible(timing) {
		if (this.card.isRemovedToken) return true;
		return this.card.hiddenFor.length == 0;
	}
}

export class ChangeCounters extends Action {
	constructor(player, card, type, amount) {
		super(player);
		this.card = card;
		this.type = type;
		this.amount = amount;
		this.oldAmount = null;
	}

	async* run() {
		this.card = new SnapshotCard(this.card);
		let card = this.card.current();
		if (!card.counters[this.type]) {
			card.counters[this.type] = 0;
		}
		this.oldAmount = card.counters[this.type];
		card.counters[this.type] += this.amount;
		return events.createCountersChangedEvent(this.card, this.type);
	}

	undo() {
		this.card.current().counters[this.type] = this.oldAmount;
	}

	isImpossible(timing) {
		if (this.card.isRemovedToken) return true;
		return (this.card.counters[this.type] ?? 0) == 0 && this.amount < 0;
	}
	isFullyPossible(timing) {
		if (this.card.isRemovedToken) return false;
		return (this.card.counters[this.type] ?? 0) + this.amount >= 0;
	}
}

export class ApplyStaticAbility extends Action {
	constructor(player, card, modifier) {
		super(player);
		this.card = card;
		this.modifier = modifier;
	}

	async* run() {
		this.card = new SnapshotCard(this.card);
		this.card.current().modifierStack.push(this.modifier);
	}

	undo() {
		this.card.restore();
	}
}

export class UnapplyStaticAbility extends Action {
	constructor(player, card, ability) {
		super(player);
		this.card = card;
		this.ability = ability;
	}

	async* run() {
		this.card = new SnapshotCard(this.card);
		let modifierIndex = this.card.current().modifierStack.findIndex(modifier => modifier.ability === this.ability);
		this.card.current().modifierStack.splice(modifierIndex, 1);
	}

	undo() {
		this.card.restore();
	}
}