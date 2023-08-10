import {GameState} from "/modules/gameState.js";
import {BoardState} from "/modules/boardState.js";
import {Game} from "/rulesEngine/game.js";
import {stopEffect} from "/modules/levitationEffect.js";
import * as gameUI from "/modules/gameUI.js";

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

		// main screen is no longer needed
		stopEffect();
		roomCodeEntry.remove();
		gameDiv.hidden = false;
	}
}