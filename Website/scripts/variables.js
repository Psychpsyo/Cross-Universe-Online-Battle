let game = null;
let localPlayer = null;
let gameState = null;

let shiftHeld = false;
let ctrlHeld = false;
let altHeld = false;

let opponentName = null;
let youAre = null; // Whether this client is player 0 or player 1. (Mainly for draft games and partner selection, as far as the board is concerned, the local player is always player 1.)