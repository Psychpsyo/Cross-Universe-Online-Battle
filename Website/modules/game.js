// This module exports the Game class which holds all data relevant to a single Cross Universe game.
// TODO: migrate data from global variables into this class
import {Player} from "/modules/player.js";
import {renderCard} from "/custom/renderer.js";
import {Card} from "/modules/card.js";

export class Game {
	constructor() {
		this.cardData = {};
		this.zones = {};
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));
	}
	
	async registerCard(cardId) {
		if (!this.cardData[cardId]) {
			return fetch("https://crossuniverse.net/cardInfo/?lang=" + (locale.warnings.includes("noCards")? "en" : locale.code) + "&cardID=" + cardId)
			.then(response => response.json())
			.then(response => {
				response.imageSrc = getCardImageFromID(cardId);
				this.cardData[cardId] = response;
			});
		}
	}
	
	async registerCustomCard(cardData, player) {
		let canvas = document.createElement("canvas");
		await renderCard(cardData, canvas);
		cardData.imageSrc = canvas.toDataURL();
		let cardId = "C" + String(player.nextCustomCardId).padStart(5, "0");
		this.cardData[cardId] = cardData;
		player.nextCustomCardId += this.players.length;
		return cardId;
	}
}