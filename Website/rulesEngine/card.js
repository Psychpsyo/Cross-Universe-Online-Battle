// This module exports the Card class which represents a specific card in a Game.

import {CardValue, SnapshotValue} from "./cardValue.js";

class BaseCard {
	constructor(player, cardId, hidden, cardTypes, names, level, types, attack, defense) {
		this.owner = player;
		this.cardId = cardId;
		this.hidden = hidden;
		
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		
		this.zone = null;
		this.index = -1;
		this.attackCount = 0;
		this.cardRef = this;
	}

	sharesTypeWith(card) {
		let ownTypes = this.types.get();
		for (let type of card.types.get()) {
			if (ownTypes.includes(type)) {
				return true;
			}
		}
		return false;
	}

	static sort(a, b) {
		if (a.cardId < b.cardId) {
			return -1;
		}
		if (a.cardId > b.cardId) {
			return 1;
		}
		return 0;
	}
}

export class Card extends BaseCard {
	constructor(player, cdf, hidden) {
		let data = parseCdfValues(cdf);
		let baseCardTypes = [data.cardType];
		if (data.cardType == "token") {
			baseCardTypes.push("unit");
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
			baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
			baseCardTypes.push("item");
		}
		super(player, data.id, hidden,
			new CardValue(baseCardTypes),
			new CardValue([data.name ?? data.id]),
			new CardValue(data.level ?? 0),
			new CardValue(data.types ?? []),
			new CardValue(data.attack ?? 0),
			new CardValue(data.defense ?? 0)
		);
	}

	snapshot() {
		return new SnapshotCard(this);
	}
}

// a card with all its values frozen so it can be held in internal logs of what Actions happened in a Timing.
class SnapshotCard extends BaseCard {
	constructor(card) {
		super(card.owner, card.cardId, card.hidden,
			new SnapshotValue(card.cardTypes.get(), card.cardTypes.getBase()),
			new SnapshotValue(card.names.get(), card.names.getBase()),
			new SnapshotValue(card.level.get(), card.level.getBase()),
			new SnapshotValue(card.types.get(), card.types.getBase()),
			new SnapshotValue(card.attack.get(), card.attack.getBase()),
			new SnapshotValue(card.defense.get(), card.defense.getBase())
		);

		this.zone = card.zone;
		this.index = card.index;
		this.attackCount = card.attackCount;
		this.cardRef = card;
	}
}

function parseCdfValues(cdf) {
	let data = {
		effects: []
	};
	let lines = cdf.split("\n");
	let inEffect = false;
	for (let line of lines) {
		let parts = line.trim().split(/:(.*)/);
		if (inEffect && parts[0] != "o") {
			data.effects[data.effects.length - 1] += line;
			continue;
		}
		switch(parts[0]) {
			case "id": {
				data.id = parts[1].trim().substring(2);
				break;
			}
			case "cardType": {
				data.cardType = parts[1].trim();
				break;
			}
			case "name": {
				data.name = parts[1].trim().substring(2);
				break;
			}
			case "level": {
				data.level = parseInt(parts[1].trim());
				break;
			}
			case "types": {
				data.types = parts[1].split(",").map(type => type.trim());
				break;
			}
			case "attack": {
				data.attack = parseInt(parts[1].trim());
				break;
			}
			case "defense": {
				data.defense = parseInt(parts[1].trim());
				break;
			}
			case "o": {
				data.effects.push(parts[1]);
				inEffect = true;
				break;
			}
			default: {
				throw new Error("CDF Parser Error: " + parts[0] + " is not a valid card attribute.");
			}
		}
	}
	return data;
}