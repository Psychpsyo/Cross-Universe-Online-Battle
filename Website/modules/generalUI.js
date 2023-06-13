
import {locale} from "/modules/locale.js";
import {getCardInfo, getCardImage} from "/modules/cardLoader.js";

let currentPreviewedCard = null;

chatHeader.textContent = locale.chat.title;
chatInput.placeholder = locale.chat.enterMessage;

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

	// set the text preview
	// general info
	let names = card.names.get().map(async (name) => (await getCardInfo(name)).name);
	Promise.allSettled(names).then(names => {
		cardDetailsName.textContent = names.map(name => name.value).join("/");
	});
	let cardTypes = [...card.cardTypes.get()];
	if (cardTypes.includes("token")) {
		cardTypes.splice(cardTypes.indexOf("unit"), 1);
	}
	if (cardTypes.includes("spell")) {
		cardTypes.splice(cardTypes.indexOf("spell"), 1);
	}
	if (cardTypes.includes("item")) {
		cardTypes.splice(cardTypes.indexOf("item"), 1);
	}
	cardDetailsLevelType.textContent = locale.cardDetailsInfoString.replace("{#LEVEL}", card.level.get() == -1? "?" : card.level.get()).replace("{#CARDTYPE}", cardTypes.map(type => locale[type + "CardDetailType"]).join("/"));
	if (card.types.get().length > 0) {
		cardDetailsTypes.textContent = locale.cardDetailsTypes + card.types.get().map(type => locale.types[type]).join(locale.typeSeparator);
	} else {
		cardDetailsTypes.textContent = locale.typeless;
	}

	// attack & defense
	if (card.cardTypes.get().includes("unit")) {
		cardDetailsAttackDefense.style.display = "flex";
		cardDetailsAttack.innerHTML = locale.cardDetailsAttack + (card.attack.get() == -1? "?" : card.attack.get());
		cardDetailsDefense.innerHTML = locale.cardDetailsDefense + (card.defense.get() == -1? "?" : card.defense.get());
	} else {
		cardDetailsAttackDefense.style.display = "none";
	}

	// effects
	cardDetailsEffectList.innerHTML = "";
	if (!card.cardId.startsWith("C")) {
		(await getCardInfo(card.cardId)).effects.forEach(effect => {
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
		});
	}

	cardDetails.style.setProperty("--side-distance", ".5em");
}