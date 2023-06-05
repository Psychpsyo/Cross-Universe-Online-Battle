// This module exports the Game class which holds all data relevant to a single Cross Universe game.
// TODO: migrate data from global variables into this class
import {renderCard} from "/custom/renderer.js";
import {Player} from "./player.js";
import {Card} from "./card.js";
import {Turn} from "./turns.js";
import {CURandom} from "./random.js";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent} from "./events.js";
import {locale} from "/modules/locale.js";

export class Game {
	constructor() {
		this.cardData = {};
		
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));
		
		this.turns = [];
		this.currentAttackDeclaration = null;
		this.nextTimingIndex = 1;
		
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
	async* begin() {
		let currentPlayer = await this.rng.nextPlayer(this);
		
		// RULES: Both players choose one unit from their decks as their partner. Don’t reveal it to your opponent yet.
		for (const player of this.players) {
			if (!player.partnerZone.cards[0].cardTypes.get().includes("unit")) {
				throw new Error("All partner cards must be units!");
			}
		}
		
		let deckShuffledEvents = [];
		await currentPlayer.deckZone.shuffle();
		await currentPlayer.next().deckZone.shuffle();
		deckShuffledEvents.push(createDeckShuffledEvent(currentPlayer));
		deckShuffledEvents.push(createDeckShuffledEvent(currentPlayer.next()));
		yield deckShuffledEvents;
		
		// RULES: Randomly decide the first player and the second player.
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
			for (let card of currentPlayer.partnerZone.concat(currentPlayer.unitZone.cards.concat(currentPlayer.spellItemZone.cards))) {
				if (card) {
					card.attackCount = 0;
				}
			}
			currentPlayer = currentPlayer.next();
		}
	}
	
	getPhases() {
		return this.turns.map(turn => turn.phases).flat();
	}
	getStacks() {
		return this.turns.map(turn => turn.getStacks()).flat();
	}
	getTimings() {
		return this.turns.map(turn => turn.getTimings()).flat();
	}
}

class AttackDeclaration {
	constructor(attackers, target) {
		this.attackers = attackers;
		this.target = target;
	}
}