import {GameState} from "./gameState.js";
import {BoardState} from "./boardState.js";
import {Game} from "/rulesEngine/game.js";
import * as gameUI from "./gameUI.js";

export class ReplayInitState extends GameState {
	constructor(replay) {
		super();
		gameState = this;

		game = new Game();
		localPlayer = game.players[1];
		game.setReplay(replay);

		gameUI.init();
		new BoardState(true);
		gameState.doStartGame();
	}
}