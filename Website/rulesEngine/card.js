// This module exports the Card class which represents a specific card in a Game.

import {CardValue} from "./cardValue.js";

export class Card {
	constructor(player, cardId, hidden) {
		if (!game.cardData[cardId]) {
			throw "Can't create card with unregistered ID '" + cardId + "'!";
		}
		
		this.owner = player;
		this.cardId = cardId;
		this.location = null;
		this.hidden = hidden;
		
		// card values
		
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
		this.cardTypes = new CardValue(baseCardTypes);
		this.names = new CardValue([cardData.name]);
		this.level = new CardValue(cardData.level);
		this.attack = new CardValue(cardData.attack ?? -1);
		this.defense = new CardValue(cardData.defense ?? -1);
		this.types = new CardValue([...cardData.types]);
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