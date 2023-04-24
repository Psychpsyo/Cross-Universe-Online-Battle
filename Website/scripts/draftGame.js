// draft specific variables
var draftFormat = null;
var draftCurrentBooster = [];
var draftTakenCards = 0;
var draftPacksOpened = 0;
var draftCurrentPlayer = 0;

// get the draft format
fetch("data/draftFormats/beginnerFormat.json")
.then(response => response.json())
.then(response => {
	draftFormat = response;
	draftFormat.packCount = Math.ceil(draftFormat.deckSize * 2 / draftFormat.cardPicks);
});

function startDraftGame() {
	deckDropzone.style.display = "none";
	draftDeckOwner0.textContent = localStorage.getItem("username");
	if (draftDeckOwner0.textContent == "") {
		draftDeckOwner0.textContent = locale["draft"]["yourDeck"];
	}
	draftDeckOwner1.textContent = locale["draft"]["opponentDeck"];
	draftDeckCount0.textContent = "0/" + draftFormat.deckSize;
	draftDeckCount1.textContent = "0/" + draftFormat.deckSize;
	
	document.querySelectorAll(".draftDeckList").forEach(deckList => {
		deckList.style.aspectRatio = "8130 / " + (Math.ceil(draftFormat.deckSize / 10) * 1185);
	});
	
	draftCurrentBooster = [];
	draftTakenCards = 0;
	draftPacksOpened = 0;
	draftSetPlayer(0);
	
	if (youAre === 0) {
		draftRerollCards();
	}
	
	draftGameSetupMenu.removeAttribute("hidden");
}

function draftSetPlayer(player) {
	draftCurrentPlayer = player % 2;
	draftMainInfo.textContent = draftCurrentPlayer == youAre? locale["draft"]["yourTurn"] : locale["draft"]["opponentsTurn"];
}

// rerolls the current pack and syncs that order to the other player
function draftRerollCards() {
	for (let i = 0; i < 10; i++) {
		let cardPool = draftFormat.cardPools[draftFormat.packContents[i].pool];
		draftCurrentBooster.push(cardPool[Math.floor(Math.random() * cardPool.length)]);
	}
	
	socket.send("[draft][reroll]" + draftCurrentBooster.join("|"));
	draftOpenNewPack();
}

// shuffles the freshly rerolled pack onto the screen
function draftOpenNewPack() {
	draftPacksOpened++;
	draftCardSelection.innerHTML = "";
	
	for (let i = 0; i < 10; i++) {
		window.setTimeout(function() {
			let card = document.createElement("img");
			card.dataset.cardId = draftCurrentBooster.pop();
			card.src = getCardImageFromID(card.dataset.cardId);
			card.addEventListener("click", function() {
				if (shiftHeld || ctrlHeld || altHeld) {
					previewCard(this.dataset.cardId);
					return;
				}
				
				// is it your turn?
				if (draftCurrentPlayer != youAre) {
					return;
				}
				// does the card still exist?
				if (this.src.endsWith("cardHidden.png")) {
					return;
				}
				
				// sync this to the opponent first, since this element may get destroyed by draftAddToDeck if that triggers a reroll.
				socket.send("[draft][picked]" + Array.from(this.parentElement.childNodes).indexOf(this));
				draftAddToDeck(this, 0);
			});
			card.addEventListener("dragstart", function(e) {
				e.preventDefault();
			});
			draftCardSelection.appendChild(card);
		}, (i + 1) * 50);
	}
	
	draftPackNumber.textContent = locale["draft"]["packNumber"].replace("{#CURRENT}", draftPacksOpened).replace("{#TOTAL}", draftFormat.packCount);
	draftCardNumber.textContent = locale["draft"]["amountTaken"].replace("{#CURRENT}", "0").replace("{#TOTAL}", draftFormat.cardPicks);
}

// adds a card to deck and switches which player is taking a card
function draftAddToDeck(card, deck) {
	let deckCard = document.createElement("img");
	deckCard.dataset.cardId = card.dataset.cardId;
	deckCard.src = card.src;
	deckCard.addEventListener("click", function() {
		previewCard(this.dataset.cardId);
	});
	document.getElementById("draftDeckList" + deck).appendChild(deckCard);
	document.getElementById("draftDeckCount" + deck).textContent = document.getElementById("draftDeckList" + deck).childElementCount + "/" + draftFormat.deckSize;
	card.src = "images/cardHidden.png";
	
	// check if all cards have been taken.
	if (draftDeckList0.childElementCount == draftFormat.deckSize && draftDeckList1.childElementCount == draftFormat.deckSize) {
		// disable card picking
		draftCurrentPlayer = -1;
		draftMainInfo.textContent = locale["draft"]["finished"];
		
		// load decks
		cardAreas["deck1"].setDeck(deckUtils.deckFromCardList(Array.from(draftDeckList0.childNodes).map(img => {return img.dataset.cardId}), locale["draft"]["deckName"]));
		cardAreas["deck0"].setDeck(deckUtils.deckFromCardList(Array.from(draftDeckList1.childNodes).map(img => {return img.dataset.cardId}), locale["draft"]["deckName"]));
		
		// show start button
		draftStartButton.removeAttribute("hidden");
		return;
	}
	
	// check if a new pack needs to be opened
	draftTakenCards++;
	if (draftTakenCards == draftFormat.cardPicks) {
		draftTakenCards = 0;
		if (draftCurrentPlayer == youAre) {
			draftRerollCards();
		}
	} else {
		draftCardNumber.textContent = locale["draft"]["amountTaken"].replace("{#CURRENT}", draftTakenCards).replace("{#TOTAL}", draftFormat.cardPicks);
	}
	draftSetPlayer(draftCurrentPlayer + 1);
}

// receives messages from the other player
function draftHandleMessage(message) {
	let command = message.substring(1, message.indexOf("]"));
	message = message.substring(message.indexOf("]") + 1);
	
	switch (command) {
		case "picked": {
			draftAddToDeck(draftCardSelection.childNodes.item(message), 1);
			break;
		}
		case "reroll": {
			draftCurrentBooster = message.split("|");
			draftOpenNewPack();
			break;
		}
	}
}

draftStartButton.addEventListener("click", function() {
	// close draft menu
	draftGameSetupMenu.setAttribute("hidden", "");
	mainGameArea.removeAttribute("hidden");
	gameInteractions.removeAttribute("hidden");
	
	// time to choose a partner
	openPartnerSelectMenu();
});