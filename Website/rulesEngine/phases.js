// This file contains definitions for all phases in the game.
import {Stack} from "./stacks.js";
import {createStackCreatedEvent, createManaChangedEvent} from "./events.js";
import {Timing} from "./timings.js";
import * as actions from "./actions.js";

// Base class for all phases
class Phase {
	constructor(turn, type) {
		this.turn = turn;
		this.type = type;
	}
	
	* run() {}
	
	getTimings() {
		return [];
	}
}

// Base class for any phase that works with stacks and blocks
class StackPhase extends Phase {
	constructor(turn, type) {
		super(turn, type);
		this.stacks = [];
	}
	
	* run() {
		let currentStack = 0;
		do {
			currentStack = 0;
			do {
				currentStack++;
				this.stacks.push(new Stack(this, currentStack));
				yield [createStackCreatedEvent(this.stacks[this.stacks.length - 1])];
				yield* this.stacks[this.stacks.length - 1].run();
			} while (this.stacks[this.stacks.length - 1].blocks.length > 0);
		} while (currentStack > 1);
	}
	
	getTimings() {
		return this.stacks.map(stack => stack.getTimings()).flat();
	}
}

export class ManaSupplyPhase extends Phase {
	constructor(turn) {
		super(turn, "manaSupplyPhase");
		this.timings = [];
	}
	
	* run() {
		// RULES: First, if any player has more than 5 mana, their mana will be reduced to five.
		let reduceManaActions = [];
		for (let player of this.turn.game.players) {
			if (player.mana > 5) {
				reduceManaActions.push(new actions.ChangeManaAction(player, 5 - player.mana));
			}
		}
		if (reduceManaActions.length > 0) {
			this.timings.push(new Timing(this.turn.game, reduceManaActions, null));
			yield* this.timings[this.timings.length - 1].run();
		}
		
		// RULES: Next, the active player gains 5 mana.
		let turnPlayer = this.turn.player;
		this.timings.push(new Timing(this.turn.game, [new actions.ChangeManaAction(turnPlayer, 5)], null));
		yield* this.timings[this.timings.length - 1].run();
		
		// RULES: Then they pay their partner's level in mana. If they can't pay, they loose the game.
		let partnerLevel = turnPlayer.partnerZone.cards[0].level.get();
		if (turnPlayer.mana < partnerLevel) {
			yield [createPlayerLostEvent(turnPlayer)];
			while (true) {
				yield [];
			}
		} else {
			this.timings.push(new Timing(this.turn.game, [new actions.ChangeManaAction(turnPlayer, -partnerLevel)], null));
			yield* this.timings[this.timings.length - 1].run();
		}
		
		// RULES: If they still have more than 5 mana, it will again be reduced to 5.
		if (turnPlayer.mana > 5) {
			this.timings.push(new Timing(this.turn.game, [new actions.ChangeManaAction(turnPlayer, 5 - turnPlayer.mana)], null));
			yield* this.timings[this.timings.length - 1].run();
		}
		
		// RULES: At the end of the mana supply phase, any player with more than 8 hand cards discards down to 8.
		for (let player of this.turn.game.players) {
			if (player.handZone.cards.length > 8) {
				// TODO: implement discards
			}
		}
	}
}

export class DrawPhase extends StackPhase {
	constructor(turn) {
		super(turn, "drawPhase");
	}
}

export class MainPhase extends StackPhase {
	constructor(turn) {
		super(turn, "mainPhase");
	}
}

export class BattlePhase extends StackPhase {
	constructor(turn) {
		super(turn, "battlePhase");
	}
}

export class EndPhase extends StackPhase {
	constructor(turn) {
		super(turn, "endPhase");
	}
}