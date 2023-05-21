// This module exports the Card class which represents a specific card in a Game.

export class Card {
	constructor(game, cardId) {
		if (!game.cardData[cardId]) {
			throw "Can't create card with unregistered ID '" + cardId + "'!";
		}
		
		this.game = game;
		this.cardId = cardId;
		this.type = game.cardData[cardId].cardType;
		this.location = null; // the card area that this card is in right now
	}
	
	getImage() {
		return this.game.cardData[this.cardId].imageSrc;
	}
	getCardType() {
		return this.game.cardData[this.cardId].cardType;
	}
	getName() {
		return this.game.cardData[this.cardId].name;
	}
	getLevel() {
		return this.game.cardData[this.cardId].level;
	}
	getAttack() {
		if (this.getCardType() == "unit" || this.getCardType() == "token") {
			return this.game.cardData[this.cardId].attack;
		}
		return 0;
	}
	getDefense() {
		if (this.getCardType() == "unit" || this.getCardType() == "token") {
			return this.game.cardData[this.cardId].defense;
		}
		return 0;
	}
	getTypes() {
		return this.game.cardData[this.cardId].types;
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