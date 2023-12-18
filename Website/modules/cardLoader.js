
import {locale} from "/modules/locale.js";
import {renderCard} from "/custom/renderer.js";
import {deckToCardIdList} from "/modules/deckUtils.js";

export let cardInfoCache = {};
let cdfCache = {};
let scriptedCardList = null;
let nextCustomCardIDs = [1, 2];
let customCardURLs = [];
let resoniteAvailability = null;

const cardLanguages = ["en", "ja"];

export class UnsupportedCardError extends Error {
	constructor(cardId) {
		super("Card " + cardId + " is currently unsupported in automatic matches.");
		this.name = "UnsupportedCardError";
		this.cardId = cardId;
	}
}

export function getCardImageFromID(cardId, language = localStorage.getItem("language")) {
	if (cardId.startsWith("C")) {
		return customCardURLs[parseInt(cardId.substr(1))];
	}
	return (localStorage.getItem("cardImageUrl") === ""? "https://crossuniverse.net/images/cards/" : localStorage.getItem("cardImageUrl")) + (cardLanguages.includes(language)? language : "en") + "/" + cardId + ".jpg";
}

export async function getCardInfo(cardId) {
	if (!cardInfoCache[cardId]) {
		let cardInfoEndpoint = localStorage.getItem("cardDataApiUrl") === ""? "https://crossuniverse.net/cardInfo/" : localStorage.getItem("cardDataApiUrl");
		const response = await fetch(
			cardInfoEndpoint + "?lang=" + (locale.warnings.includes("noCards")? "en" : locale.code) + "&cardID=" + cardId,
			{cache: "force-cache"}
		);
		cardInfoCache[cardId] = await response.json();
	}
	return cardInfoCache[cardId];
}

export async function registerCustomCard(cardData, player) {
	let canvas = document.createElement("canvas");
	await renderCard(cardData, canvas);
	customCardURLs[nextCustomCardIDs[player.index]] = canvas.toDataURL();
	let cardId = "C" + String(nextCustomCardIDs[player.index]).padStart(5, "0");
	cardInfoCache[cardId] = cardData;
	nextCustomCardIDs[player.index] += nextCustomCardIDs.length;
	return cardId;
}

// Returns a cdf file that is 'good enough' for manual games, where the values don't change and the effects do not need to work.
export async function getManualCdf(cardId) {
	let cardData = await getCardInfo(cardId);
	let cdf = `id:CU${cardId}
cardType:${cardData.cardType}
name:CU${cardId}
level:${cardData.level}
types:${cardData.types.join(",")}
attack:${cardData.attack ?? 0}
defense:${cardData.defense ?? 0}`;
	if (cardData.deckLimit) {
		cdf += "\ndeckLimit: " + (cardData.deckLimit == 50? Infinity : cardData.deckLimit);
	}
	if (cardId[0] !== "C") {
		for (const ability of cardData.effects) {
			if (ability.type !== "rule") {
				// Yes, an effect can be completely empty.
				cdf += "\no: " + ability.type;
			}
		}
	}
	return cdf;
}

function generateCustomCardCdf(cardId) {
	let cardData = cardInfoCache[cardId];
	if (!("cdfScriptEffects" in cardData)) {
		throw new Error("Cannot generate cdf for non-scripted custom card.");
	}
	if (cardData.level == -1 || cardData.attack == -1 || cardData.defense == -1) {
		throw new Error("Cannot generate cdf for custom card with a level, attack or defense of ?.");
	}
	let cdf = `id: CU${cardId}
cardType: ${cardData.cardType}
name: CU${cardId}
level: ${cardData.level}
types: ${cardData.types.join(",")}`;
	if (["unit", "token"].includes(cardData.cardType)) {
		cdf += "\nattack: " + cardData.attack;
		cdf += "\ndefense: " + cardData.defense;
	}
	if (cardData.cdfScriptEffects.length > 0) {
		cdf += "\n" + cardData.cdfScriptEffects;
	}
	return cdf;
}

