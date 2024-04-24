import * as generalUI from "./generalUI.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import {BoardState} from "./boardState.mjs";
import {DeckState} from "./deckState.mjs";
import {GameState} from "./gameState.mjs";
import {Game} from "../../rulesEngine/src/game.mjs";

export class SingleplayerInitState extends GameState {
	constructor(decks, replay = null, useOldManaRule = false) {
		super();
		loadingIndicator.classList.add("active");
		deckDropzone.remove();
		deckSelector.classList.add("deckListDisable");

		game = new Game();
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
		window.parent.postMessage({type: "gameStarted"});

		// set decks and start game
		players[0].deck = decks[0];
		cardLoader.deckToCdfList(decks[0], true, game.players[0]).then(async cdfList => {
			game.players[0].setDeck(cdfList);

			if (decks[1] === null) {
				new DeckState(true);
			} else {
				players[1].deck = decks[1];
				localPlayer.setDeck(await cardLoader.deckToCdfList(decks[1], true, localPlayer));
				playerDeckButton1.disabled = false;
				mainGameArea.hidden = false;
				gameUI.init();
				new BoardState(true);
				const aiPartnerPosInDeck = game.players[0].deckZone.cards.findIndex(card => {return card.cardId === players[0].deck.suggestedPartner});
				gameState.setPartner(game.players[0], aiPartnerPosInDeck);
			}
			loadingIndicator.classList.remove("active");
		});
	}
}