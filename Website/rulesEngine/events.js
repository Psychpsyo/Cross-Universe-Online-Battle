// event definitions to be passed out of the engine as they happen

export function createDeckShuffledEvent(player) {
	return {
		"nature": "event",
		"type": "deckShuffled",
		"player": player.index
	}
}

export function createStartingPlayerSelectedEvent(player) {
	return {
		"nature": "event",
		"type": "startingPlayerSelected",
		"player": player.index
	}
}

export function createPartnerRevealedEvent(player) {
	return {
		"nature": "event",
		"type": "partnerRevealed",
		"player": player.index
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
		"phaseType": phase.type
	}
}

export function createStackCreatedEvent(stack) {
	return {
		"nature": "event",
		"type": "stackCreated",
		"index": stack.index
	}
}

export function createBlockCreatedEvent(block) {
	return {
		"nature": "event",
		"type": "stackCreated",
		"index": block.type
	}
}

export function createPlayerLostEvent(player, reason) {
	return {
		"nature": "event",
		"type": "playerLost",
		"player": player.index,
		"reason": reason
	}
}

export function createManaChangedEvent(player) {
	return {
		"nature": "event",
		"type": "manaChanged",
		"player": player.index,
		"newValue": player.mana
	}
}

export function createCardsDrawnEvent(player, amount) {
	return {
		"nature": "event",
		"type": "cardsDrawn",
		"player": player.index,
		"amount": amount
	}
}

export function createCardDiscardedEvent(fromZone, fromIndex) {
	return {
		"nature": "event",
		"type": "cardDiscarded",
		"fromZone": fromZone,
		"fromIndex": fromIndex
	}
}
