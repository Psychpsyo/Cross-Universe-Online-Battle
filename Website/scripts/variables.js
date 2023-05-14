let game = null;
let localPlayer = null;
let gameState = null;

// Areas that cards can go to. These handle card location changes and change the DOM accordingly
let cardAreas = {};

let socket = null;
let roomcode = "";
let roomCodeShown = false;

let shiftHeld = false;
let ctrlHeld = false;
let altHeld = false;

let youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and partner selection, as far as the board is concerned, the local player is always player 1.)

let canGrab = true; //whether or not cards can be grabbed. (only used when dropping a card onto the deck)
let heldCard = null; // what card is currently being dragged
let opponentHeldCard = null; // what card is currently being dragged by the opponent
let opponentName = null; // The opponent's display name