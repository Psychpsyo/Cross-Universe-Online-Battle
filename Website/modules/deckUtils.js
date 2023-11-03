// Utility functions for handling and converting decks
import {locale} from "/modules/locale.js";

// Creates a .deckx from a list of cards, a name and a description, with respect to the current user-selected locale.
export function deckFromCardList(cards, name, description) {
	let deck = {};
	deck.name = {};
	deck.name[locale.code] = name ?? "";
	deck.description = {};
	deck.description[locale.code] = description ?? "";
	deck.cards = [];

	//add the cards
	for (const card of cards) {
		let alreadyThere = deck["cards"].filter(oldCard => {
			return oldCard["id"] === card;
		});
		if (alreadyThere[0]) {
			alreadyThere[0]["amount"]++;
		} else {
			deck["cards"].push({"id": card, "amount": 1});
		}
	}

	return deck;
}

// Converts an official Cross Universe .deck format file to .deckx with respect to the current user-selected locale.
export function toDeckx(cuDeck) {
	let jsonDeck = {};

	//set name
	jsonDeck["name"] = {};
	jsonDeck["name"][locale.code] = cuDeck["Name"] === undefined? "Cross Universe VCI Generator デッキ" : cuDeck["Name"];
	jsonDeck["description"] = {};
	jsonDeck["description"][locale.code] = cuDeck["Description"] === undefined? "" : cuDeck["Description"];

	//set partner
	jsonDeck["cards"] = [];
	if (cuDeck["Partner"]) {
		jsonDeck["suggestedPartner"] = cuDeck["Partner"].substr(2);
		jsonDeck["cards"].push({"id": cuDeck["Partner"].substr(2), "amount": 1});
	}

	//add the rest of the cards
	for (const card of cuDeck["Cards"]) {
		let alreadyThere = jsonDeck["cards"].filter(oldCard => {
			return oldCard["id"] === card.substr(2);
		});
		if (alreadyThere[0]) {
			alreadyThere[0]["amount"]++;
		} else {
			jsonDeck["cards"].push({"id": card.substr(2), "amount": 1});
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