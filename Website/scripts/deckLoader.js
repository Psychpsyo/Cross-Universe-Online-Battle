document.getElementById("deckDropzone").addEventListener("dragover", function(e) {
	e.preventDefault();
	this.style.backgroundColor = "#ffffff33";
});

document.getElementById("deckDropzone").addEventListener("dragleave", function(e) {
	e.preventDefault();
	this.style.removeProperty("background-color");
});

//opening the partner select menu
function openPartnerSelectMenu() {
	// unhide backdrop
	overlayBackdrop.style.display = "block";
	
	//clear partner selector
	if (document.getElementById("partnerSelectorGrid").firstChild) {
		document.getElementById("partnerSelectorGrid").innerHTML = "";
	}
	
	//add cards
	for (card of cardAreas["deck1"].cards) {
		//check if card is a unit (eligible as a partner)
		if (card.type == "unit") {
			cardImg = document.createElement("img");
			cardImg.src = card.getImage();
			cardImg.dataset.cardId = card.cardId;
			cardImg.addEventListener("click", function() {
				if (shiftHeld) {
					previewCard(this.dataset.cardId);
				} else {
					document.getElementById("partnerSelectionMenu").style.display = "none";
					finishDeckLoading(this.dataset.cardId);
					overlayBackdrop.style.display = "none";
				}
			});
			document.getElementById("partnerSelectorGrid").appendChild(cardImg)
		}
	}
	document.getElementById("partnerSelectionMenu").style.display = "flex";
	
	//scroll to top
	document.getElementById("partnerSelectorGrid").parentNode.scrollTop = 0;
}

//loading a deck into the actual game
async function loadDeck(deck) {
	loadedDeck = deck;
	await cardAreas["deck1"].setDeck(deck);
	syncDeck();
	
	//hide the deck dropzone and show the game interaction section, as well as the partner choice menu
	document.getElementById("deckDropzone").style.display = "none";
	document.getElementById("gameInteractions").style.display = "block";
	
	if (deck.suggestedPartner) {
		if (localStorage.getItem("partnerChoiceToggle") === "true") {
			document.getElementById("partnerSelectQuestion").style.display = "block";
		} else {
			finishDeckLoading();
		}
	} else {
		openPartnerSelectMenu();
	}
}

// called after partner selection
function finishDeckLoading(partnerId = null) {
	partnerId = partnerId ?? loadedDeck["suggestedPartner"];
	document.getElementById("field17").src = "images/cardBackFrameP1.png";
	
	let partnerPosInDeck = cardAreas["deck1"].cards.findIndex(card => {return card.cardId == partnerId});
	loadedPartner = cardAreas["deck1"].cards.splice(partnerPosInDeck, 1)[0];
	
	syncPartnerChoice();
	
	//shuffle the just loaded deck
	cardAreas["deck1"].shuffle();
	cardAreas["deck1"].updateVisual();
	
	doSelectStartingPlayer();
}

function loadDeckFile(file) {
	let reader = new FileReader();
	reader.onload = function(e) {
		//check if deck is in VCI Generator format (ending is .deck) and if so, convert it to deckx
		loadDeck(this.fileName.endsWith(".deck")? deckUtils.toDeckX(JSON.parse(e.target.result)) : JSON.parse(e.target.result));
	};
	
	reader.fileName = file["name"];
	if (reader.fileName.endsWith(".deck") || reader.fileName.endsWith(".deckx")) { //validate file format
		reader.readAsText(file);
	}
}

//loading custom decks from file (works anywhere on the page even though the deck dropbox has neat highlighting for it)
document.getElementById("gameDiv").addEventListener("dragover", function(e) {
	e.preventDefault();
});
document.getElementById("gameDiv").addEventListener("drop", function(e) {
	e.preventDefault();
	
	if (loadedDeck || !e.dataTransfer.items[0].getAsFile()) {
		document.getElementById("deckDropzone").style.removeProperty("background-color");
		return;
	}
	
	loadDeckFile(e.dataTransfer.items[0].getAsFile());
	//clear white highlighting of deck drop box
	document.getElementById("deckDropzone").style.removeProperty("background-color");
});
document.getElementById("fileSelectDeckLoader").addEventListener("change", function() {
	loadDeckFile(this.files[0]);
});

