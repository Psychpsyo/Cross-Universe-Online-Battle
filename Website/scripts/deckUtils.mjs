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

// Creates a .deck json from a list of card IDs and other necessary info.
export function basicDeckFromCardList(cards, partner = null, name = null, description = null) {
	let deck = {};
	deck.Cards = [];
	deck.Description = description ?? "";
	deck.Name = name ?? defaultDeckName;

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
	const jsonDeck = {};

	//set name
	jsonDeck.name = {};
	jsonDeck.name[locale.code] = cuDeck.Name ?? locale.defaultDeckName;
	jsonDeck.description = {};
	jsonDeck.description[locale.code] = cuDeck.Description ?? "";

	//set partner
	jsonDeck.cards = [];
	if (cuDeck.Partner) {
		jsonDeck.suggestedPartner = cuDeck.Partner.substring(2);
		jsonDeck.cards.push({id: cuDeck.Partner.substring(2), amount: 1});
	}

	//add the rest of the cards
	for (const card of cuDeck.Cards) {
		const alreadyThere = jsonDeck.cards.filter(oldCard => {
			return oldCard.id === card.substring(2);
		});
		if (alreadyThere[0]) {
			alreadyThere[0].amount++;
		} else {
			jsonDeck.cards.push({id: card.substring(2), amount: 1});
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

	const bitCount = Math.max(1, Math.ceil(Math.log2(maxDist)));

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
		if (num === -1) return null;
		binary += num.toString(2).padStart(5, "0");
	}

	// we need at least 10 bits to parse out the bitCount and partnerIndex
	if (binary.length < 10) return null;

	let deck = {
		cards: []
	};

	let i = 0;
	// how many bits are used to encode each card
	let bitCount = parseInt(binary.substring(i, i+=4), 2);
	// the how-manyeth encoded card type is the partner
	let partnerIndex = parseInt(binary.substring(i, i+=6), 2) - 1;

	let lastCardId = 1;
	let currentCard = 0;
	while (binary.substring(i).includes("1")) {
		// Error check: We need to have enough bits left for the card
		if (binary.length <= i+bitCount) return null;

		const increment = parseInt(binary.substring(i, i+=bitCount), 2);

		// Error check: The same card can't be encoded twice in a row.
		if (increment === 0 && lastCardId > 1) return null;
		lastCardId += increment;

		// Error check: We need to have enough bits left for the card amount
		if (binary.length <= i+2) return null;

		let cardCount = parseInt(binary.substring(i, i+=2), 2);
		// A card amount of 0 means we need parse a longer card amount (6 bits)
		if (cardCount === 0) {
			// Error check: We need to have enough bits left for the extended card amount
			if (binary.length <= i+6) return null;

			cardCount = parseInt(binary.substring(i, i+=6), 2);
		}

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
	// Could not parse a partner when there should be one.
	if (partnerIndex >= 0 && !deck.suggestedPartner) return null;
	return deck;
}