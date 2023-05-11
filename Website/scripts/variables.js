let mana = [0, 0];
let life = [1000, 1000];

// Areas that cards can go to. These handle card location changes and change the DOM accordingly
cardAreas = {};

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
let oppCursorTargetX = 0;
let oppCursorTargetY = 0;


// constants
let TOKEN_COUNT = 28;