
import {locale} from "/modules/locale.js";
import {getCardInfo, getCardImage} from "/modules/cardLoader.js";

let currentPreviewedCard = null;

chatHeader.textContent = locale.chat.title;
chatInput.placeholder = locale.chat.enterMessage;

cardDetailsAttack.textContent = locale.cardDetailsAttack;
cardDetailsDefense.textContent = locale.cardDetailsDefense;
cardDetailsLevel.textContent = locale.cardDetailsLevel;
cardDetailsLevelTypeSeparator.textContent = locale.cardDetailsLevelTypeSeparator;
cardDetailsTypes.textContent = locale.cardDetailsTypes;

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
	cardDetailsImage.style.backgroundImage = "url(" + (await getCardImage(card)) + ")";

	return updateCardPreview(card);
}

export async function updateCardPreview(card) {
	if (currentPreviewedCard != card) {
		return;
	}
	// general info
	insertCardValueList(card, "names", cardDetailsName, "/", async (name) => (await getCardInfo(name)).name);

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
		let effects = (await getCardInfo(card.cardId)).effects;
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