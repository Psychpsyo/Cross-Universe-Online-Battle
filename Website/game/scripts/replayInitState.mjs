import {Game} from "../../rulesEngine/src/game.mjs";
import {GameState} from "./gameState.mjs";
import {BoardState} from "./boardState.mjs";
import {locale} from "../../scripts/locale.mjs";
import * as gameUI from "./gameUI.mjs";
import * as generalUI from "./generalUI.mjs";
import * as localeExtensions from "../../scripts/localeExtensions.mjs";

export class ReplayInitState extends GameState {
	constructor(replay) {
		super();

		playerData[0].name = locale.chat.replayOpponent;
		playerData[1].name = locale.chat.replayYou;
		playerData[0].profilePicture = "U00001";
		playerData[1].profilePicture = "U00001";

		game = new Game();
		localeExtensions.extendGame(game);
		localPlayer = game.players[1];
		game.setReplay(replay);

		generalUI.init();
		gameDiv.hidden = false;
		callingWindow.postMessage({type: "gameStarted"});

		// if this is an error replay from testing, print the crash reason
		if (replay.extra.crashReason) {
			chat.putMessage(replay.extra.crashReason, "error");
		}

		new BoardState(true);
		gameUI.init();
		gameState.doStartGame();
	}
}