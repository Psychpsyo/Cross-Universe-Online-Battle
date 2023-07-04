// This module exports the Game class which holds all data relevant to a single Cross Universe game.

import {Player} from "./player.js";
import {Turn} from "./turns.js";
import {CURandom} from "./random.js";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent} from "./events.js";
import * as phases from "./phases.js";
import * as actions from "./actions.js";

export class Game {
	constructor() {
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));

		this.turns = [];
		this.endOfUpcomingTurnTimings = [[], []];
		this.currentAttackDeclaration = null;
		this.nextTimingIndex = 1;

		this.rng = new CURandom();
		this.startingHandSize = 5;
		this.allTypes = [
			"Angel",
			"Armor",
			"Beast",
			"Bird",
			"Book",
			"Boundary",
			"Bug",
			"Chain",
			"Curse",
			"Dark",
			"Demon",
			"Dragon",
			"Earth",
			"Electric",
			"Figure",
			"Fire",
			"Fish",
			"Ghost",
			"Gravity",
			"Ice",
			"Illusion",
			"Katana",
			"Landmine",
			"Light",
			"Machine",
			"Mage",
			"Medicine",
			"Myth",
			"Plant",
			"Psychic",
			"Rock",
			"Samurai",
			"Shield",
			"Spirit",
			"Structure",
			"Sword",
			"Warrior",
			"Water",
			"Wind"
		];
	}

	// Iterate over this function after setting the decks of both players and putting their partners into the partner zones.
	async* begin() {
		let currentPlayer = await this.rng.nextPlayer(this);

		// RULES: Both players choose one unit from their decks as their partner. Don’t reveal it to your opponent yet.
		for (const player of this.players) {
			if (!player.partnerZone.cards[0].values.cardTypes.includes("unit")) {
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
			let drawnCards = 0;
			for (let i = 0; i < this.startingHandSize && player.deckZone.cards.length > 0; i++) {
				player.handZone.add(player.deckZone.cards[player.deckZone.cards.length - 1], player.handZone.cards.length);
				if (player.isViewable) {
					player.handZone.cards[player.handZone.cards.length - 1].hidden = false;
				}
				drawnCards++;
			}
			drawHandEvents.push(createCardsDrawnEvent(player, drawnCards));
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
			this.turns.push(new Turn(currentPlayer, this.endOfUpcomingTurnTimings.shift()));
			this.endOfUpcomingTurnTimings.push([]);
			yield [createTurnStartedEvent()];

			let turnGenerator = this.currentTurn().run();
			let generatorOutput = await turnGenerator.next();
			while (!generatorOutput.done) {
				let actionList = generatorOutput.value;
				if (actionList.length == 0 ||
					!(actionList[0] instanceof actions.Action) ||
					actionList[0].player.aiSystem === null
				) {
					generatorOutput = await turnGenerator.next(yield actionList);
					continue;
				}
				// actionList contains decisions that need to be made by the AI.
				generatorOutput = await turnGenerator.next(actionList[0].player.aiSystem.selectMove(actionList));
			}

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
		return !(currentPhase instanceof phases.StackPhase)? null : currentPhase.currentStack();
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

		for (let attacker of attackers) {
			attacker.isAttacking = true;
		}
		target.isAttackTarget = true;
	}

	clear() {
		this.game.currentAttackDeclaration = null;
		for (let attacker of this.attackers) {
			attacker.isAttacking = false;
		}
		this.target.isAttackTarget = false;
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
			for (const unit of this.attackers) {
				if (!partner.sharesTypeWith(unit)) {
					return false;
				}
			}
		}
		return true;
	}
}