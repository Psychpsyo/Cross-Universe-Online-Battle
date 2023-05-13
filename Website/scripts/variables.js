let game = null;
let localPlayer = null;
import("/modules/game.js").then(async gameModule => {
	game = new gameModule.Game();
	import("/modules/card.js").then(async cardModule => {
		await fetch("https://crossuniverse.net/cardInfo", {
			method: "POST",
			body: JSON.stringify({
				"cardTypes": ["token"],
				"language": localStorage.getItem("language")
			})
		})
		.then(response => response.json())
		.then(response => {
			response.forEach(card => {
				card.imageSrc = getCardImageFromID(card.cardID);
				game.cardData[card.cardID] = card;
				cardAreas["tokens"].cards.push(new cardModule.Card(game, card.cardID));
			});
		});
		localPlayer = game.players[1];
	});
});

let gameState = null;

// Areas that cards can go to. These handle card location changes and change the DOM accordingly
let cardAreas = {};

let socket = null;
let roomcode = "";
let roomCodeShown = false;

let shiftHeld = false;
let ctrlHeld = false;
let altHeld = false;

let officialDecks = [];
let currentDeckList = "default";

// decks and partner choices for both players
let loadedDeck = null;
let loadedPartner = null;
let opponentDeck = null;
let opponentPartner = null;

let youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and partner selection, as far as the board is concerned, the local player is always player 1.)

let canGrab = true; //whether or not cards can be grabbed. (only used when dropping a card onto the deck)
let heldCard = null; // what card is currently being dragged
let opponentHeldCard = null; // what card is currently being dragged by the opponent
let opponentName = null; // The opponent's display name

// local player and opponent cursor positions
let myCursorX = 0;
let myCursorY = 0;
let oppCursorX = 0;
let oppCursorY = 0;