import {ManaSupplyPhase, DrawPhase, MainPhase, BattlePhase, EndPhase} from "./phases.js";
import {createPhaseStartedEvent} from "./events.js";
import {enterBattlePhase} from "./inputRequests.js";

export class Turn {
	constructor(player) {
		this.game = player.game;
		this.player = player;
		this.phases = [];
		this.index = game.turns.length;
		
		this.hasStandardSummoned = false;
		this.hasRetired = false;
	}
	
	async* run() {
		yield* this.runPhase(new ManaSupplyPhase(this));
		
		yield* this.runPhase(new DrawPhase(this));
		
		yield* this.runPhase(new MainPhase(this));
		
		if (this.index > 0) {
			let battlePhase = (yield [enterBattlePhase.create(this.player)]).filter(choice => choice !== undefined)[0];
			battlePhase.value = enterBattlePhase.validate(battlePhase.value);
			if (battlePhase.value) {
				yield* this.runPhase(new BattlePhase(this));
				
				yield* this.runPhase(new MainPhase(this));
			}
		}
		
		yield* this.runPhase(new EndPhase(this));
	}
	
	getTimings() {
		return this.phases.map(phase => phase.getTimings()).flat();
	}
	
	async* runPhase(phase) {
		this.phases.push(phase);
		yield [createPhaseStartedEvent(phase)];
		yield* phase.run();
	}
}