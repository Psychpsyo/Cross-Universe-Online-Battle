// This module exports the Card class which represents a specific card in a Game.

export class Card {
	constructor(player, cardId) {
		if (!game.cardData[cardId]) {
			throw "Can't create card with unregistered ID '" + cardId + "'!";
		}
		
		this.owner = player;
		this.cardId = cardId;
		let mainType = player.game.cardData[cardId].cardType;
		this.baseCardTypes = [mainType];
		if (mainType == "token") {
			this.baseCardTypes.push("unit");
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(mainType)) {
			this.baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(mainType)) {
			this.baseCardTypes.push("item");
		} 
		this.location = null;
		this.hidden = true;
	}
	getImage() {
		return this.hidden? "images/cardBackFrameP" + this.owner.index + ".png" : this.owner.game.cardData[this.cardId].imageSrc;
	}
	getCardTypes() {
		return this.baseCardTypes;
	}
	getName() {
		return this.owner.game.cardData[this.cardId].name;
	}
	getLevel() {
		return this.owner.game.cardData[this.cardId].level;
	}
	getAttack() {
		if (this.getCardTypes().includes("unit")) {
			return this.owner.game.cardData[this.cardId].attack;
		}
		return 0;
	}
	getDefense() {
		if (this.getCardTypes().includes("unit")) {
			return this.owner.game.cardData[this.cardId].defense;
		}
		return 0;
	}
	getTypes() {
		return this.owner.game.cardData[this.cardId].types;
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