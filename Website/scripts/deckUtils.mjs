// Utility functions for handling and converting decks
import {locale} from "./locale.mjs";

// Creates a .deckx from a list of cards, a name and a description, with respect to the current user-selected locale.
export function deckFromCardList(cards, partner = null, name = null, description = null) {
	let deck = {};
	deck.name = {};
	deck.name[locale.code] = name ?? "";
	deck.description = {};
	deck.description[locale.code] = description ?? "";
	deck.cards = [];
	if (partner) {
		deck.suggestedPartner = partner;
	}

	//add the cards
	for (const card of cards) {
		let alreadyThere = deck.cards.filter(oldCard => oldCard.id === card);
		if (alreadyThere[0]) {
			alreadyThere[0].amount++;
		} else {
			deck.cards.push({"id": card, "amount": 1});
		}
	}

	return deck;
}

// Creates a .deck json from a .deckx json, based on the user's current locale
export function basicDeckFromCardList(cards, partner = null, name = null, description = null) {
	let deck = {};
	deck.Cards = [];
	deck.Description = description ?? "";
	deck.Name = name ?? "";

	//add the cards
	for (const card of cards.toSorted().reverse()) {
		if (card === partner && typeof deck.Partner === "undefined") {
			deck.Partner = "CU" + card;
		} else {
			deck.Cards.push("CU" + card);
		}
	}

	return deck;
}

// Converts an official Cross Universe .deck format file to .deckx with respect to the current user-selected locale.
export function toDeckx(cuDeck) {
	let jsonDeck = {};

	//set name
	jsonDeck["name"] = {};
	jsonDeck["name"][locale.code] = cuDeck["Name"] ?? locale.deckxDefaultName;
	jsonDeck["description"] = {};
	jsonDeck["description"][locale.code] = cuDeck["Description"] ?? "";

	//set partner
	jsonDeck["cards"] = [];
	if (cuDeck["Partner"]) {
		jsonDeck["suggestedPartner"] = cuDeck["Partner"].substring(2);
		jsonDeck["cards"].push({"id": cuDeck["Partner"].substring(2), "amount": 1});
	}

	//add the rest of the cards
	for (const card of cuDeck["Cards"]) {
		let alreadyThere = jsonDeck["cards"].filter(oldCard => {
			return oldCard["id"] === card.substring(2);
		});
		if (alreadyThere[0]) {
			alreadyThere[0]["amount"]++;
		} else {
			jsonDeck["cards"].push({"id": card.substring(2), "amount": 1});
		}
	}

	return jsonDeck;
}

//count cards in a .deckx
export function countDeckCards(deck) {
	let total = 0;
	deck.cards.forEach(card => {
		total += card.amount;
	});
	return total;
}

// converts a .deckx to a list of card ID strings. (U00161, I00045...)
export function deckToCardIdList(deck) {
	let cardList = [];
	deck.cards.forEach(card => {
		for (let i = 0; i < card.amount; i++) {
			cardList.push(card.id);
		}
	});
	return cardList;
}

// For generating deck codes
const deckCodeChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'n', 'o', 'p', 'q', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
function interlaceCardId(cardId) {
	let cardTypeCount = 1;
	let cardTypeOffset = 0;
	switch (cardId[0]) {
		case 'U':
			cardTypeCount = 3;
			break;
		case 'S':
			cardTypeCount = 2;
			cardTypeOffset = 3;
			break;
		case 'I':
			cardTypeOffset = 5;
			break;
	}

	let interlaced = parseInt(cardId.substring(1)) - 1;
	return Math.floor(interlaced / cardTypeCount) * 6 + cardTypeOffset + interlaced % cardTypeCount + 1;
}
function uninterlaceCardId(interlaced) {
	interlaced -= 1;
	let nthGroup = Math.floor(interlaced / 6);
	let type;
	let cardId = interlaced - nthGroup * 6 + 1;
	switch (interlaced % 6) {
		case 0:
		case 1:
		case 2:
			cardId += nthGroup * 3;
			type = "U";
			break;
		case 3:
		case 4:
			cardId += nthGroup * 2;
			cardId -= 3;
			type = "S";
			break;
		case 5:
			cardId += nthGroup;
			cardId -= 5;
			type = "I";
			break;
	}

	return type + cardId.toString().padStart(5, "0");
}