//loading card list in the deck selector
function loadDeckPreview(deck) {
	//add card list on the right
	//remove all cards already there
	document.getElementById("deckSelectorCardGrid").innerHTML = "";
	
	//scroll the list to top
	document.getElementById("deckSelectorCardGrid").scrollTop = 0;
	
	//add the cards
	let partnerAdded = false;
	deckUtils.deckToCardIdList(officialDecks[currentDeckList][deck]).forEach(cardId => {
		cardImg = document.createElement("img");
		cardImg.src = getCardImageFromID(cardId);
		cardImg.dataset.cardId = cardId;
		
		//make partner card glow
		if (cardId == officialDecks[currentDeckList][deck]["suggestedPartner"] && !partnerAdded) {
			partnerAdded = true;
			cardImg.classList.add("partnerHighlight");
		}
		
		document.getElementById("deckSelectorCardGrid").appendChild(cardImg);
		cardImg.addEventListener("click", function(e) {
			previewCard(this.dataset.cardId);
			e.stopPropagation();
		});
	});
	
	// set the description
	document.getElementById("deckSelectorDescription").textContent = officialDecks[currentDeckList][deck]["description"][locale.code] ?? officialDecks[currentDeckList][deck]["description"]["en"] ?? officialDecks[currentDeckList][deck]["description"]["ja"];
}

//loading decks into the deck list
async function addDecksToDeckSelector(deckList) {
	//empty the deck selector
	while (document.getElementById("deckList").firstChild) {
		document.getElementById("deckList").firstChild.remove();
	}
	currentDeckList = deckList;
	
	for (const deckID of officialDecks[deckList]) {
		await fetch("data/decks/" + deckID + ".deckx")
		.then(response => response.json())
		.then(deck => {
			officialDecks[currentDeckList][deckID] = deck;
			deckDiv = document.createElement("div");
			deckDiv.classList.add("bigButton");
			deckDiv.textContent = deck["name"][locale.code] ?? deck["name"]["en"] ?? deck["name"]["ja"] ?? "---";
			deckDiv.dataset.deck = deckID;
			
			cardAmountSubtitle = document.createElement("span");
			cardAmountSubtitle.classList.add("deckCardAmount");
			let cardAmount = deckUtils.countDeckCards(deck);
			cardAmountSubtitle.textContent = locale["deckListCardAmount"].replace("{#CARDS}", cardAmount);
			
			deckDiv.addEventListener("click", function() {
				if (document.getElementById("selectedDeck")) {
					document.getElementById("selectedDeck").id = "";
				}
				this.id = "selectedDeck";
				loadDeckPreview(this.dataset.deck);
			});
			
			
			deckDiv.appendChild(document.createElement("br"));
			deckDiv.appendChild(cardAmountSubtitle);
			document.getElementById("deckList").appendChild(deckDiv);
		})
	}
	
	//also remove all cards still on the right side, as selectedDeck will be wiped
	while (document.getElementById("deckSelectorCardGrid").firstChild) {
		document.getElementById("deckSelectorCardGrid").firstChild.remove();
	}
}

//selecting deck from the deck list
document.getElementById("loadSelectedDeckBtn").addEventListener("click", function() {
	if (!document.getElementById("selectedDeck")) {
		return;
	}
	
	loadDeck(officialDecks[currentDeckList][document.getElementById("selectedDeck").dataset.deck]);
	
	//reset selected deck, clear card list and close deck selector
	document.getElementById("selectedDeck").id = "";
	while (document.getElementById("deckSelectorCardGrid").firstChild) {
		document.getElementById("deckSelectorCardGrid").removeChild(document.getElementById("deckSelectorCardGrid").firstChild);
	}
	deckSelector.style.display = "none";
	overlayBackdrop.style.display = "none";
});

//opening the deck selector
document.getElementById("deckSelectSpan").addEventListener("click", function(e) {
	e.stopPropagation();
	currentDeckList = "default";
	addDecksToDeckSelector(currentDeckList);
	
	deckSelector.style.display = "flex";
	overlayBackdrop.style.display = "block";
});

//fetch deck lists from server
fetch("data/deckList.json")
.then(response => response.json())
.then(decks => {
	officialDecks = decks;
});

//deck selector deck list buttons
document.getElementById("defaultDecksBtn").addEventListener("click", function() {
	if (currentDeckList != "default") {
		currentDeckList = "default";
		addDecksToDeckSelector("default");
	}
});
document.getElementById("legacyDecksBtn").addEventListener("click", function() {
	if (currentDeckList != "legacy") {
		currentDeckList = "legacy";
		addDecksToDeckSelector("legacy");
	}
});

//partner selecting and revealing
document.getElementById("revealPartnerBtn").addEventListener("click", function() {
	document.getElementById("partnerRevealButtonDiv").style.display = "none";
	field17.src = "images/cardHidden.png";
	cardAreas["field17"].dropCard(loadedPartner);
	syncRevealPartner();
});

document.getElementById("chooseSuggestedPartnerBtn").addEventListener("click", function() {
	document.getElementById("partnerSelectQuestion").style.display = "none";
	finishDeckLoading();
});

document.getElementById("manualChoosePartnerBtn").addEventListener("click", function() {
	document.getElementById("partnerSelectQuestion").style.display = "none";
	
	openPartnerSelectMenu();
});