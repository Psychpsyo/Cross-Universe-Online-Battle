// This module exports the Card class which represents a specific card in a Game.

import {CardValue, SnapshotValue} from "./cardValue.js";

class BaseCard {
	constructor(player, cardId, hidden, cardTypes, names, level, types, attack, defense) {
		if (!game.cardData[cardId]) {
			throw new Error("Can't create card with unregistered ID '" + cardId + "'!");
		}
		
		this.owner = player;
		this.cardId = cardId;
		this.hidden = hidden;
		
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		
		this.location = null;
		this.cardRef = this;
	}
	
	getImage() {
		return this.hidden? "images/cardBackFrameP" + this.owner.index + ".png" : this.owner.game.cardData[this.cardId].imageSrc;
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
	constructor(player, cardId, hidden) {
		let cardData = player.game.cardData[cardId];
		let mainCardType = cardData.cardType;
		let baseCardTypes = [mainCardType];
		if (mainCardType == "token") {
			baseCardTypes.push("unit");
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(mainCardType)) {
			baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(mainCardType)) {
			baseCardTypes.push("item");
		}
		super(player, cardId, hidden,
			new CardValue(baseCardTypes),
			new CardValue([cardData.name]),
			new CardValue(cardData.level),
			new CardValue([...cardData.types]),
			new CardValue(cardData.attack ?? -1),
			new CardValue(cardData.defense ?? -1)
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
		this.location = card.location;
		this.cardRef = card;
	}
}