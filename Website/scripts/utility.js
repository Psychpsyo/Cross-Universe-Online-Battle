// getting a card's image link from its ID
function getCardImageFromID(cardId) {
	return "https://crossuniverse.net/images/cards/" + (locale.warnings.includes("noCards")? "en" : locale.code) + "/" + cardId + ".jpg";
}

function setCardBackForPlayer(player, backLink) {
	// check if opponent card back should show
	if (player == 0 && localStorage.getItem("cardBackToggle") == "true") {
		return;
	}
	
	let rightSheet = Array.from(document.styleSheets).filter(function(sheet) {return sheet.href.endsWith("game.css")})[0];
	//this matches the very specific rule that applies to all places where there's face down cards of the specified player.
	let cardBackRule = Array.from(rightSheet.rules).filter(rule => rule.selectorText == "img[src$=\"cardBackFrameP" + player + ".png\"]")[0];
	cardBackRule.style.backgroundImage = "url('" + backLink + "'), url('/images/cardBack.png')";
}
setCardBackForPlayer(1, localStorage.getItem("cardBack"));

// turns a deck into a list of Card objects
function deckToCardList(deck, isOpponentDeck) {
	cardList = [];
	deck.cards.forEach(card => {
		for (let i = 0; i < card.amount; i++) {
			cardList.push(new Card(isOpponentDeck, card.id, deck));
		}
	});
	return cardList;
}

function updateLifeDisplay(player) {
	let lifeDisplay = document.getElementById("lifeDisplay" + player);
	let lifeDisplayValue = parseInt(lifeDisplay.textContent);
	
	if (lifeDisplayValue == life[player]) {
		return;
	}
	
	if (life[player] > lifeDisplayValue) {
		document.getElementById("lifeDisplay" + player).textContent = lifeDisplayValue + 1;
	} else {
		document.getElementById("lifeDisplay" + player).textContent = lifeDisplayValue - 1;
	}
	
	window.setTimeout(function() {updateLifeDisplay(player);}, 15);
}

function updateManaDisplay(player) {
	document.getElementById("manaDisplay" + player).textContent = mana[player];
}

//opening a card selector
function openCardSelect(cardArea, sortList=false) {
	//add cards
	cardSelectorGrid.innerHTML = "";
	(sortList? [...cardArea.cards].sort(Card.sort) : cardArea.cards).forEach(function(card) {
		cardImg = document.createElement("img");
		cardImg.src = card.getImage();
		cardImg.dataset.cardId = card.id;
		cardImg.dataset.cardArea = cardArea.name;
		// This exists because Tokens that get displayed in here are fake temporary cards and do not have proper IDs.
		cardImg.dataset.cardCuId = card.cardId;
		
		cardImg.addEventListener("dragstart", grabHandler);
		cardImg.addEventListener("dragstart", function() {
			cardSelector.style.display = "none";
			overlayBackdrop.style.display = "none";
		});
		cardImg.addEventListener("click", function(e) {
			previewCard(this.dataset.cardCuId);
			e.stopPropagation();
		});
		cardSelectorGrid.insertBefore(cardImg, cardSelectorGrid.firstChild);
	});
	
	//show selector
	cardSelectorTitle.textContent = cardArea.getLocalizedName();
	cardSelector.dataset.currentArea = cardArea.name;
	cardSelectorReturnToDeck.style.display = (cardArea.name == "discard1" || cardArea.name == "exile1")? "block" : "none";
	overlayBackdrop.style.display = "block";
	cardSelector.style.display = "flex";
	
	//scroll to top
	cardSelectorGrid.parentNode.scrollTop = 0;
}

// returns all cards from the card selector to your deck and closes the selector
cardSelectorReturnToDeck.addEventListener("click", function() {
	cardAreas[cardSelector.dataset.currentArea].returnAllToDeck();
	cardSelector.style.display = "none";
	overlayBackdrop.style.display = "none";
});

function doSelectStartingPlayer() {
	if (youAre === 0 && cardAreas["field2"].isFaceDown() && cardAreas["field17"].isFaceDown()) {
		startingPlayerSelect.style.display = "block";
	}
}

//track shift key
document.addEventListener("keydown", function(e) {
	if (e.key === "Shift") {
		shiftHeld = true;
	}
});
document.addEventListener("keyup", function(e) {
	if (e.key === "Shift") {
		shiftHeld = false;
	}
});
//track ctrl key
document.addEventListener("keydown", function(e) {
	if (e.key === "Control") {
		ctrlHeld = true;
	}
});
document.addEventListener("keyup", function(e) {
	if (e.key === "Control") {
		ctrlHeld = false;
	}
});
//track alt key
document.addEventListener("keydown", function(e) {
	if (e.key === "Alt") {
		altHeld = true;
	}
});
document.addEventListener("keyup", function(e) {
	if (e.key === "Alt") {
		altHeld = false;
	}
});

window.addEventListener("blur", function(e) {
	shiftHeld = false;
	ctrlHeld = false;
	altHeld = false;
});

//adding counters

// adds a counter to the specified field slot
function addCounter(slotIndex) {
	let counter = document.createElement("div");
	counter.classList.add("counter");
	counter.textContent = "1";
	//prevent middle click default actions
	counter.addEventListener("mousedown", function (e) {e.preventDefault();})
	//edit the counter
	counter.addEventListener("click", function(e) {
		this.textContent = parseInt(this.textContent) + 1;
		let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
		let counterIndex = Array.from(this.parentElement.children).indexOf(this);
		syncCounterIncrease(fieldSlot, counterIndex);
	});
	counter.addEventListener("auxclick", function(e) {
		let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
		let counterIndex = Array.from(this.parentElement.children).indexOf(this);
		switch (e.button) {
			case 1:
				this.remove();
				syncRemoveCounter(fieldSlot, counterIndex);
				break;
			case 2:
				if (parseInt(this.textContent) == 0) {
					this.remove();
					syncRemoveCounter(fieldSlot, counterIndex);
				} else {
					this.textContent = parseInt(this.textContent) - 1;
					syncCounterDecrease(fieldSlot, counterIndex);
				}
				break;
		}
		e.preventDefault();
	});
	
	document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").prepend(counter);
}

// event listeners to add counters and sync those additions.
for (btn of Array.from(document.getElementsByClassName("counterAddBtn"))) {
	btn.addEventListener("click", function() {
		let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
		addCounter(fieldSlot);
		syncAddCounter(fieldSlot);
	});
}