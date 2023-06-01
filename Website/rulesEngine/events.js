// event definitions to be passed out of the engine as they happen

export function createStartingPlayerSelectedEvent(player) {
	return {
		"type": "startingPlayerSelected",
		"playerIndex": player.index
	}
}

export function createGameStartedEvent() {
	return {
		"type": "gameStarted"
	}
}

export function createTurnStartedEvent() {
	return {
		"type": "turnStarted"
	}
}

export function createPhaseStartedEvent(phase) {
	return {
		"type": "phaseStarted",
		"phase": phase.type
	}
}

export function createStackCreatedEvent(stack) {
	return {
		"type": "stackCreated",
		"index": stack.index
	}
}

export function createBlockCreatedEvent(block) {
	return {
		"type": "stackCreated",
		"index": block.type
	}
}

export function createManaChangedEvent(player) {
	return {
		"type": "manaChanged",
		"player": player.index,
		"newValue": player.mana
	}
}

export function createLifeChangedEvent(player) {
	return {
		"type": "lifeChanged",
		"player": player.index,
		"newValue": player.life
	}
}

export function createCardDrawnEvent(player) {
	return {
		"type": "cardDrawn",
		"playerIndex": player.index
	}
}

export function createCardDiscardedEvent(fromZone, fromIndex) {
	return {
		"type": "cardDiscarded",
		"fromZone": fromZone,
		"fromIndex": fromIndex
	}
}
