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
			if (cardIndex >= 0 && cardIndex < request.cards.length) {
				throw new Error("Chose an invalid card index: " + cardIndex);
			}
		}
		return response.map(cardIndex => request.cards[cardIndex]);
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
	validate: function(response) {
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
	validate: function(response) {
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
	validate: function(response) {
		return response;
	}
}