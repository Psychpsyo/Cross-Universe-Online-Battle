import {BoardState} from "/modules/boardState.js";
import {ChatGPT} from "/modules/aiOpponents/chatGPT.js";
import {Game} from "/rulesEngine/game.js";
import {GameState} from "/modules/gameState.js";
import {stopEffect} from "/modules/levitationEffect.js";
import * as gameUI from "/modules/gameUI.js";
import * as deckUtils from "/modules/deckUtils.js";
import * as cardLoader from "/modules/cardLoader.js";

const waterDeck = {"Cards":["CUU00237","CUU00237","CUU00139","CUU00139","CUU00100","CUU00100","CUU00095","CUU00095","CUU00075","CUU00075","CUU00075","CUU00074","CUU00074","CUU00074","CUU00073","CUU00073","CUU00073","CUU00071","CUU00071","CUU00071","CUU00045","CUU00045","CUU00045","CUU00034","CUU00034","CUU00034","CUS00019","CUS00019","CUS00019"],"Name":"Automatic Water Deck!","Description":"","Partner":"CUU00084"};
const angelDeck = {"Cards":["CUU00166","CUU00166","CUU00166","CUU00165","CUU00165","CUU00165","CUU00164","CUU00164","CUU00164","CUU00099","CUU00099","CUU00099","CUS00149","CUS00149","CUS00149","CUS00147","CUS00147","CUS00147","CUS00146","CUS00146","CUS00146","CUS00033","CUS00033","CUS00033","CUI00082","CUI00082","CUI00046","CUI00046","CUI00046"],"Name":"Automatic Machine Deck!","Description":"","Partner":"CUU00163"};

export class AiInitState extends GameState {
	constructor() {
		super();
		gameState = this;
		loadingIndicator.classList.add("active");
		deckDropzone.remove();
		deckSelector.classList.add("deckListDisable");

		game = new Game();
		new ChatGPT(game.players[0]);
		localPlayer = game.players[1];

		// load decks and partners
		players[0].deck = deckUtils.toDeckx(angelDeck);
		players[1].deck = deckUtils.toDeckx(waterDeck);

		let deckSetupPromises = [];
		for (let i = 0; i < 2; i++) {
			deckSetupPromises.push(cardLoader.deckToCdfList(players[i].deck, true, game.players[i]).then(deck => {
				game.players[i].setDeck(deck);
				gameUI.updateCard(game.players[i].deckZone, -1);
			}));
		}
		Promise.all(deckSetupPromises).then(this.startAiMatch);
	}

	startAiMatch() {
		loadingIndicator.classList.remove("active");

		gameUI.init();
		new BoardState(true);
		const aiPartnerPosInDeck = game.players[0].deckZone.cards.findIndex(card => {return card.cardId == players[0].deck.suggestedPartner});
		gameState.setPartner(game.players[0], aiPartnerPosInDeck);
		gameState.givePartnerChoice();

		// main screen is no longer needed
		stopEffect();
		roomCodeEntry.remove();
		gameDiv.hidden = false;

	}
}