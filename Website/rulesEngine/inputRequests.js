// input request definitions for passing out of the engine

export const chooseCards = {
	create: function(player, cards, validAmounts) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseCards",
			"from": cards,
			"validAmounts": validAmounts
		}
	},
	validate: function(response, request) {
		if (!request.validAmounts.includes(response.length)) {
			throw new Error("Chose invalid amount of cards.");
		}
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= request.from.length) {
				throw new Error("Chose an invalid card index: " + cardIndex);
			}
		}
		return response.map(cardIndex => request.from[cardIndex]);
	}
}

export const enterBattlePhase = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "enterBattlePhase"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

// pass on block creation
export const pass = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "pass"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

export const doStandardDraw = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "doStandardDraw"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

export const doStandardSummon = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "doStandardSummon"
		}
	},
	validate: function(response, request) {
		if (response.handIndex < 0 || response.handIndex >= request.player.handZone.cards.length) {
			throw new Error("Supplied out-of-range hand card index for a standard summon.");
		}
		if (response.fieldIndex < 0 || response.fieldIndex > 4) {
			throw new Error("Supplied out-of-range field index for a standard summon.");
		}
		if (request.player.unitZone.get(response.fieldIndex)) {
			throw new Error("Supplied already occupied field index for a standard summon.");
		}
		if (!request.player.handZone.cards[response.handIndex].cardTypes.get().includes("unit")) {
			throw new Error("Tried to standard summon a card that isn't a unit.");
		}
		return response;
	}
}
