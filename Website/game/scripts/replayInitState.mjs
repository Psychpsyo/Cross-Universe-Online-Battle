import {Game} from "../../rulesEngine/src/game.mjs";
import {GameState} from "./gameState.mjs";
import {BoardState} from "./boardState.mjs";
import {locale} from "../../scripts/locale.mjs";
import * as gameUI from "./gameUI.mjs";
import * as generalUI from "./generalUI.mjs";

export class ReplayInitState extends GameState {
	constructor(replay) {
		super();
		gameState = this;

		players[0].name = locale.chat.replayOpponent;
		players[1].name = locale.chat.replayYou;
		players[0].profilePicture = "U00001";
		players[1].profilePicture = "U00001";

		game = new Game();
		localPlayer = game.players[1];
		game.setReplay(replay);

		generalUI.init();
		gameDiv.hidden = false;
		callingWindow.postMessage({type: "gameStarted"});

		// if this is an error replay from testing, print the crash reason
		if (replay.extra.crashReason) {
			chat.putMessage(replay.extra.crashReason, "error");
		}

		gameUI.init();
		new BoardState(true);
		gameState.doStartGame();
	}
}