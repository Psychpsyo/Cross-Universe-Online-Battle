// This module exports the Game class which holds all data relevant to a single Cross Universe game.
// TODO: migrate data from global variables into this class
import {renderCard} from "/custom/renderer.js";
import {Player} from "./player.js";
import {Card} from "./card.js";
import {Turn} from "./turns.js";
import {CURandom} from "./random.js";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent} from "./events.js";

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
	
	// Iterate over this function after setting the decks of both players and putting their partners into the partner zones.
	* begin() {
		// RULES: Both players choose one unit from their decks as their partner. Don’t reveal it to your opponent yet.
		let deckShuffledEvents = [];
		for (const player of this.players) {
			if (!player.partnerZone.cards[0].cardTypes.get().includes("unit")) {
				throw new Error("All partner cards must be units!");
			}
			player.deckZone.shuffle();
			deckShuffledEvents.push(createDeckShuffledEvent(player));
		}
		yield deckShuffledEvents;
		
		// RULES: Randomly decide the first player and the second player.
		let currentPlayer = this.players[this.rng.nextInt(this.players.length)];
		yield [createStartingPlayerSelectedEvent(currentPlayer)];
		
		// RULES: Draw 5 cards from your deck to your hand.
		let drawHandEvents = [];
		for (let player of this.players) {
			for (let i = 0; i < 5; i++) {
				player.handZone.add(player.deckZone.cards[player.deckZone.cards.length - 1], player.handZone.cards.length);
				if (player.isViewable) {
					player.handZone.cards[player.handZone.cards.length - 1].hidden = false;
				}
			}
			drawHandEvents.push(createCardsDrawnEvent(player, 5));
		}
		yield drawHandEvents;
		
		// RULES: Both players reveal their partner...
		let partnerRevealEvents = [];
		for (let player of this.players) {
			player.partnerZone.cards[0].hidden = false;
			partnerRevealEvents.push(createPartnerRevealedEvent(player));
		}
		yield partnerRevealEvents;
		
		// RULES: ...and continue the game as follows.
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