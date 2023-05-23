// getting a card's image link from its ID
function getCardImageFromID(cardId) {
	return "https://crossuniverse.net/images/cards/" + (locale.warnings.includes("noCards")? "en" : locale.code) + "/" + cardId + ".jpg";
}

function updateLifeDisplay(player) {
	let lifeDisplay = document.getElementById("lifeDisplay" + player.index);
	let lifeDisplayValue = parseInt(lifeDisplay.textContent);
	
	if (lifeDisplayValue == player.life) {
		return;
	}
	
	if (player.life > lifeDisplayValue) {
		lifeDisplay.textContent = lifeDisplayValue + 1;
	} else {
		lifeDisplay.textContent = lifeDisplayValue - 1;
	}
	
	window.setTimeout(function() {updateLifeDisplay(player);}, 15);
}

function updateManaDisplay(player) {
	document.getElementById("manaDisplay" + player.index).textContent = player.mana;
}

//opening a card selector
function openCardSelect(cardArea) {
	//add cards
	cardSelectorGrid.innerHTML = "";
	cardArea.cards.forEach((card, i) => {
		cardImg = document.createElement("img");
		cardImg.src = card.getImage();
		cardImg.dataset.cardIndex = i;
		cardImg.dataset.cardArea = cardArea.name;
		
		cardImg.addEventListener("dragstart", grabHandler);
		cardImg.addEventListener("dragstart", function() {
			cardSelector.style.display = "none";
			overlayBackdrop.style.display = "none";
		});
		cardImg.addEventListener("click", function(e) {
			previewCard(cardAreas[this.dataset.cardArea].cards[this.dataset.cardIndex]);
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