
import {locale} from "../../scripts/locale.mjs";
import {deckToCardIdList} from "../../scripts/deckUtils.mjs";
import {Card} from "../../rulesEngine/src/card.mjs";
import {netSend} from "./netcode.mjs";
import "../../scripts/profilePicture.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as abilities from "../../rulesEngine/src/abilities.mjs";

const abilityTypes = new Map([
	[abilities.CastAbility, "cast"],
	[abilities.DeployAbility, "deploy"],
	[abilities.FastAbility, "fast"],
	[abilities.OptionalAbility, "optional"],
	[abilities.StaticAbility, "static"],
	[abilities.TriggerAbility, "trigger"]
]);

let currentPreviewedCard = null;
let currentHighlightedEffect = null;

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

// chat
let isTyping = false;
chat.addEventListener("message", function(e) {
	netSend("chat", e.data);
	this.putMessage(playerData[localPlayer.index].name + locale["chat"]["colon"] + e.data);
});
chat.inputField.addEventListener("input", () => {
	if (!isTyping) {
		isTyping = true;
		netSend("startTyping");
	}
});
chat.inputField.addEventListener("blur", () => {
	if (isTyping) {
		isTyping = false;
		netSend("stopTyping");
	}
});

// card previewing
export function closeCardPreview() {
	cardDetails.style.setProperty("--side-distance", "-50vh");
	currentPreviewedCard = null;
}

export async function previewCard(card, specific = true, highlightedEffect = null) {
	if (!card?.cardId || (localPlayer? card.hiddenFor.includes(localPlayer) : card.hiddenFor.length > 0)) {
		return;
	}
	// if the already shown card was clicked again, close the preview
	const alreadyShowingThisCard = (currentPreviewedCard === card && specific) || (currentPreviewedCard?.cardId === card.cardId && !specific);
	// except if we need to switch to the other view to highlight an effect
	const showingCardInRightMode = highlightedEffect === null || cardDetailsImage.style.display === "none";
	if (alreadyShowingThisCard && showingCardInRightMode) {
		closeCardPreview();
		return;
	}
	currentPreviewedCard = card;

	// if an effect should be highlighted, switch to that view
	if (highlightedEffect !== null) {
		cardDetailsImage.style.display = "none";
	} else {
		cardDetailsImage.style.display = localStorage.getItem("cardPreviewImagePreference") === "true"? "revert" : "none";
	}

	// set the image preview
	const useOwnerLanguage = localStorage.getItem("opponentCardLanguage") === "true" && localStorage.getItem("previewCardLanguage") === "true";
	cardDetailsImage.style.backgroundImage = `url(${cardLoader.getCardImage(card, undefined, useOwnerLanguage)}), url(${cardLoader.getCardImage(card, "tiny", useOwnerLanguage)})`;

	return updateCardPreview(card, highlightedEffect);
}

export async function updateCardPreview(card, highlightedEffect) {
	if (currentPreviewedCard != card) {
		return;
	}
	// this is so that a card's already displayed values can be updated without caring about which effect needs to be highlighted
	if (highlightedEffect !== undefined) {
		currentHighlightedEffect = highlightedEffect;
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
	cardDetailsTypeValues.textContent = cardTypes.map(type => locale.cardDetails.cardTypes[type]).join("/");

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
		for (const effect of (await cardLoader.getCardInfo(card.cardId)).effects) {
			if (effect.type === "rule") {
				effectDivs.push(createDomEffect(effect.type, effect.text));
			}
		}

		// all other effects come from the card object.
		let currentEffect = 0;
		for (const ability of card.values.current.abilities) {
			let divClasses = [];
			if (!card.values.base.abilities.includes(ability)) {
				divClasses.push("valueAdded");
			}
			if (ability.isCancelled) {
				divClasses.push("valueGone");
			}
			if (currentEffect === currentHighlightedEffect) {
				divClasses.push("valueHighlighted");
			}
			effectDivs.push(createDomEffect(abilityTypes.get(ability.constructor), await cardLoader.getAbilityText(ability.id), divClasses));
			currentEffect++;
		}
	}
	// all at once to prevent getting too many effects when this function is called multiple times at once.
	cardDetailsEffectList.innerHTML = "";
	for (let i = 0; i < effectDivs.length; i++) {
		cardDetailsEffectList.appendChild(effectDivs[i]);
		if (i < effectDivs.length - 1) {
			cardDetailsEffectList.appendChild(document.createElement("hr"));
		}
	}

	cardDetails.style.setProperty("--side-distance", ".5em");
}

function createDomEffect(type, content, classNames = []) {
	const effectDiv = document.createElement("div");
	effectDiv.title = locale.cardDetails.effectDescriptions[type];
	effectDiv.classList.add("cardDetailsEffect");
	for (const className of classNames) {
		effectDiv.classList.add(className);
	}

	if (type != "rule") { // 'rule' effects get no title
		const effectTitle = document.createElement("span");
		effectTitle.textContent = locale.cardDetails.effectNames[type];
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
		cardImg.src = cardLoader.getCardImageFromID(cardId, "tiny");
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
		deckViewTitle.classList.remove("textPlaceholder");
		deckViewTitle.textContent = deck.name[locale.code] ?? deck.name.en ?? deck.name[Object.keys(deck.description)[0]] ?? "";
	} else {
		deckViewTitle.textContent = "";
	}
	if (deckViewTitle.textContent === "") {
		deckViewTitle.textContent = locale.game.deckSelect.unnamedDeck;
		deckViewTitle.classList.add("textPlaceholder");
	}

	// set the description
	if (deck.description) {
		deckSelectorDescription.textContent = deck.description[locale.code] ?? deck.description.en ?? deck.description[Object.keys(deck.description)[0]] ?? "";
		deckSelectorDescription.classList.remove("textPlaceholder");
	} else {
		deckSelectorDescription.textContent = "";
	}
	if (deckSelectorDescription.textContent === "") {
		deckSelectorDescription.textContent = locale.game.deckSelect.noDescriptionSet;
		deckSelectorDescription.classList.add("textPlaceholder");
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
	cardDetailsAttack.textContent = locale.cardDetails.attack;
	cardDetailsDefense.textContent = locale.cardDetails.defense;
	cardDetailsLevel.textContent = locale.cardDetails.level;
	cardDetailsLevelTypeSeparator.textContent = locale.cardDetails.levelTypeSeparator;
	cardDetailsTypes.textContent = locale.cardDetails.types;

	for (let i = 0; i < 2; i++) {
		document.getElementById("playerDeckButton" + i).title = locale.game.playerInfo.viewDeck;
		document.getElementById("playerDeckButtonImg" + i).alt = locale.game.playerInfo.viewDeck;
		document.getElementById("playerDeckButton" + i).addEventListener("click", function() {
			loadDeckPreview(playerData[i].deck);
			openDeckView();
		});
	}

	// profile pictures
	for (let i = 0; i < 2; i++) {
		document.getElementById("username" + i).textContent = playerData[i].name;
		document.getElementById("profilePicture" + i).setIcon(playerData[i].profilePicture, i === 0);
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
		const imagePreference = !(localStorage.getItem("cardPreviewImagePreference") === "true");
		localStorage.setItem("cardPreviewImagePreference", imagePreference);
		cardDetailsImage.style.display = imagePreference? "revert" : "none";
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