import {ManaSupplyPhase, DrawPhase, MainPhase, BattlePhase, EndPhase} from "./phases.js";
import {createPhaseStartedEvent} from "./events.js";

export class Turn {
	constructor(player) {
		this.game = player.game;
		this.player = player;
		this.phases = [];
	}
	
	* run() {
		this.phases.push(new ManaSupplyPhase(this));
		yield [createPhaseStartedEvent(this.phases[0])];
		yield* this.phases[0].run();
		
		this.phases.push(new DrawPhase(this));
		yield [createPhaseStartedEvent(this.phases[1])];
		yield* this.phases[1].run();
		
		this.phases.push(new MainPhase(this));
		yield [createPhaseStartedEvent(this.phases[2])];
		yield* this.phases[2].run();
		
		// TOOD: entering the battle phase
		
		this.phases.push(new EndPhase(this));
		yield [createPhaseStartedEvent(this.phases[this.phases.length - 1])];
		yield* this.phases[this.phases.length - 1].run();
	}
	
	getTimings() {
		return this.phases.map(phase => phase.getTimings()).flat();
	}
}