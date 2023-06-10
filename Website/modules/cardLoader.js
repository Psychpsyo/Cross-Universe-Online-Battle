
import {locale} from "/modules/locale.js";
import {renderCard} from "/custom/renderer.js";
import {deckToCardIdList} from "/modules/deckUtils.js";

let cardInfoCache = {};
let cdfCache = {};
let nextCustomCardIDs = [1, 2];

function getCardImageFromID(cardId) {
	return "https://crossuniverse.net/images/cards/" + (globalLocale.warnings.includes("noCards")? "en" : globalLocale.code) + "/" + cardId + ".jpg";
}

export async function getCardInfo(cardId) {
	if (!cardInfoCache[cardId]) {
		const response = await fetch("https://crossuniverse.net/cardInfo/?lang=" + (locale.warnings.includes("noCards")? "en" : locale.code) + "&cardID=" + cardId, {cache: "force-cache"});
		cardInfoCache[cardId] = await response.json();
		cardInfoCache[cardId].imageSrc = getCardImageFromID(cardId);
	}
	return cardInfoCache[cardId];
}

export async function registerCustomCard(cardData, player) {
	let canvas = document.createElement("canvas");
	await renderCard(cardData, canvas);
	cardData.imageSrc = canvas.toDataURL();
	let cardId = "C" + String(nextCustomCardIDs[player.index]).padStart(5, "0");
	cardData[cardId] = cardData;
	nextCustomCardIDs[player.index] += nextCustomCardIDs.length;
	return cardId;
}

export async function getManualCdf(cardId) {
	let cardData = await getCardInfo(cardId);
	return `id:CU${cardId}
cardType:${cardData.cardType}
name:CU${cardId}
level:${cardData.level}
types:${cardData.types.join(",")}
attack:${cardData.attack ?? 0}
defense:${cardData.defense ?? 0}`
}

export async function getCdf(cardId) {
	if (!cdfCache[cardId]) {
		const response = await fetch("/rulesEngine/cards/CU" + cardId + ".cdf", {cache: "force-cache"});
		cdfCache[cardId] = await response.text();
	}
	return cdfCache[cardId];
}

export async function getCardImage(card) {
	if (!card) {
		return "images/cardHidden.png";
	}
	return card.hidden? "images/cardBackFrameP" + card.owner.index + ".png" : (await getCardInfo(card.cardId)).imageSrc;
}

export async function deckToCdfList(deck, automatic) {
	let cdfList = await Promise.allSettled(deckToCardIdList(deck).map(cardId => automatic? getCdf(cardId) : getManualCdf(cardId)));
	return cdfList.map(promise => promise.value);
}