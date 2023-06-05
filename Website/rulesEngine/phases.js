// This file contains definitions for all phases in the game.
import {Stack} from "./stacks.js";
import {createStackCreatedEvent, createManaChangedEvent} from "./events.js";
import {Timing} from "./timings.js";
import * as actions from "./actions.js";
import * as requests from "./inputRequests.js";
import * as blocks from "./blocks.js";

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
	getActions() {
		return [];
	}
}

// Base class for any phase that works with stacks and blocks
class StackPhase extends Phase {
	constructor(turn, type) {
		super(turn, type);
		this.stacks = [];
	}
	
	async* run() {
		let currentStackIndex = 0;
		do {
			currentStackIndex = 0;
			do {
				currentStackIndex++;
				this.stacks.push(new Stack(this, currentStackIndex));
				yield [createStackCreatedEvent(this.stacks[this.stacks.length - 1])];
				yield* this.stacks[this.stacks.length - 1].run();
			} while (this.stacks[this.stacks.length - 1].blocks.length > 0);
		} while (currentStackIndex > 1);
	}
	
	getTimings() {
		return this.stacks.map(stack => stack.getTimings()).flat();
	}
	getActions() {
		return this.stacks.map(stack => stack.getActions()).flat();
	}
	
	getBlockOptions(stack) {
		return [requests.pass.create(stack.getNextPlayer())];
	}
}

export class ManaSupplyPhase extends Phase {
	constructor(turn) {
		super(turn, "manaSupplyPhase");
		this.timings = [];
	}
	
	async* run() {
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
			yield [createPlayerLostEvent(turnPlayer, "partnerCostTooHigh")];
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
		let cardChoiceRequests = [];
		for (let player of this.turn.game.players) {
			if (player.handZone.cards.length > 8) {
				cardChoiceRequests.push(requests.chooseCards.create(player, player.handZone.cards, [player.handZone.cards.length - 8], "handTooFull"));
			}
		}
		if (cardChoiceRequests.length > 0) {
			let chosenCards = (yield cardChoiceRequests).filter(choice => choice !== undefined).map((choice, i) => requests.chooseCards.validate(choice.value, cardChoiceRequests[i]));
			this.timings.push(new Timing(this.turn.game, chosenCards.flat().map(card => new actions.DiscardAction(card)), null));
			yield* this.timings[this.timings.length - 1].run();
		}
	}
	
	getTimings() {
		return this.timings;
	}
	getActions() {
		return this.timings.map(timing => timing.actions).flat();
	}
}

export class DrawPhase extends StackPhase {
	constructor(turn) {
		super(turn, "drawPhase");
	}
	
	getBlockOptions(stack) {
		if (this.turn.index != 0 && this.stacks.length == 1 && stack.blocks.length == 0) {
			return [requests.doStandardDraw.create(this.turn.player)];
		}
		return super.getBlockOptions(stack);
	}
}

export class MainPhase extends StackPhase {
	constructor(turn) {
		super(turn, "mainPhase");
	}
	
	getBlockOptions(stack) {
		let options = super.getBlockOptions(stack);
		if (stack.canDoNormalActions()) {
			if (this.turn.hasStandardSummoned === null) {
				options.push(requests.doStandardSummon.create(this.turn.player));
			}
			if (this.turn.hasRetired === null) {
				let eligibleUnits = [];
				for (let card of this.turn.player.unitZone.cards.concat(this.turn.player.partnerZone.cards)) {
					if (card) {
						// RULES: Note that you cannot retire units that have been summoned this turn or the turn before.
						let recentTurnActions = this.turn.game.turns[this.turn.game.turns.length - 1].getActions();
						if (this.turn.game.turns.lenght > 1) {
							recentTurnActions = this.turn.game.turns[this.turn.game.turns.length - 2].getActions().concat(recentTurnActions);
						}
						let summons = recentTurnActions.filter(action => action instanceof actions.SummonAction && action.unit.cardRef === card);
						if (summons.length > 0) {
							continue;
						}
						
						eligibleUnits.push(card);
					}
				}
				options.push(requests.doRetire.create(this.turn.player, eligibleUnits));
			}
		}
		return options;
	}
}

export class BattlePhase extends StackPhase {
	constructor(turn) {
		super(turn, "battlePhase");
	}
	
	getBlockOptions(stack) {
		let options = super.getBlockOptions(stack);
		if (stack.canDoNormalActions()) {
			// check for fight
			if (this.turn.game.currentAttackDeclaration) {
				return [requests.doFight.create()];
			}
			
			// find eligible attackers
			let eligibleAttackers = this.turn.player.partnerZone.cards.concat(this.turn.player.unitZone.cards.filter(card => card !== null));
			eligibleAttackers = eligibleAttackers.filter(card => card.attackCount == 0);
			if (eligibleAttackers.length > 0) {
				options.push(requests.doAttackDeclaration.create(this.turn.player, eligibleAttackers));
			}
		}
		return options;
	}
}

export class EndPhase extends StackPhase {
	constructor(turn) {
		super(turn, "endPhase");
	}
	
	getBlockOptions(stack) {
		return [requests.pass.create(stack.getNextPlayer())];
	}
}