export async function getCdf(cardId) {
	if (!(await isCardScripted(cardId))) {
		throw new UnsupportedCardError(cardId);
	}
	if (!cdfCache[cardId]) {
		if (cardId.startsWith("C")) {
			try {
				cdfCache[cardId] = generateCustomCardCdf(cardId);
			} catch (e) {
				console.log(e);
				throw new UnsupportedCardError(cardId);
			}
		} else {
			const response = await fetch("/rulesEngine/cards/CU" + cardId + ".cdf", {cache: "force-cache"});
			cdfCache[cardId] = await response.text();
		}
	}
	return cdfCache[cardId];
}

export function getCardImage(card, useOwnerLanguage = localStorage.getItem("opponentCardLanguage") === "true") {
	if (!card) {
		return "images/cardHidden.png";
	}
	let language = (useOwnerLanguage? players[card.owner.index].language : null) ?? localStorage.getItem("language");
	return card.hiddenFor.includes(localPlayer)? "images/cardBackFrameP" + card.owner.index + ".png" : getCardImageFromID(card.cardId, language);
}

// TODO: nested sub-abilities do not work
export async function getAbilityText(abilityID) {
	let abilityInfo = abilityID.split(":");
	let cardInfo = await getCardInfo(abilityInfo[0]);
	let currentAbility = 0;
	for (const effect of cardInfo.effects) {
		if (effect.type !== "rule") {
			currentAbility++;
			if (currentAbility == abilityInfo[1]) {
				// check if sub-ability
				if (abilityInfo.length === 2) {
					return effect.text;
				}
				// we have a sub-ability
				const subAbilities = effect.text.split("●");
				return "●" + subAbilities[parseInt(abilityInfo[2]) + 1].replace(locale.subEffectClosingBracket, "");
			}
		}
	}
	throw new Error("Card does not have an effect with id " + abilityID + "!");
}

export async function deckToCdfList(deck, automatic, player) {
	let deckList = deckToCardIdList(deck);
	for (let i = 0; i < deckList.length; i++) {
		if (deckList[i].startsWith("C")) {
			let oldId = deckList[i];
			deckList[i] = await registerCustomCard(deck.customs[parseInt(deckList[i].substr(1)) - 1], player);
			if (deck.suggestedPartner == oldId) {
				deck.suggestedPartner = deckList[i];
			}
		}
	}
	let cdfList = await Promise.allSettled(deckList.map(cardId => automatic? getCdf(cardId) : getManualCdf(cardId)));
	for (let i = 0; i < cdfList.length; i++) {
		if (cdfList[i].status == "rejected") {
			throw cdfList[i].reason;
		}
		cdfList[i] = cdfList[i].value;
	}
	return cdfList;
}

export async function isCardScripted(cardId) {
	if (cardId.startsWith("C")) {
		return "cdfScriptEffects" in cardInfoCache[cardId];
	}
	if (cardId.startsWith("T")) {
		for (let summonerId of (await getCardInfo(cardId)).summonedBy) {
			if (await isCardScripted(summonerId)) {
				return true;
			}
		}
		return false;
	}
	if (!scriptedCardList) {
		scriptedCardList = (async() => {
			let response = await fetch("/data/scriptedCardsList.json");
			return response.json();
		})();
	}
	return (await scriptedCardList).includes(cardId);
}

export async function isInResonite(cardId) {
	if (!resoniteAvailability) {
		resoniteAvailability = (async() => {
			let response = await fetch("https://raw.githubusercontent.com/Psychpsyo/cu-data/master/cards.txt");
			let availableCards = [];
			for (let line of (await response.text()).split("\n")) {
				let parts = line.split("|");
				if (parts.length < 6) {
					continue;
				}
				let relevantPart = locale.code == "ja"? 5 : 4;
				if (parts[relevantPart].length > 16) {
					availableCards.push(parts[0]);
				}
			}
			return availableCards;
		})();
	}
	return (await resoniteAvailability).includes(cardId);
}