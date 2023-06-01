// This module exports the Game class which holds all data relevant to a single Cross Universe game.
// TODO: migrate data from global variables into this class
import {renderCard} from "/custom/renderer.js";
import {Player} from "./player.js";
import {Card} from "./card.js";
import {CURandom} from "./random.js";
import {createStartingPlayerSelectedEvent, createTurnStartedEvent} from "./events.js";

export class Game {
	constructor() {
		this.cardData = {};
		this.zones = {};
		
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));
		
		this.turns = [];
		this.lastTiming = 0;
		
		this.rng = new CURandom();
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
	
	// Iterate over this function after setting the decks of both players
	* begin(partners) {
		let currentPlayer = this.players[this.rng.nextInt(this.players.length)];
		yield [createStartingPlayerSelectedEvent(currentPlayer)];
		
		while (true) {
			this.turns.push(new Turn(currentPlayer));
			yield [createTurnStartedEvent()];
			yield* this.turns[this.turns.length - 1].run();
			currentPlayer = this.players[(currentPlayer.index + 1) % this.players.length]
		}
	}
	
	getTimings() {
		return this.turns.map(turn => turn.getTimings()).flat();
	}
}