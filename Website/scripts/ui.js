//position the menu on the right if that option is enabled
if (localStorage.getItem("fieldLeftToggle") == "true") {
	document.documentElement.classList.add("leftField");
}


//life changes
document.getElementById("lifeUp100").addEventListener("click", function() {
	localPlayer.life += 100;
	updateLifeDisplay(localPlayer);
	syncLife();
});
document.getElementById("lifeUp50").addEventListener("click", function() {
	localPlayer.life += 50;
	updateLifeDisplay(localPlayer);
	syncLife();
});
document.getElementById("lifeUp1").addEventListener("click", function() {
	localPlayer.life += 1;
	updateLifeDisplay(localPlayer);
	syncLife();
});
document.getElementById("lifeDown100").addEventListener("click", function() {
	localPlayer.life = Math.max(localPlayer.life - 100, 0);
	updateLifeDisplay(localPlayer);
	syncLife();
});
document.getElementById("lifeDown50").addEventListener("click", function() {
	localPlayer.life = Math.max(localPlayer.life - 50, 0);
	updateLifeDisplay(localPlayer);
	syncLife();
});
document.getElementById("lifeDown1").addEventListener("click", function() {
	localPlayer.life = Math.max(localPlayer.life - 1, 0);
	updateLifeDisplay(localPlayer);
	syncLife();
});
document.getElementById("lifeHalf").addEventListener("click", function() {
	localPlayer.life = Math.ceil(localPlayer.life / 2);
	updateLifeDisplay(localPlayer);
	syncLife();
});

//mana changes
document.getElementById("manaUp").addEventListener("click", function() {
	localPlayer.mana++;
	updateManaDisplay(localPlayer);
	syncMana();
});
document.getElementById("manaFive").addEventListener("click", function() {
	localPlayer.mana = 5;
	updateManaDisplay(localPlayer);
	syncMana();
});
document.getElementById("manaDown").addEventListener("click", function() {
	localPlayer.mana = Math.max(localPlayer.mana - 1, 0);
	updateManaDisplay(localPlayer);
	syncMana();
});

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

document.getElementById("chatInput").addEventListener("keyup", function(e) {
	if (e.code == "Enter" && this.value != "") {
		socket.send("[chat]" + this.value);
		if (localStorage.getItem("username") !== "") {
			putChatMessage(localStorage.getItem("username") + locale["chat"]["colon"] + this.value);
		} else {
			putChatMessage(locale["chat"]["you"] + locale["chat"]["colon"] + this.value);
		}
		
		this.value = "";
	}
	if (e.code == "Escape") {
		this.blur();
	}
});

document.getElementById("chatInput").addEventListener("keydown", function(e) {
	e.stopPropagation();
});

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

//hiding/unhiding roomcode
function updateRoomCodeDisplay() {
	if (roomCodeShown) {
		document.getElementById("theRoomCode").textContent = roomcode;
		document.getElementById("theRoomCode").style.fontStyle = "normal";
		document.getElementById("roomCodeHider").textContent = locale["roomCodeHide"];
	} else {
		document.getElementById("theRoomCode").textContent = locale["roomCodeHidden"];
		document.getElementById("theRoomCode").style.fontStyle = "italic";
		document.getElementById("roomCodeHider").textContent = locale["roomCodeShow"];
	}
}

document.getElementById("roomCodeHider").addEventListener("click", function () {
	roomCodeShown = !roomCodeShown;
	updateRoomCodeDisplay();
});

//showing/hiding your hand
function hideHand() {
	syncHandHide();
	document.getElementById("showHandBtn").textContent = locale["actionsShowHand"];
	document.getElementById("showHandBtn").addEventListener("click", showHand, {once: true});
	document.getElementById("hand1").classList.remove("shown");
}
function showHand() {
	syncHandReveal();
	document.getElementById("showHandBtn").textContent = locale["actionsHideHand"];
	document.getElementById("showHandBtn").addEventListener("click", hideHand, {once: true});
	document.getElementById("hand1").classList.add("shown");
}

document.getElementById("showHandBtn").addEventListener("click", showHand, {once: true});

//disable right-click on field
document.getElementById("field").addEventListener("contextmenu", function (e) {e.preventDefault();});

// selecting starting player
document.getElementById("startingPlayerSelect").addEventListener("click", function() {
	document.getElementById("startingPlayerSelect").style.display = "none";
	let startingPlayer = Math.random() > .5;
	putChatMessage(startingPlayer? locale["youStart"] : locale["opponentStarts"], "notice");
	socket.send("[selectPlayer]" + startingPlayer);
	partnerRevealButtonDiv.style.display = "block";
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
	cardDetailsLevelType.textContent = locale["cardDetailsInfoString"].replace("{#LEVEL}", card.getLevel() == -1? locale["cardDetailsQuestionMark"] : card.getLevel()).replace("{#CARDTYPE}", locale[card.getCardType() + "CardDetailType"]);
	if (card.getTypes().length > 0) {
		cardDetailsTypes.textContent = locale["cardDetailsTypes"] + card.getTypes().map(type => locale["type" + type]).join(locale["typeSeparator"]);
	} else {
		cardDetailsTypes.textContent = locale["typeless"];
	}
	
	// attack & defense
	if (card.getCardType() == "unit" || card.getCardType() == "token") {
		cardDetailsAttackDefense.style.display = "flex";
		cardDetailsAttack.innerHTML = locale["cardDetailsAttack"] + (card.getAttack() == -1? locale["cardDetailsQuestionMark"] : card.getAttack());
		cardDetailsDefense.innerHTML = locale["cardDetailsDefense"] + (card.getDefense() == -1? locale["cardDetailsQuestionMark"] : card.getDefense());
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