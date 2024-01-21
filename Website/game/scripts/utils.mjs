import {deckToCdfList} from "/scripts/cardLoader.mjs";
import * as gameUI from "./gameUI.mjs";
import * as musicSystem from "./musicSystem/mainSystem.mjs";

export async function setPlayerDeck(player, deck, automatic) {
	player.setDeck(await deckToCdfList(deck, automatic, player));
	players[player.index].deck = deck;
	gameUI.updateCard(player.deckZone, -1);
	if (player === localPlayer) {
		musicSystem.initFromDeck(deck);
	}
}