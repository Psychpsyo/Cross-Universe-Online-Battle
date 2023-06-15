// input request definitions for passing out of the engine

export const chooseCards = {
	create: function(player, cards, validAmounts, reason) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseCards",
			"from": cards,
			"validAmounts": validAmounts,
			"reason": reason
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

export const choosePlayer = {
	create: function(player, reason) {
		return {
			"nature": "request",
			"player": player,
			"type": "choosePlayer",
			"reason": reason
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.player.game.players.length) {
			throw new Error("Chose an invalid player index: " + response);
		}
		return request.player.game.players[response];
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

export const deployItem = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "deployItem"
		}
	},
	validate: function(response, request) {
		if (response.handIndex < 0 || response.handIndex >= request.player.handZone.cards.length) {
			throw new Error("Supplied out-of-range hand card index for deploying an item.");
		}
		if (response.fieldIndex < 0 || response.fieldIndex > 3) {
			throw new Error("Supplied out-of-range field index for deploying an item.");
		}
		if (request.player.spellItemZone.get(response.fieldIndex)) {
			throw new Error("Supplied already occupied field index for deploying an item.");
		}
		if (!request.player.handZone.cards[response.handIndex].cardTypes.get().includes("item")) {
			throw new Error("Tried to deploy a card that isn't an item.");
		}
		return response;
	}
}

export const castSpell = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "castSpell"
		}
	},
	validate: function(response, request) {
		if (response.handIndex < 0 || response.handIndex >= request.player.handZone.cards.length) {
			throw new Error("Supplied out-of-range hand card index for casting a spell.");
		}
		if (response.fieldIndex < 0 || response.fieldIndex > 3) {
			throw new Error("Supplied out-of-range field index for casting a spell.");
		}
		if (request.player.spellItemZone.get(response.fieldIndex)) {
			throw new Error("Supplied already occupied field index for casting a spell.");
		}
		if (!request.player.handZone.cards[response.handIndex].cardTypes.get().includes("spell")) {
			throw new Error("Tried to cast a card that isn't a spell.");
		}
		return response;
	}
}

export const doAttackDeclaration = {
	create: function(player, eligibleUnits) {
		return {
			"nature": "request",
			"player": player,
			"type": "doAttackDeclaration",
			"eligibleUnits": eligibleUnits
		}
	},
	validate: function(response, request) {
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= request.eligibleUnits.length) {
				throw new Error("Chose an invalid attacker index for attack declaration: " + cardIndex);
			}
		}
		response = response.map(cardIndex => request.eligibleUnits[cardIndex]);
		if (response.length > 1) {
			let partner = response.find(card => card.zone.type == "partner");
			if (!partner) {
				throw new Error("Tried to peform a combined attack without declaring the partner to attack.");
			}
			for (let unit of response) {
				if (!unit.sharesTypeWith(partner)) {
					throw new Error("Tried to peform a combined attack where some participants do not share a type with the partner.");
				}
			}
		}

		return response;
	}
}

export const doFight = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "doFight"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

export const doRetire = {
	create: function(player, eligibleUnits) {
		return {
			"nature": "request",
			"player": player,
			"type": "doRetire",
			"eligibleUnits": eligibleUnits
		}
	},
	validate: function(response, request) {
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= request.eligibleUnits.length) {
				throw new Error("Chose an invalid unit retire index: " + cardIndex);
			}
		}
		return response.map(cardIndex => request.eligibleUnits[cardIndex]);
	}
}

export const activateOptionalAbility = {
	create: function(player, eligibleAbilities) {
		return {
			"nature": "request",
			"player": player,
			"type": "activateOptionalAbility",
			"eligibleAbilities": eligibleAbilities
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.eligibleAbilities.length) {
			throw new Error("Supplied out-of-range ability index for activating an optional ability.");
		}
		return request.eligibleAbilities[response];
	}
}

export const chooseZoneSlot = {
	create: function(player, zone, eligibleSlots) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseZoneSlot",
			"zone": zone,
			"eligibleSlots": eligibleSlots
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.eligibleSlots.length) {
			throw new Error("Supplied out-of-range zone slot index.");
		}
		return request.eligibleSlots[response];
	}
}
