// This file defines the Game class which holds all data relevant to a single Cross Universe game.
// TODO: migrate data from global variables into this class
import {Player} from "/modules/player.js";
import {renderCard} from "/custom/renderer.js";

export class Game {
	constructor() {
		this.customCards = {};
		this.players = [new Player(0), new Player(1)];
	}
	
	async enterCustomCard(cardData, player) {
		let canvas = document.createElement("canvas");
		await renderCard(cardData, canvas);
		document.body.appendChild(canvas);
		let cardId = "C" + String(player.lastCustomCard).padStart(5, "0");
		this.customCards[cardId] = {
			"data": cardData,
			"imageSrc": canvas.toDataURL()
		}
		player.lastCustomCard += this.players.length;
		return cardId;
	}
}