// This file contains definitions for all phases in the game.
import {Stack} from "./stacks.js";
import {createStackCreatedEvent} from "./events.js";

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
				yield [createStackCreatedEvent(this.stacks[this.stacks.length])];
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
	}
	
	* run() {
		
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