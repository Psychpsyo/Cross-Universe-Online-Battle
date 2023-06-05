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

export function createPlayerLostEvent(player, reason) {
	return {
		"nature": "event",
		"type": "playerLost",
		"player": player,
		"reason": reason
	}
}

export function createManaChangedEvent(player) {
	return {
		"nature": "event",
		"type": "manaChanged",
		"player": player,
		"newValue": player.mana
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

export function createCardSummonedEvent(player, fromZone, fromIndex, toIndex) {
	return {
		"nature": "event",
		"type": "cardSummoned",
		"player": player,
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toIndex": toIndex
	}
}

export function createAttackDeclarationEstablishedEvent(player, targetZone, targetIndex) {
	return {
		"nature": "event",
		"type": "cardSummoned",
		"player": player,
		"targetZone": targetZone,
		"targetIndex": targetIndex
	}
}

export function createCardDiscardedEvent(fromZone, fromIndex, toZone) {
	return {
		"nature": "event",
		"type": "cardDiscarded",
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone
	}
}

export function createCardDestroyedEvent(fromZone, fromIndex, toZone) {
	return {
		"nature": "event",
		"type": "cardDestroyed",
		"fromZone": fromZone,
		"fromIndex": fromIndex,
		"toZone": toZone
	}
}

