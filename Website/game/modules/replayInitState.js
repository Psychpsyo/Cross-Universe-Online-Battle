import {GameState} from "./gameState.js";
import {BoardState} from "./boardState.js";
import {Game} from "/rulesEngine/game.js";
import * as gameUI from "./gameUI.js";
import * as generalUI from "./generalUI.js";

export class ReplayInitState extends GameState {
	constructor(replay) {
		super();
		gameState = this;

		game = new Game();
		localPlayer = game.players[1];
		game.setReplay(replay);

		generalUI.init();
		gameDiv.hidden = false;
		window.top.postMessage({type: "gameStarted"});

		// deck selection elements aren't needed anymore.
		deckDropzone.remove();
		deckSelector.classList.add("deckListDisable");

		gameUI.init();
		new BoardState(true);
		gameState.doStartGame();
	}
}