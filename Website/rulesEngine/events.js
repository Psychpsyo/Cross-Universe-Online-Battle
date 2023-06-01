// event definitions to be passed out of the engine as they happen

export function createDeckShuffledEvent(player) {
	return {
		"nature": "event",
		"type": "deckShuffled",
		"playerIndex": player.index
	}
}

export function createStartingPlayerSelectedEvent(player) {
	return {
		"nature": "event",
		"type": "startingPlayerSelected",
		"playerIndex": player.index
	}
}

export function createPartnerRevealedEvent(player) {
	return {
		"nature": "event",
		"type": "partnerRevealed",
		"playerIndex": player.index
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
		"phase": phase.type
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

export function createLifeChangedEvent(player) {
	return {
		"nature": "event",
		"type": "lifeChanged",
		"player": player.index,
		"newValue": player.life
	}
}

export function createCardsDrawnEvent(player, amount) {
	return {
		"nature": "event",
		"type": "cardsDrawn",
		"playerIndex": player.index,
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
