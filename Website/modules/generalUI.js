
import {locale} from "/modules/locale.js";
import {deckToCardIdList} from "/modules/deckUtils.js";
import {Card} from "/rulesEngine/card.js";
import * as cardLoader from "/modules/cardLoader.js";

let currentPreviewedCard = null;

chatHeader.textContent = locale.chat.title;
chatInput.placeholder = locale.chat.enterMessage;

cardDetailsAttack.textContent = locale.cardDetailsAttack;
cardDetailsDefense.textContent = locale.cardDetailsDefense;
cardDetailsLevel.textContent = locale.cardDetailsLevel;
cardDetailsLevelTypeSeparator.textContent = locale.cardDetailsLevelTypeSeparator;
cardDetailsTypes.textContent = locale.cardDetailsTypes;

infoPanelVS.textContent = locale.game.playerInfo.vs;
for (let i = 0; i < 2; i++) {
	document.getElementById("playerDeckButton" + i).title = locale.game.playerInfo.viewDeck;
	document.getElementById("playerDeckButtonImage" + i).alt = locale.game.playerInfo.viewDeck;
	document.getElementById("playerDeckButton" + i).addEventListener("click", function() {
		let deck = players[i].deck;
		if (deck.name) {
			deckViewTitle.classList.remove("greyedOut");
			deckViewTitle.textContent = deck.name[locale.code] ?? deck.name.en ?? deck.name[Object.keys(deck.description)[0]] ?? "";
		} else {
			deckViewTitle.textContent = "";
		}
		if (deckViewTitle.textContent == "") {
			deckViewTitle.textContent = locale.game.deckSelect.unnamedDeck;
			deckViewTitle.classList.add("greyedOut");
		}
		loadDeckPreview(deck);
		openDeckView();
	});
}

