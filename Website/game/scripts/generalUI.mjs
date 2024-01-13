
import {locale} from "/scripts/locale.mjs";
import {deckToCardIdList} from "/scripts/deckUtils.mjs";
import {Card} from "/rulesEngine/src/card.mjs";
import {socket} from "./netcode.mjs";
import * as cardLoader from "/scripts/cardLoader.mjs";
import * as abilities from "/rulesEngine/src/abilities.mjs";

const abilityTypes = new Map([
	[abilities.CastAbility, "cast"],
	[abilities.DeployAbility, "deploy"],
	[abilities.FastAbility, "fast"],
	[abilities.OptionalAbility, "optional"],
	[abilities.StaticAbility, "static"],
	[abilities.TriggerAbility, "trigger"]
]);

let currentPreviewedCard = null;

// used for profile pictures here but also used for things like the cool attack visuals by automatic games
export const cardAlignmentInfo = await fetch("../data/profilePictureInfo.json").then(async response => await response.json());

export function createAbilityFragment(abilityText) {
	const fragment = new DocumentFragment();

	let indentCount = 0; // how many characters to un-indent
	let marginCount = 0; // how much of a margin to put
	// margin and indent count are different so that whitespace can be cut out while still being margined
	let indentChars = ["　", "●", "：", locale.subEffectOpeningBracket];
	abilityText.split("\n").forEach(line => {
		const lineDiv = document.createElement("div");

		// recalculate indentation if necessary
		if (indentChars.includes(line[0])) {
			// recalculate indentation amount
			indentCount = 0;
			marginCount = 0;
			while (line[0] === "　") {
				marginCount++;
				line = line.substring(1);
			}
			while (indentChars.includes(line[indentCount])) {
				indentCount++;
				marginCount++;
			}
		}

		// indent the line
		if (marginCount > 0) {
			lineDiv.classList.add("cardDetailsIndent");
			lineDiv.style.setProperty("--indent-amount", indentCount + "em");
			lineDiv.style.setProperty("--margin-amount", marginCount + "em");
		}

		lineDiv.textContent = line;
		fragment.appendChild(lineDiv);
	});

	return fragment;
}


// chat box
let allEmoji = ["card", "haniwa", "candle", "dice", "medusa", "barrier", "contract", "rei", "trooper", "gogo", "gogo_mad", "wingL", "wingR", "knight"];
export function putChatMessage(message, type, cards) {
	let messageDiv = document.createElement("div");

	while (message.indexOf(":") != -1) {
		if (message.indexOf(":", message.indexOf(":") + 1) == -1) {
			break;
		}
		let foundEmoji = message.substring(message.indexOf(":") + 1, message.indexOf(":", message.indexOf(":") + 1));
		if (allEmoji.includes(foundEmoji)) {
			messageDiv.appendChild(document.createTextNode(message.substring(0, message.indexOf(":"))));
			let emojiImg = document.createElement("img");
			emojiImg.src = "images/emoji/" + foundEmoji + ".png";
			emojiImg.classList.add("emoji");
			emojiImg.alt = ":" + foundEmoji + ":";
			emojiImg.title = ":" + foundEmoji + ":";
			emojiImg.draggable = false;
			messageDiv.appendChild(emojiImg);
			message = message.substring(message.indexOf(":", message.indexOf(":") + 1) + 1);
		} else {
			messageDiv.appendChild(document.createTextNode(message.substring(0, message.indexOf(":", message.indexOf(":") + 1))));
			message = message.substring(message.indexOf(":", message.indexOf(":") + 1));
		}
	}
	messageDiv.appendChild(document.createTextNode(message));

	if (cards) {
		let cardHolder = document.createElement("div");
		cardHolder.classList.add("chatCardHolder");
		for (let card of cards) {
			if (card.hiddenFor.includes(localPlayer) && card.current()) {
				card = card.current().snapshot();
			}
			let cardImg = document.createElement("img");
			cardImg.src = cardLoader.getCardImage(card);
			cardImg.addEventListener("click", function () {
				previewCard(card);
			});
			cardImg.addEventListener("dragstart", e => e.preventDefault());
			cardHolder.appendChild(cardImg);
		}
		messageDiv.appendChild(cardHolder);
	}

	if (type) {
		messageDiv.classList.add(type);
	}
	chatBox.appendChild(messageDiv);
	chatBox.scrollTop = chatBox.scrollHeight - chatBox.clientHeight;
}

export function closeCardPreview() {
	cardDetails.style.setProperty("--side-distance", "-50vh");
	currentPreviewedCard = null;
}

// previews a card
export async function previewCard(card, specific = true) {
	if (!card?.cardId || card.hiddenFor.includes(localPlayer)) {
		return;
	}
	// if the already shown card was clicked again
	if ((currentPreviewedCard == card && specific) || (currentPreviewedCard?.cardId == card.cardId && !specific)) {
		closeCardPreview();
		return;
	}
	currentPreviewedCard = card;

	// set the image preview
	cardDetailsImage.style.backgroundImage = "url(" + cardLoader.getCardImage(card, localStorage.getItem("opponentCardLanguage") === "true" && localStorage.getItem("previewCardLanguage") === "true") + ")";

	return updateCardPreview(card);
}

