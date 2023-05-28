//position the menu on the right if that option is enabled
if (localStorage.getItem("fieldLeftToggle") == "true") {
	document.documentElement.classList.add("leftField");
}

//chat box
allEmoji = ["card", "haniwa", "candle", "dice", "medusa", "barrier", "contract", "rei", "trooper", "gogo", "gogo_mad", "wingL", "wingR", "knight"];
function putChatMessage(message, type) {
	let messageSpan = document.createElement("div");
	
	while (message.indexOf(":") != -1) {
		if (message.indexOf(":", message.indexOf(":") + 1) == -1) {
			break;
		}
		let foundEmoji = message.substr(message.indexOf(":") + 1, message.indexOf(":", message.indexOf(":") + 1) - (message.indexOf(":") + 1));
		if (allEmoji.includes(foundEmoji)) {
			messageSpan.appendChild(document.createTextNode(message.substr(0, message.indexOf(":"))));
			let emojiImg = document.createElement("img");
			emojiImg.src = "images/emoji/" + foundEmoji + ".png";
			emojiImg.classList.add("emoji");
			emojiImg.alt = ":" + foundEmoji + ":";
			emojiImg.title = ":" + foundEmoji + ":";
			emojiImg.draggable = false;
			messageSpan.appendChild(emojiImg);
			message = message.substr(message.indexOf(":", message.indexOf(":") + 1) + 1);
		} else {
			messageSpan.appendChild(document.createTextNode(message.substr(0, message.indexOf(":", message.indexOf(":") + 1))));
			message = message.substr(message.indexOf(":", message.indexOf(":") + 1));
		}
	}
	
	messageSpan.appendChild(document.createTextNode(message));
	if (type) {
		messageSpan.classList.add(type);
	}
	chatBox.appendChild(messageSpan);
	chatBox.scrollTop = chatBox.scrollHeight - chatBox.clientHeight
}

//closing the card selector when clicking off of it
overlayBackdrop.addEventListener("click", function() {
	// does not work for partner select menu
	if (window.getComputedStyle(partnerSelectionMenu).display != "none") {
		return;
	}
	cardSelector.style.display = "none";
	if (typeof deckSelector !== "undefined") {
		deckSelector.style.display = "none";
	}
	overlayBackdrop.style.display = "none";
});

// card preview
function closeCardPreview() {
	cardDetails.style.setProperty("--side-distance", "-50vh");
	cardDetails.dataset.currentCard = "";
	cardDetailsImage.dataset.open = false;
}

document.addEventListener("click", function() {
	if (localStorage.getItem("autoClosePreview") === "true") {
		closeCardPreview();
	}
});

cardDetails.addEventListener("click", function(e) {
	// make the click not pass through to the document to close the preview.
	e.stopPropagation();
});
cardDetailsSwitch.addEventListener("click", function(e) {
	cardDetailsImage.style.display = window.getComputedStyle(cardDetailsImage).display == "none"? "revert" : "none";
	e.stopPropagation();
});
cardDetailsClose.addEventListener("click", closeCardPreview);

// previews a card
function previewCard(card) {
	if (!card?.cardId || card.hidden) {
		return;
	}
	// if the already shown card was clicked again
	if (cardDetails.dataset.currentCard == card.cardId) {
		closeCardPreview();
		return;
	}
	cardDetails.dataset.currentCard = card.cardId;
	
	// set the image preview
	cardDetailsImage.style.backgroundImage = "url(" + card.getImage() + ")";
	
	// set the text preview
	// general info
	cardDetailsName.textContent = card.getName();
	let cardTypes = [...card.getCardTypes()];
	if (cardTypes.includes("token")) {
		cardTypes.splice(cardTypes.indexOf("unit"), 1);
	}
	if (cardTypes.includes("spell")) {
		cardTypes.splice(cardTypes.indexOf("spell"), 1);
	}
	if (cardTypes.includes("item")) {
		cardTypes.splice(cardTypes.indexOf("item"), 1);
	}
	cardDetailsLevelType.textContent = locale["cardDetailsInfoString"].replace("{#LEVEL}", card.getLevel() == -1? "?" : card.getLevel()).replace("{#CARDTYPE}", cardTypes.map(type => locale[type + "CardDetailType"]).join("/"));
	if (card.getTypes().length > 0) {
		cardDetailsTypes.textContent = locale["cardDetailsTypes"] + card.getTypes().map(type => locale["types"][type]).join(locale["typeSeparator"]);
	} else {
		cardDetailsTypes.textContent = locale["typeless"];
	}
	
	// attack & defense
	if (card.getCardTypes().includes("unit")) {
		cardDetailsAttackDefense.style.display = "flex";
		cardDetailsAttack.innerHTML = locale["cardDetailsAttack"] + (card.getAttack() == -1? "?" : card.getAttack());
		cardDetailsDefense.innerHTML = locale["cardDetailsDefense"] + (card.getDefense() == -1? "?" : card.getDefense());
	} else {
		cardDetailsAttackDefense.style.display = "none";
	}
	
	// effects
	cardDetailsEffectList.innerHTML = "";
	if (!card.cardId.startsWith("C")) {
		game.cardData[card.cardId].effects.forEach(effect => {
			let effectDiv = document.createElement("div");
			effectDiv.classList.add("cardDetailsEffect");
			
			if (effect.type != "rule") { // 'rule' effects get no title
				let effectTitle = document.createElement("span");
				effectTitle.textContent = locale[effect.type + "CardDetailEffect"];
				effectDiv.appendChild(effectTitle);
				effectDiv.appendChild(document.createElement("br"));
			}
			
			let indentCount = 0;
			let indentChars = ["　", "●", "：", locale["subEffectOpeningBracket"]];
			effect.text.split("\n").forEach(line => {
				let lineDiv = document.createElement("div");
				lineDiv.textContent = line;
				
				// recalculate indentation if necessary
				if (indentChars.includes(line[0])) {
					// recalculate indentation amount
					indentCount = 0;
					while (indentChars.includes(line[indentCount])) {
						indentCount++;
					}
				}
				
				// indent the line
				if (indentCount > 0) {
					lineDiv.classList.add("cardDetailsIndent");
					lineDiv.style.setProperty("--indent-amount", indentCount + "em");
				}
				
				effectDiv.appendChild(lineDiv);
			});
			
			cardDetailsEffectList.appendChild(effectDiv);
		});
	}
	
	cardDetails.style.setProperty("--side-distance", ".5em");
	cardDetailsImage.dataset.open = true;
}