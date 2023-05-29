let hotkeys = JSON.parse(localStorage.getItem("hotkeys"));

// used for hotkeys that want to open the discard piles, exile zones...
function showCardArea(zone) {
	if (window.getComputedStyle(cardSelector).display != "none" && cardSelectorTitle.textContent === zone.getLocalizedName()) {
		closeCardSelect();
	} else {
		openCardSelect(zone, true);
	}
}

document.addEventListener("keydown", async function(e) {
	boardStateModule = await import("/modules/boardState.js");
	if (!(gameState instanceof boardStateModule.BoardState)) {
		return;
	}
	
	for (const [name, hotkey] of Object.entries(hotkeys)) {
		if (hotkey.keyCode === e.code && hotkey.ctrl === e.ctrlKey && hotkey.shift === e.shiftKey && hotkey.alt === e.altKey) {
			switch(name) {
				case "showYourDiscard": {
					showCardArea(localPlayer.discardPile);
					break;
				}
				case "showOpponentDiscard": {
					showCardArea(game.players[0].discardPile);
					break;
				}
				case "showYourExile": {
					showCardArea(localPlayer.exileZone);
					break;
				}
				case "showOpponentExile": {
					showCardArea(game.players[0].exileZone);
					break;
				}
				case "showDeck": {
					showCardArea(localPlayer.deckZone);
					break;
				}
				case "selectToken": {
					//showCardArea(cardAreas["tokens"]); // TODO: Tokens
					break;
				}
				case "showField": {
					closeCardSelect();
					closeCardPreview();
					break;
				}
				case "destroyToken": {
					// TODO: Tokens
					//if (heldCard?.type == "token") {
					//	heldCard.location?.dragFinish(heldCard);
					//	heldCard = null;
					//	dragCard.src = "images/cardHidden.png";
					//	syncDrop("discard1");
					//}
					break;
				}
				case "chat": {
					document.getElementById("chatInput").focus();
					e.preventDefault();
					break;
				}
				case "drawCard": {
					gameState.controller.deckDraw(localPlayer);
					break;
				}
				case "shuffleDeck": {
					gameState.controller.deckShuffle(localPlayer.deckZone);
					break;
				}
				case "showDeckTop": {
					gameState.controller.deckShowTop(localPlayer, player.deckZone);
					break;
				}
			}
		}
	}
	
	if (e.code.startsWith("Digit") && !e.shiftKey && !e.altKey && !e.ctrlKey) {
		let cardIndex = e.code.substr(5);
		if (cardIndex == 0) {
			cardIndex = 10;
		}
		cardIndex -= 1;
		if (cardIndex < localPlayer.handZone.length) {
			previewCard(localPlayer.handZone.cards[cardIndex]);
		}
		return;
	}
});