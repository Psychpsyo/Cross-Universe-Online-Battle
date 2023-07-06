// This module exports the Game class which holds all data relevant to a single Cross Universe game.

import {Player} from "./player.js";
import {Turn} from "./turns.js";
import {CURandom} from "./random.js";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent} from "./events.js";
import * as phases from "./phases.js";

export const baseTypes = [
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

export const novelTypes = [
	"Ninja",
	"NinjaTool",
	"Ninjutsu"
];

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
		this.allTypes = baseTypes;

		this.replay = {
			allTypes: this.allTypes,
			startingHandSize: this.startingHandSize,
			players: [{deckList: [], partnerIndex: -1}, {deckList: [], partnerIndex: -1}],
			inputLog: [],
			rngLog: []
		}
		this.isReplaying = false;
		this.replayPosition = 0;
		this.replayRngPosition = 0;
	}

	// Iterate over this function after setting the decks of both players and putting their partners into the partner zones.
	async* begin() {
		let currentPlayer = await this.nextPlayer();

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
				let playerInput;
				let actionList = generatorOutput.value;
				if (actionList.length == 0) {
					return;
				}
				if (actionList[0].nature == "event") {
					playerInput = yield actionList;
				} else if (this.isReplaying && this.replay.inputLog.length > this.replayPosition) { // we're currently stepping through an unfinished replay
					playerInput = this.replay.inputLog[this.replayPosition++];
				} else { // a player actually needs to make a choice
					if (actionList[0].player.aiSystem === null) {
						playerInput = yield actionList;
					} else {
						playerInput = actionList[0].player.aiSystem.selectMove(actionList);
					}
					this.replay.inputLog.push(playerInput);
					this.replayPosition++;
				}
				generatorOutput = await turnGenerator.next(playerInput);
			}

			for (let card of this.getFieldCards(currentPlayer).concat(this.getFieldCards(currentPlayer.next()))) {
				if (card) {
					card.endOfTurnReset();
				}
			}
			currentPlayer = currentPlayer.next();
		}
	}

	setReplay(replay) {
		this.replay = replay;
		this.allTypes = replay.allTypes;
		this.startingHandSize = replay.startingHandSize;
		this.isReplaying = true;
		this.replayPosition = 0;
		this.replayRngPosition = 0;
		for (const player of this.players) {
			player.setDeck(replay.players[player.index].deckList);
			player.setPartner(replay.players[player.index].partnerIndex);
		}
	}

	async nextInts(ranges) {
		if (this.isReplaying) {
			return this.replay.rngLog[this.replayRngPosition++];
		}
		let results = await this.rng.nextInts(ranges);
		this.replay.rngLog.push([...results]);
		this.replayRngPosition++;
		return results;
	}
	async nextInt(range) {
		if (this.isReplaying) {
			return this.replay.rngLog[this.replayRngPosition++];
		}
		let result = await this.rng.nextInt(range);
		this.replay.rngLog.push(result);
		this.replayRngPosition++;
		return result;
	}
	async nextPlayer() {
		if (this.isReplaying) {
			return this.players[this.replay.rngLog[this.replayRngPosition++]];
		}
		let result = await this.rng.nextPlayer(this);
		this.replay.rngLog.push(result);
		this.replayRngPosition++;
		return this.players[result];
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
		if (this.target) {
			this.target.isAttackTarget = false;
		}
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