// chat box
let allEmoji = ["card", "haniwa", "candle", "dice", "medusa", "barrier", "contract", "rei", "trooper", "gogo", "gogo_mad", "wingL", "wingR", "knight"];
export function putChatMessage(message, type) {
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

// card preview
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
cardDetails.show();

export function closeCardPreview() {
	cardDetails.style.setProperty("--side-distance", "-50vh");
	currentPreviewedCard = null;
}

// previews a card
export async function previewCard(card, specific = true) {
	if (!card?.cardId || card.hidden) {
		return;
	}
	// if the already shown card was clicked again
	if ((currentPreviewedCard == card && specific) || (currentPreviewedCard?.cardId == card.cardId && !specific)) {
		closeCardPreview();
		return;
	}
	currentPreviewedCard = card;

	// set the image preview
	cardDetailsImage.style.backgroundImage = "url(" + (await cardLoader.getCardImage(card)) + ")";

	return updateCardPreview(card);
}

export async function updateCardPreview(card) {
	if (currentPreviewedCard != card) {
		return;
	}
	// general info
	insertCardValueList(card, "names", cardDetailsName, "/", async (name) => (await cardLoader.getCardInfo(name)).name);

	let cardTypes = [...card.values.cardTypes];
	if (cardTypes.includes("token")) {
		cardTypes.splice(cardTypes.indexOf("unit"), 1);
	}
	if (cardTypes.includes("spell")) {
		cardTypes.splice(cardTypes.indexOf("spell"), 1);
	}
	if (cardTypes.includes("item")) {
		cardTypes.splice(cardTypes.indexOf("item"), 1);
	}

	insertCardValue(card, "level", cardDetailsLevelValues);
	cardDetailsTypeValues.textContent = cardTypes.map(type => locale[type + "CardDetailType"]).join("/");

	insertCardValueList(card, "types", cardDetailsTypesValues, locale.typeSeparator, async (type) => locale.types[type], locale.typeless);

	// attack & defense
	if (card.values.cardTypes.includes("unit")) {
		cardDetailsAttackDefense.style.display = "flex";
		insertCardValue(card, "attack", cardDetailsAttackValues);
		insertCardValue(card, "defense", cardDetailsDefenseValues);
	} else {
		cardDetailsAttackDefense.style.display = "none";
	}

	// effects
	cardDetailsEffectList.innerHTML = "";
	if (!card.cardId.startsWith("C")) {
		let effects = (await cardLoader.getCardInfo(card.cardId)).effects;
		cardDetailsEffectList.innerHTML = "";
		for (let effect of effects) {
			let effectDiv = document.createElement("div");
			effectDiv.classList.add("cardDetailsEffect");

			if (effect.type != "rule") { // 'rule' effects get no title
				let effectTitle = document.createElement("span");
				effectTitle.textContent = locale[effect.type + "CardDetailEffect"];
				effectDiv.appendChild(effectTitle);
				effectDiv.appendChild(document.createElement("br"));
			}

			let indentCount = 0;
			let indentChars = ["　", "●", "：", locale.subEffectOpeningBracket];
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
		}
	}

	cardDetails.style.setProperty("--side-distance", ".5em");
}

function insertCardValue(card, value, target) {
	target.innerHTML = "";
	insertCardValueText(card.baseValues[value] == -1? "?" : card.baseValues[value], target, card.baseValues[value] == card.values[value]? null : "valueGone");
	if (card.baseValues[value] != card.values[value]) {
		target.appendChild(document.createTextNode(" "));
		insertCardValueText(card.values[value] == -1? "?" : card.values[value], target, "valueAdded");
	}
}

function insertCardValueText(string, target, className) {
	let valueSpan = document.createElement("span");
	valueSpan.textContent = string;
	if (className) {
		valueSpan.classList.add(className);
	}
	target.appendChild(valueSpan);
}

function insertCardValueList(card, valueName, target, separator, localizer, noneText = "---") {
	target.innerHTML = "";
	let valueAdded = false;
	for (let value of card.baseValues[valueName]) {
		if (valueAdded) {
			target.appendChild(document.createTextNode(separator));
		}
		let valueSpan = document.createElement("span");
		localizer(value).then(localizedValue => {
			valueSpan.textContent = localizedValue;
		});
		if (!card.values[valueName].includes(value)) {
			valueSpan.classList.add("valueGone");
		}
		target.appendChild(valueSpan);
		valueAdded = true;
	}
	if (card.baseValues[valueName].length == 0) {
		insertCardValueText(noneText, target, card.values[valueName].length == 0? null : "valueGone");
		target.appendChild(document.createTextNode(" "));
	}
	for (let value of card.values[valueName]) {
		if (card.baseValues[valueName].includes(value)) {
			continue;
		}
		if (valueAdded) {
			target.appendChild(document.createTextNode(separator));
		}
		let valueSpan = document.createElement("span");
		localizer(value).then(localizedValue => {
			valueSpan.textContent = localizedValue;
		});
		valueSpan.classList.add("valueAdded");
		target.appendChild(valueSpan);
		valueAdded = true;
	}
	if (card.baseValues[valueName].length != 0 && card.values[valueName].length == 0) {
		target.appendChild(document.createTextNode(separator));
		insertCardValueText(noneText, target, "valueAdded");
	}
}

// showing a deck in the deck view
export function loadDeckPreview(deck) {
	// remove existing cards
	document.getElementById("deckSelectorCardGrid").innerHTML = "";
	document.getElementById("deckSelectorCardGrid").scrollTop = 0;

	//add new cards
	let partnerAdded = false;
	deckToCardIdList(deck).forEach(cardId => {
		let cardImg = document.createElement("img");
		cardImg.src = cardLoader.getCardImageFromID(cardId);
		cardImg.dataset.cardId = cardId;

		// make partner card glow
		if (cardId == deck.suggestedPartner && !partnerAdded) {
			partnerAdded = true;
			cardImg.classList.add("cardHighlight");
		}

		document.getElementById("deckSelectorCardGrid").appendChild(cardImg);
		cardImg.addEventListener("click", async function(e) {
			e.stopPropagation();
			previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId), false), false);
		});
	});

	// set the description
	if (deck.description) {
		deckSelectorDescription.textContent = deck.description[locale.code] ?? deck.description.en ?? deck.description[Object.keys(deck.description)[0]] ?? "";
		deckSelectorDescription.classList.remove("greyedOut");
	} else {
		deckSelectorDescription.textContent = "";
	}
	if (deckSelectorDescription.textContent == "") {
		deckSelectorDescription.textContent = locale.game.deckSelect.noDescriptionSet;
		deckSelectorDescription.classList.add("greyedOut");
	}
}

export function openDeckView() {
	deckSelector.showModal();
	deckSelector.appendChild(cardDetails);
}
export function closeDeckView() {
	gameFlexBox.appendChild(cardDetails);
	deckSelector.close();
}

// selecting deck from the deck list
deckSelector.addEventListener("click", function(e) {
	if (e.target == document.getElementById("deckSelector")) {
		closeDeckView();
	}
});