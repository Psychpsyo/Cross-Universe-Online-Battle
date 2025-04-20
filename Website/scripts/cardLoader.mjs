
import {locale} from "./locale.mjs";

// these just have placeholder info so that the UI doesn't freak out.
export const cardInfoCache = {
	U00000: {name: "Debug Unit", cardType: "unit", level: -1, types: [], effects: []},
	S00000: {name: "Debug Spell", cardType: "standardSpell", level: -1, types: [], effects: []},
	I00000: {name: "Debug Item", cardType: "standardItem", level: -1, types: [], effects: []},
	T00000: {name: "Debug Token", cardType: "unit", level: -1, types: [], effects: []}
};
let cardFetchPromise = null;
let resolveCardFetchPromise = null;
let cardsToFetch = [];
const cdfCache = {};
let scriptedCardList = null;
const nextCustomCardIDs = [1, 2];
const customCardURLs = [];
let resoniteAvailability = null;

const cardLanguages = ["en", "ja"];

// to be thrown when a card does now exist
export class NonexistantCardError extends Error {
	constructor(cardId) {
		super(`Card with ID ${cardId} does not exist.`);
		this.cardId = cardId;
	}
}

export class UnsupportedCardError extends Error {
	constructor(cardId) {
		super("Card " + cardId + " is currently unsupported in automatic matches.");
		this.name = "UnsupportedCardError";
		this.cardId = cardId;
	}
}

async function cardFetcher() {
	if (!cardFetchPromise) return;
	const localCardsToFetch = cardsToFetch;
	cardsToFetch = [];

	const cardInfoEndpoint = localStorage.getItem("cardDataApiUrl") === ""? "https://crossuniverse.net/cardInfo/" : localStorage.getItem("cardDataApiUrl");
	const languageToFetchIn =  (locale.warnings.includes("noCards")? "en" : locale.code);
	if (localCardsToFetch.length === 1) {
		const response = await fetch(
			`${cardInfoEndpoint}?lang=${languageToFetchIn}&cardID=${localCardsToFetch[0]}`,
			{cache: "force-cache"}
		);
		if (!response.ok) {
			return;
		}
		cardInfoCache[localCardsToFetch[0]] = await response.json();
	} else {
		const response = await fetch(
			cardInfoEndpoint,
			{method: "POST", cache: "force-cache", body: JSON.stringify({language: languageToFetchIn})}
		);
		for (const card of await response.json()) {
			cardInfoCache[card.cardID] = card;
		}
	}
	cardFetchPromise = null;
	resolveCardFetchPromise();
	resolveCardFetchPromise = null;
}

// size should be one of "small" or "tiny", if the image should not be loaded at full size
export function getCardImageFromID(cardId, size, language = localStorage.getItem("language")) {
	if (cardId.startsWith("C")) {
		return customCardURLs[parseInt(cardId.substring(1))];
	}
	if (cardId.substring(1) === "00000") {
		return `images/debugCards/${cardId}.png`;
	}
	return `${localStorage.getItem("cardImageUrl") === ""? "https://crossuniverse.net/images/cards/" : localStorage.getItem("cardImageUrl")}${cardLanguages.includes(language)? language : "en"}/${size? `${size}/` : ""}${cardId}.${size? "avif" : "jpg"}`;
}

export async function getCardInfo(cardId) {
	if (!cardInfoCache[cardId]) {
		if (!cardFetchPromise) {
			cardFetchPromise = new Promise(resolve => {
				resolveCardFetchPromise = resolve;
			});
			setTimeout(cardFetcher, 0);
		}
		await cardFetchPromise;
		if (!cardInfoCache[cardId]) {
			throw new NonexistantCardError(cardId);
		}
	}
	return cardInfoCache[cardId];
}

let renderCard;
export async function registerCustomCard(cardData, player) {
	// import() renderCard here in case it's never needed
	renderCard ??= (await import("../custom/renderer.mjs")).renderCard;
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
				throw new UnsupportedCardError(cardId);
			}
		} else {
			const response = await fetch("./rulesEngine/cards/CU" + cardId + ".cdf", {cache: "force-cache"});
			if (!response.ok) {
				throw new NonexistantCardError(cardId);
			}
			cdfCache[cardId] = await response.text();
		}
	}
	return cdfCache[cardId];
}

export function getCardImage(card, size, useOwnerLanguage = localStorage.getItem("opponentCardLanguage") === "true") {
	if (!card) {
		return "./images/cardHidden.png";
	}
	// If there is a local player, we check if it's hidden for them. If not, we are spectating and only fully public cards should be shown.
	if(localPlayer? card.hiddenFor.includes(localPlayer) : card.hiddenFor.length > 0) {
		return `./images/cardBackFrameP${card.owner.index}.png`;
	}
	const language = (useOwnerLanguage? playerData[card.owner.index].language : null) ?? localStorage.getItem("language");
	return getCardImageFromID(card.cardId, size, language);
}

// TODO: nested sub-abilities do not work
export async function getAbilityText(abilityId) {
	const abilityInfo = abilityId.split(":");
	const cardInfo = await getCardInfo(abilityInfo[0]);
	let currentAbility = 0;
	for (const effect of cardInfo.effects) {
		if (effect.type !== "rule") {
			currentAbility++;
			if (currentAbility == abilityInfo[1]) {
				// check if not sub-ability
				if (abilityInfo.length === 2) return effect.text;

				// we have a sub-ability
				const subAbilities = effect.text.split("●");
				// TODO: multiline sub-abilities do not get un-indented after the first line
				return "●" + subAbilities[parseInt(abilityInfo[2]) + 1].replace(locale.subEffectClosingBracket, "").trim();
			}
		}
	}
	if (abilityInfo[0].substring(1) === "00000") return "This is a debug effect, created by a unit test.\nRead the unit test to see its definition.";
	throw new Error("Card does not have an effect with id " + abilityId + "!");
}

// gets the link to the card's page on crossuniverse.net or crossuniverse.jp
export async function getWebLink(cardId, language = localStorage.getItem("language")) {
	switch (language) {
		case "ja": {
			return (await getCardInfo(cardId)).jpSiteLink;
		}
		case "en": {
			return `https://crossuniverse.net/card/CU${cardId}/`;
		}
	}
}

let deckToCardIdList;
export async function deckToCdfList(deck, automatic, player) {
	// import deckUtils here to prevent loading it up front in case this function is never needed.
	deckToCardIdList ??= (await import("./deckUtils.mjs")).deckToCardIdList;
	let deckList = deckToCardIdList(deck);
	for (let i = 0; i < deckList.length; i++) {
		if (deckList[i].startsWith("C")) {
			let oldId = deckList[i];
			deckList[i] = await registerCustomCard(deck.customs[parseInt(deckList[i].substring(1)) - 1], player);
			if (deck.suggestedPartner === oldId) {
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
			let response = await fetch("./data/scriptedCardsList.json");
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