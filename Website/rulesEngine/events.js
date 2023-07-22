// event definitions to be passed out of the engine as they happen

export function createDeckShuffledEvent(player) {
	return {
		"nature": "event",
		"type": "deckShuffled",
		"player": player
	}
}

export function createStartingPlayerSelectedEvent(player) {
	return {
		"nature": "event",
		"type": "startingPlayerSelected",
		"player": player
	}
}

export function createPartnerRevealedEvent(player) {
	return {
		"nature": "event",
		"type": "partnerRevealed",
		"player": player
	}
}

export function createGameStartedEvent() {
	return {
		"nature": "event",
		"type": "gameStarted"
	}
}

export function createTurnStartedEvent() {
	return {
		"nature": "event",
		"type": "turnStarted"
	}
}

export function createPhaseStartedEvent(phase) {
	return {
		"nature": "event",
		"type": "phaseStarted",
		"phase": phase
	}
}

export function createStackCreatedEvent(stack) {
	return {
		"nature": "event",
		"type": "stackCreated",
		"stack": stack
	}
}

export function createStackStartedEvent(stack) {
	return {
		"nature": "event",
		"type": "stackStarted",
		"stack": stack
	}
}

export function createBlockCreatedEvent(block) {
	return {
		"nature": "event",
		"type": "blockCreated",
		"block": block
	}
}

export function createBlockCreationAbortedEvent(block) {
	return {
		"nature": "event",
		"type": "blockCreationAborted",
		"block": block
	}
}

export function createBlockStartedEvent(block) {
	return {
		"nature": "event",
		"type": "blockStarted",
		"block": block
	}
}

export function createActionCancelledEvent(action) {
	return {
		"nature": "event",
		"type": "actionCancelled",
		"action": action
	}
}

export function createPlayerWonEvent(player) {
	return {
		"nature": "event",
		"type": "playerWon",
		"player": player
	}
}

export function createPlayerLostEvent(player) {
	return {
		"nature": "event",
		"type": "playerLost",
		"player": player
	}
}

export function createGameDrawnEvent() {
	return {
		"nature": "event",
		"type": "gameDrawn"
	}
}

export function createDamageDealtEvent(player, amount) {
	return {
		"nature": "event",
		"type": "damageDealt",
		"player": player,
		"amount": amount
	}
}

export function createLifeChangedEvent(player) {
	return {
		"nature": "event",
		"type": "lifeChanged",
		"player": player
	}
}

export function createManaChangedEvent(player) {
	return {
		"nature": "event",
		"type": "manaChanged",
		"player": player
	}
}

export function createUndoCardsMovedEvent(movedCards) {
	return {
		"nature": "event",
		"type": "undoCardsMoved",
		"movedCards": movedCards
	}
}

export function createCardsDrawnEvent(player, amount) {
	return {
		"nature": "event",
		"type": "cardsDrawn",
		"player": player,
		"amount": amount
	}
}

export function createCardPlacedEvent(player, fromZone, fromIndex, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardPlaced",
		"player": player,
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardSummonedEvent(player, fromZone, fromIndex, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardSummoned",
		"player": player,
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardDeployedEvent(player, fromZone, fromIndex, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardDeployed",
		"player": player,
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardCastEvent(player, fromZone, fromIndex, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardCast",
		"player": player,
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardMovedEvent(player, fromZone, fromIndex, toZone, toIndex, card) {
	return {
		"nature": "event",
		"type": "cardMoved",
		"player": player,
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"toIndex": toIndex,
		"card": card
	}
}

export function createAttackDeclarationEstablishedEvent(player, targetZone, targetIndex) {
	return {
		"nature": "event",
		"type": "attackDeclarationEstablished",
		"player": player,
		"targetZone": targetZone,
		"targetIndex": targetIndex
	}
}

export function createCardsAttackedEvent(attackers, target) {
	return {
		"nature": "event",
		"type": "cardsAttacked",
		"attackers": attackers,
		"target": target
	}
}

export function createCardDiscardedEvent(fromZone, fromIndex, toZone, card) {
	return {
		"nature": "event",
		"type": "cardDiscarded",
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"card": card
	}
}

export function createCardDestroyedEvent(fromZone, fromIndex, toZone, card) {
	return {
		"nature": "event",
		"type": "cardDestroyed",
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"card": card
	}
}

export function createCardExiledEvent(fromZone, fromIndex, toZone, card) {
	return {
		"nature": "event",
		"type": "cardExiled",
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone,
		"card": card
	}
}

export function createCardValueChangedEvent(card, valueName, isBaseValue) {
	return {
		"nature": "event",
		"type": "cardValueChanged",
		"card": card,
		"valueName": valueName,
		"isBaseValue": isBaseValue
	}
}

export function createCardEquippedEvent(equipment, target) {
	return {
		"nature": "event",
		"type": "cardEquipped",
		"equipment": equipment,
		"target": target
	}
}

export function createCardRevealedEvent(card) {
	return {
		"nature": "event",
		"type": "cardRevealed",
		"card": card
	}
}