export function encodeDeckCode(deck) {
	const charset = deckCodeChars;
	const bitsPerChar = 5;

	const cardAmounts = {};
	for (const card of deck.cards) {
		cardAmounts[interlaceCardId(card.id)] = card.amount;
	}

	// the stuff that this function will return
	const binaryData = [];

	let maxDist = 0;
	let lastId = 1;
	for (const id of Object.keys(cardAmounts)) {
		maxDist = Math.max(maxDist, id - lastId);
		lastId = id;
	}

	const bitCount = Math.ceil(Math.log2(maxDist));

	binaryData.push((bitCount & 0b1000) !== 0);
	binaryData.push((bitCount & 0b0100) !== 0);
	binaryData.push((bitCount & 0b0010) !== 0);
	binaryData.push((bitCount & 0b0001) !== 0);

	let partnerIndex = 0;
	if (deck.suggestedPartner) {
		const interlacedPartnerId = interlaceCardId(deck.suggestedPartner);
		for (const id of Object.keys(cardAmounts)) {
			partnerIndex++;
			if (parseInt(id) === interlacedPartnerId) {
				break;
			}
		}
	}

	binaryData.push((partnerIndex & 0b100000) !== 0);
	binaryData.push((partnerIndex & 0b010000) !== 0);
	binaryData.push((partnerIndex & 0b001000) !== 0);
	binaryData.push((partnerIndex & 0b000100) !== 0);
	binaryData.push((partnerIndex & 0b000010) !== 0);
	binaryData.push((partnerIndex & 0b000001) !== 0);

	lastId = 1;
	for (const [id, amount] of Object.entries(cardAmounts)) {
		let runLength = id - lastId;
		for (let i = bitCount - 1; i >= 0; i--) {
			binaryData.push((runLength & Math.pow(2, i)) !== 0);
		}
		lastId = id;
		if (amount < 4) {
			binaryData.push((amount & 0b10) !== 0);
			binaryData.push((amount & 0b01) !== 0);
		} else {
			binaryData.push(false);
			binaryData.push(false);
			binaryData.push((amount & 0b100000) !== 0);
			binaryData.push((amount & 0b010000) !== 0);
			binaryData.push((amount & 0b001000) !== 0);
			binaryData.push((amount & 0b000100) !== 0);
			binaryData.push((amount & 0b000010) !== 0);
			binaryData.push((amount & 0b000001) !== 0);
		}
	}

	for (let i = binaryData.length % bitsPerChar; i < bitsPerChar; i++) {
		binaryData.push(false);
	}

	let retVal = "";
	for (let i = 0; i < binaryData.length / bitsPerChar; i++) {
		let character = 0;
		for (let j = 0; j < bitsPerChar; j++) {
			character |= binaryData[i * bitsPerChar + j] << (bitsPerChar - (j+1));
		}
		retVal += charset[character];
	}

	return retVal;
}
export function decodeDeckCode(code) {
	let binary = "";
	for (const char of code) {
		let num = deckCodeChars.indexOf(char);
		binary += num.toString(2).padStart(5, "0");
	}

	let deck = {
		cards: []
	};

	let i = 0;
	let bitCount = parseInt(binary.substring(i, i+=4), 2);
	let partnerIndex = parseInt(binary.substring(i, i+=6), 2) - 1;

	let lastCardId = 1;
	let currentCard = 0;
	while (binary.substring(i).includes("1")) {
		lastCardId += parseInt(binary.substring(i, i+=bitCount), 2);
		let cardCount = parseInt(binary.substring(i, i+=2), 2);
		if (cardCount === 0) cardCount = parseInt(binary.substring(i, i+=6), 2);

		const cardId = uninterlaceCardId(lastCardId);
		deck.cards.push({
			id: cardId,
			amount: cardCount
		});
		if (partnerIndex === currentCard) {
			deck.suggestedPartner = cardId;
		}
		currentCard++;
	}
	return deck;
}