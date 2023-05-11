let hotkeys = JSON.parse(localStorage.getItem("hotkeys"));

// used for hotkeys that want to open the discard piles, exile zones...
function showCardArea(area) {
	if (window.getComputedStyle(deckSelector).display != "none") {
		return;
	}
	if (window.getComputedStyle(cardSelector).display != "none" && cardSelectorTitle.textContent === area.getLocalizedName()) {
		cardSelector.style.display = "none";
		overlayBackdrop.style.display = "none";
	} else {
		openCardSelect(area, true);
	}
}

document.addEventListener("keydown", function(e) {
	if (window.getComputedStyle(gameDiv).display === "none" || window.getComputedStyle(draftGameSetupMenu).display !== "none") {
		return;
	}
	
	for (const [name, hotkey] of Object.entries(hotkeys)) {
		if (hotkey.keyCode === e.code && hotkey.ctrl === e.ctrlKey && hotkey.shift === e.shiftKey && hotkey.alt === e.altKey) {
			switch(name) {
				case "showYourDiscard": {
					showCardArea(cardAreas["discard1"]);
					break;
				}
				case "showOpponentDiscard": {
					showCardArea(cardAreas["discard0"]);
					break;
				}
				case "showYourExile": {
					showCardArea(cardAreas["exile1"]);
					break;
				}
				case "showOpponentExile": {
					showCardArea(cardAreas["exile0"]);
					break;
				}
				case "showDeck": {
					showCardArea(cardAreas["deck1"]);
					break;
				}
				case "selectToken": {
					showCardArea(cardAreas["tokens"]);
					break;
				}
				case "showField": {
					cardSelector.style.display = "none";
					deckSelector.style.display = "none";
					overlayBackdrop.style.display = "none";
					closeCardPreview();
					break;
				}
				case "destroyToken": {
					if (heldCard?.type == "token") {
						heldCard.location?.dragFinish(heldCard);
						heldCard = null;
						dragCard.src = "images/cardHidden.png";
						syncDrop("discard1");
					}
					break;
				}
				case "chat": {
					document.getElementById("chatInput").focus();
					e.preventDefault();
					break;
				}
				case "drawCard": {
					if (cardAreas["deck1"].draw()) {
						syncDraw();
					}
					break;
				}
				case "shuffleDeck": {
					cardAreas["deck1"].shuffle();
					break;
				}
				case "showDeckTop": {
					if (cardAreas["deck1"].showTop(1)) {
						syncShowDeckTop(cardAreas["deck1"]);
					}
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
		if (cardIndex < cardAreas["hand1"].cards.length) {
			previewCard(cardAreas["hand1"].cards[cardIndex]);
		}
		return;
	}
	
	if (e.code == "Escape" && !e.shiftKey && !e.altKey && !e.ctrlKey) {
		cardSelector.style.display = "none";
		deckSelector.style.display = "none";
		overlayBackdrop.style.display = "none";
	}
});