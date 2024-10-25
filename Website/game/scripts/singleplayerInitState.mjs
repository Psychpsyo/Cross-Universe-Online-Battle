import * as generalUI from "./generalUI.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import {BoardState} from "./boardState.mjs";
import {DeckState} from "./deckState.mjs";
import {GameState} from "./gameState.mjs";
import {Game} from "../../rulesEngine/src/game.mjs";
import * as localeExtensions from "../../scripts/localeExtensions.mjs";

export class SingleplayerInitState extends GameState {
	constructor(decks = [null, null], replay = null, useOldManaRule = false) {
		super();
		loadingIndicator.classList.add("active");

		game = new Game();
		localeExtensions.extendGame(game);
		game.config.useOldManaRule = useOldManaRule;
		localPlayer = game.players[1];
		game.players[0].aiSystem = window.opponentAi;

		if (replay !== null) {
			game.setReplay(replay);
		}

		// disable dropping files onto this window once the game starts to it doesn't happen on accident (like when loading a deck)
		document.getElementById("gameDiv").addEventListener("dragover", function(e) {
			e.preventDefault();
		});
		document.getElementById("gameDiv").addEventListener("drop", function(e) {
			e.preventDefault();
		});

		// switch to game view
		generalUI.init();
		gameDiv.hidden = false;
		callingWindow.postMessage({type: "gameStarted"});

		(async () => {
			// set decks
			for (let i = 0; i < decks.length; i++) {
				const deck = decks[i] ?? decks[1]; // opponents default to player deck, if given
				if (!deck) continue;
				playerData[i].deck = deck;
				// TODO: load these simultaneously
				const cdfList = await cardLoader.deckToCdfList(deck, true, game.players[i]);
				game.players[i].setDeck(cdfList);
			}

			// start game
			if (decks[1] === null) {
				new DeckState(true, true);
			} else {
				playerDeckButton1.disabled = false;
				new BoardState(true);
				gameUI.init();
			}
			loadingIndicator.classList.remove("active");
		})();
	}
}