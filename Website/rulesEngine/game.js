// This module exports the Game class which holds all data relevant to a single Cross Universe game.

import {Player} from "./player.js";
import {Turn} from "./turns.js";
import {CURandom} from "./random.js";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent} from "./events.js";
import * as phases from "./phases.js";

export class Game {
	constructor() {
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));
		
		this.turns = [];
		this.currentAttackDeclaration = null;
		this.nextTimingIndex = 1;
		
		this.rng = new CURandom();
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
			yield* this.currentTurn().run();
			for (let card of this.getFieldCards(currentPlayer).concat(this.getFieldCards(currentPlayer.next()))) {
				if (card) {
					card.endOfTurnReset();
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

	currentTurn() {
		return this.turns[this.turns.length - 1];
	}
	currentPhase() {
		return this.currentTurn().currentPhase();
	}
	currentStack() {
		let currentPhase = this.currentPhase();
		return !currentPhase instanceof phases.StackPhase? null : currentPhase.currentStack();
	}

	getFieldCards(player) {
		return player.partnerZone.cards.concat(player.unitZone.cards.concat(player.spellItemZone.cards)).filter(card => card != null);
	}
}

export class AttackDeclaration {
	constructor(game, attackers, target) {
		this.game = game;
		this.attackers = attackers;
		this.target = target;
	}
	
	isValid() {
		if (this.target == null) {
			return false;
		}
		if (this.attackers.length == 0) {
			return false;
		}
		if (this.attackers.length > 1) {
			let partner = this.attackers.find(unit => unit.zone.type == "partner");
			if (!partner) {
				return false;
			}
			let unitWithoutPartnerType = this.attackers.find(unit => unit.types.get().filter(type => partner.types.get().includes(type)).length == 0);
			if (unitWithoutPartnerType) {
				return false;
			}
		}
		return true;
	}
}