export async function updateCardPreview(card) {
	if (currentPreviewedCard != card) {
		return;
	}
	// general info
	insertCardValueList(card, "names", cardDetailsName, "/", async (name) => (await cardLoader.getCardInfo(name)).name);

	let cardTypes = [...card.values.current.cardTypes];
	if (card.isToken) {
		cardTypes.splice(cardTypes.indexOf("unit"), 1);
		cardTypes.push("token");
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
	if (card.values.current.cardTypes.includes("unit")) {
		cardDetailsAttackDefense.style.display = "flex";
		insertCardValue(card, "attack", cardDetailsAttackValues);
		insertCardValue(card, "defense", cardDetailsDefenseValues);
	} else {
		cardDetailsAttackDefense.style.display = "none";
	}

	// effects
	let effectDivs = [];
	if (!card.cardId.startsWith("C")) {
		// insert rule sections from the API since the card object does not specify how many there are.
		let effects = (await cardLoader.getCardInfo(card.cardId)).effects;
		for (const effect of effects) {
			if (effect.type === "rule") {
				effectDivs.push(createDomEffect(effect.type, effect.text));
			}
		}

		// all other effects come from the card object.
		for (const ability of card.values.current.abilities) {
			let divClasses = [];
			if (!card.values.base.abilities.includes(ability)) {
				divClasses.push("valueAdded");
			}
			if (ability.isCancelled) {
				divClasses.push("valueGone");
			}
			effectDivs.push(createDomEffect(abilityTypes.get(ability.constructor), await cardLoader.getAbilityText(ability.id), divClasses));
		}
	}
	// all at once to prevent getting too many effects when this function is called multiple times at once.
	cardDetailsEffectList.innerHTML = "";
	for (const div of effectDivs) {
		cardDetailsEffectList.appendChild(div);
	}

	cardDetails.style.setProperty("--side-distance", ".5em");
}

function createDomEffect(type, content, classNames = []) {
	let effectDiv = document.createElement("div");
	effectDiv.classList.add("cardDetailsEffect");
	for (const className of classNames) {
		effectDiv.classList.add(className);
	}

	if (type != "rule") { // 'rule' effects get no title
		let effectTitle = document.createElement("span");
		effectTitle.textContent = locale[type + "CardDetailEffect"];
		effectDiv.appendChild(effectTitle);
		effectDiv.appendChild(document.createElement("br"));
	}

	effectDiv.appendChild(createAbilityFragment(content));

	return effectDiv;
}

function insertCardValue(card, value, target) {
	target.innerHTML = "";
	insertCardValueText(card.values.base[value] == -1? "?" : card.values.base[value], target, card.values.base[value] == card.values.current[value]? null : "valueGone");
	if (card.values.base[value] != card.values.current[value]) {
		target.appendChild(document.createTextNode(" "));
		insertCardValueText(card.values.current[value] == -1? "?" : card.values.current[value], target, "valueAdded");
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
	for (let value of card.values.base[valueName]) {
		if (valueAdded) {
			target.appendChild(document.createTextNode(separator));
		}
		let valueSpan = document.createElement("span");
		localizer(value).then(localizedValue => {
			valueSpan.textContent = localizedValue;
		});
		if (!card.values.current[valueName].includes(value)) {
			valueSpan.classList.add("valueGone");
		}
		target.appendChild(valueSpan);
		valueAdded = true;
	}
	if (card.values.base[valueName].length == 0) {
		insertCardValueText(noneText, target, card.values.current[valueName].length == 0? null : "valueGone");
		target.appendChild(document.createTextNode(" "));
	}
	for (let value of card.values.current[valueName]) {
		if (card.values.base[valueName].includes(value)) {
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
	if (card.values.base[valueName].length != 0 && card.values.current[valueName].length == 0) {
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
			previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId)), false);
		});
	});

	// set the name
	if (deck.name) {
		deckViewTitle.classList.remove("greyedOut");
		deckViewTitle.textContent = deck.name[locale.code] ?? deck.name.en ?? deck.name[Object.keys(deck.description)[0]] ?? "";
	} else {
		deckViewTitle.textContent = "";
	}
	if (deckViewTitle.textContent === "") {
		deckViewTitle.textContent = locale.game.deckSelect.unnamedDeck;
		deckViewTitle.classList.add("greyedOut");
	}

	// set the description
	if (deck.description) {
		deckSelectorDescription.textContent = deck.description[locale.code] ?? deck.description.en ?? deck.description[Object.keys(deck.description)[0]] ?? "";
		deckSelectorDescription.classList.remove("greyedOut");
	} else {
		deckSelectorDescription.textContent = "";
	}
	if (deckSelectorDescription.textContent === "") {
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

// init function
export function init() {
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
			loadDeckPreview(players[i].deck);
			openDeckView();
		});
	}

	// profile pictures
	for (let i = 0; i < 2; i++) {
		document.getElementById("username" + i).textContent = players[i].name;
		document.getElementById("profilePicture" + i).style.backgroundImage = "url('" + cardLoader.getCardImageFromID(players[i].profilePicture) + "')";
		if (cardAlignmentInfo[players[i].profilePicture]?.left) {
			document.getElementById("profilePicture" + i).style.backgroundPositionX = cardAlignmentInfo[players[i].profilePicture].left + "%";
		}
	}
	if (!cardAlignmentInfo[players[0].profilePicture]?.flip && !cardAlignmentInfo[players[0].profilePicture]?.neverFlip) {
		profilePicture0.style.transform = "scaleX(-1)";
	}
	if (cardAlignmentInfo[players[1].profilePicture]?.flip) {
		profilePicture1.style.transform = "scaleX(-1)";
	}

	// chat
	document.getElementById("chatInput").addEventListener("keyup", function(e) {
		if (e.code == "Enter" && this.value != "") {
			socket.send("[chat]" + this.value);
			putChatMessage(players[1].name + locale["chat"]["colon"] + this.value);
			this.value = "";
		}
		if (e.code == "Escape") {
			this.blur();
		}
	});
	document.getElementById("chatInput").addEventListener("keydown", function(e) {
		e.stopPropagation();
	});


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


	// selecting deck from the deck selector list
	deckSelector.addEventListener("click", function(e) {
		if (e.target == document.getElementById("deckSelector")) {
			closeDeckView();
		}
	});
}