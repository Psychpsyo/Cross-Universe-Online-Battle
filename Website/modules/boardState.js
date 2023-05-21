// This module exports the board state which is the main game state where the players actually play.
import {GameState} from "/modules/gameState.js";

let myCursorX = 0;
let myCursorY = 0;
let oppCursorX = 0;
let oppCursorY = 0;
let oppCursorTargetX = 0;
let oppCursorTargetY = 0;
// used to track the speed of the cursors
let lastMyCursorX = 0;
let lastMyCursorY = 0;
let lastOppCursorX = 0;
let lastOppCursorY = 0;

let lastFrame = 0;

// measure when the mouse moves
document.addEventListener("mousemove", function(e) {
	let fieldRect = document.getElementById("field").getBoundingClientRect();
	myCursorX = (e.clientX - fieldRect.left - fieldRect.width / 2) / fieldRect.height;
	myCursorY = (e.clientY - fieldRect.top) / fieldRect.height;
	
	dragCard.style.left = myCursorX * fieldRect.height + fieldRect.width / 2 + "px";
	dragCard.style.top = myCursorY * fieldRect.height + "px";
});

function animateCursors(currentTime) {
	let delta = currentTime - lastFrame;
	lastFrame = currentTime;
	
	// opponent cursor movement / smoothing
	if (!opponentCursor.hidden) {
		oppCursorX += (oppCursorTargetX - oppCursorX) / 5;
		oppCursorY += (oppCursorTargetY - oppCursorY) / 5;
	}
	let fieldRect = document.getElementById("field").getBoundingClientRect();
	opponentCursor.style.left = (oppCursorX * fieldRect.height + fieldRect.width / 2) + "px";
	opponentCursor.style.top = oppCursorY * fieldRect.height + "px";
	
	// animate cards
	let myCursorXVel = myCursorX - lastMyCursorX;
	let myCursorYVel =  lastMyCursorY - myCursorY;
	let oppCursorXVel = oppCursorX - lastOppCursorX;
	let oppCursorYVel = lastOppCursorY - oppCursorY;
	
	dragCard.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (myCursorXVel > 0? Math.min(Math.PI / 3, myCursorXVel * 100) : Math.max(Math.PI / -3, myCursorXVel * 100)) + "rad) rotateX(" + (myCursorYVel > 0? Math.min(Math.PI / 3, myCursorYVel * 100) : Math.max(Math.PI / -3, myCursorYVel * 100)) + "rad)";
	
	if (opponentCursor.src.endsWith("images/opponentCursor.png")) {
		opponentCursor.style.transform = "translate(-50%,-50%) rotate(180deg)";
	} else {
		opponentCursor.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (oppCursorXVel > 0? Math.min(Math.PI / 3, oppCursorXVel * 100) : Math.max(Math.PI / -3, oppCursorXVel * 100)) + "rad) rotateX(" + (oppCursorYVel > 0? Math.min(Math.PI / 3, oppCursorYVel * 100) : Math.max(Math.PI / -3, oppCursorYVel * 100)) + "rad) rotateZ(180deg)";
	}
	
	lastMyCursorX = myCursorX;
	lastMyCursorY = myCursorY;
	lastOppCursorX = oppCursorX;
	lastOppCursorY = oppCursorY;
	
	requestAnimationFrame(animateCursors);
}

function doSelectStartingPlayer() {
	if (cardAreas["field2"].isFaceDown() && cardAreas["field17"].isFaceDown()) {
		if (youAre === 0) {
			startingPlayerSelect.style.display = "block";
		}
		mainGameBlackout.remove();
	}
}

//opening the partner select menu
function openPartnerSelectMenu() {
	// unhide backdrop
	overlayBackdrop.style.display = "block";
	
	//clear partner selector
	if (document.getElementById("partnerSelectorGrid").firstChild) {
		document.getElementById("partnerSelectorGrid").innerHTML = "";
	}
	
	//add cards
	cardAreas["deck1"].cards.forEach((card, i) => {
		//check if card is a unit (eligible as a partner)
		if (card.type == "unit") {
			let cardImg = document.createElement("img");
			cardImg.src = card.getImage();
			cardImg.dataset.cardIndex = i;
			cardImg.addEventListener("click", function() {
				if (shiftHeld) {
					previewCard(cardAreas["deck1"].cards[this.dataset.cardIndex]);
				} else {
					document.getElementById("partnerSelectionMenu").style.display = "none";
					gameState.getPartnerFromDeck(this.dataset.cardIndex);
					overlayBackdrop.style.display = "none";
				}
			});
			document.getElementById("partnerSelectorGrid").appendChild(cardImg)
		}
	});
	document.getElementById("partnerSelectionMenu").style.display = "flex";
	
	//scroll to top
	document.getElementById("partnerSelectorGrid").parentNode.scrollTop = 0;
}


export class BoardState extends GameState {
	constructor() {
		super();
		
		this.chosenPartners = [];
		for (let i = 0; i < game.players.length; i++) {
			this.chosenPartners.push(null);
		}
		
		// remove draft game section and deck drop zone since they are not needed anymore
		draftGameSetupMenu.remove();
		
		// setup cursor movement
		document.getElementById("field").addEventListener("mouseleave", function() {
			socket.send("[hideCursor]");
		});
		document.getElementById("field").addEventListener("mousemove", function() {
			// check if the normalized cursor position is within the bounds of the visual field
			if (Math.abs(myCursorX) < 3500 / 2741 / 2) { // 3500 and 2741 being the width and height of the field graphic
				socket.send("[placeCursor]" + myCursorX + "|" + myCursorY);
			} else {
				socket.send("[hideCursor]");
			}
		});
		lastFrame = performance.now();
		animateCursors();
		
		// show game area
		mainGameBlackout.textContent = "";
		mainGameArea.removeAttribute("hidden");
		gameInteractions.removeAttribute("hidden");
		
		// do partner select
		if (localPlayer.deck.suggestedPartner) {
			if (localStorage.getItem("partnerChoiceToggle") === "true") {
				document.getElementById("partnerSelectQuestion").style.display = "block";
				
				document.getElementById("chooseSuggestedPartnerBtn").addEventListener("click", function() {
					document.getElementById("partnerSelectQuestion").remove();
					gameState.getPartnerFromDeck();
				});
				document.getElementById("manualChoosePartnerBtn").addEventListener("click", function() {
					document.getElementById("partnerSelectQuestion").remove();
					openPartnerSelectMenu();
				});
			} else {
				this.getPartnerFromDeck();
			}
		} else {
			openPartnerSelectMenu();
		}
		
		document.getElementById("revealPartnerBtn").addEventListener("click", function() {
			document.getElementById("partnerRevealButtonDiv").style.display = "none";
			field17.src = "images/cardHidden.png";
			cardAreas["field17"].dropCard(gameState.chosenPartners[1]);
			socket.send("[revealPartner]");
		});
	}
	receiveMessage(command, message) {
		switch (command) {
			case "deckOrder": { // opponent shuffled a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
				message = message.substr(2);
				let order = message.split("|").map(i => parseInt(i));
				deck.cards.sort((a, b) => order.indexOf(deck.cards.indexOf(a)) - order.indexOf(deck.cards.indexOf(b)));
				putChatMessage(locale[deck.playerIndex == 1? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
				return true;
			}
			case "choosePartner": { // opponent selected their partner
				field2.src = "images/cardBackFrameP0.png";
				this.chosenPartners[0] = cardAreas["deck0"].cards.splice(message, 1)[0];
				cardAreas["deck0"].updateVisual();
				doSelectStartingPlayer();
				return true;
			}
			case "revealPartner": { // opponent revealed their partner
				field2.src = "images/cardHidden.png";
				cardAreas["field2"].dropCard(this.chosenPartners[0]);
				return true;
			}
			case "selectPlayer": { // opponent chose the starting player (at random)
				startingPlayerSelect.style.display = "none";
				putChatMessage(message == "true"? locale["opponentStarts"] : locale["youStart"], "notice");
				partnerRevealButtonDiv.style.display = "block";
				return true;
			}
			case "grabbedCard": { // opponent picked up a card
				let cardArea = cardAreas[cardAreaToLocal(message.substr(0, message.indexOf("|")))];
				let cardIndex = message.substr(message.indexOf("|") + 1);
				
				let hiddenGrab = cardArea.isGrabHidden(cardIndex)
				opponentHeldCard = cardArea.grabCard(cardIndex);
				opponentCursor.src = hiddenGrab? "images/cardBackFrameP0.png" : opponentHeldCard.getImage();
				return true;
			}
			case "droppedCard": { // opponent dropped a card
				if (message != "") {
					let cardArea = cardAreaToLocal(message);
					if (opponentHeldCard.type == "token" && !cardAreas[cardArea].allowTokens) { // no tokens allowed, this'll just vanish the card
						opponentHeldCard.location?.dragFinish(opponentHeldCard);
					} else if (cardArea.startsWith("deck")) { // if the card was dropped to deck, don't call the drop function to not prompt the local player with the options
						// return early if the opponent dropped to deck, so that opponentHeldCard does not get cleared.
						opponentCursor.src = "images/opponentCursor.png";
						return true;
					} else {
						if (!cardAreas[cardArea].dropCard(opponentHeldCard)) {
							opponentHeldCard.location?.returnCard(opponentHeldCard);
						}
					}
				} else {
					opponentHeldCard.location?.returnCard(opponentHeldCard);
				}
				opponentHeldCard = null;
				opponentCursor.src = "images/opponentCursor.png";
				return true;
			}
			case "deckTop": { // opponent sent their held card to the top of a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				
				deck.cards.push(opponentHeldCard);
				opponentHeldCard.location?.dragFinish(opponentHeldCard);
				opponentHeldCard.location = deck;
				opponentHeldCard = null;
				deck.updateVisual();
				return true;
			}
			case "deckBottom": { // opponent sent their held card to the bottom of a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				
				deck.cards.unshift(opponentHeldCard);
				opponentHeldCard.location?.dragFinish(opponentHeldCard);
				opponentHeldCard.location = deck;
				opponentHeldCard = null;
				deck.updateVisual();
				return true;
			}
			case "deckShuffle": { // opponent shuffles their held card into a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				
				deck.cards.push(opponentHeldCard); // the [deckOrder] message will arrive right after this one.
				opponentHeldCard.location?.dragFinish(opponentHeldCard);
				opponentHeldCard.location = deck;
				opponentHeldCard = null;
				deck.updateVisual();
				return true;
			}
			case "deckCancel": { // opponent cancelled dropping their held card into a deck
				opponentHeldCard.location?.returnCard(opponentHeldCard);
				opponentHeldCard = null;
				return true;
			}
			case "drawCard": { // opponent drew a card
				cardAreas["deck0"].draw();
				return true;
			}
			case "showDeckTop": { // opponent presented a card
				let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
				deck.showTop(0);
				return true;
			}
			case "life": { // set opponent's life
				game.players[0].life = message;
				updateLifeDisplay(game.players[0]);
				return true;
			}
			case "mana": { // set opponent's mana
				game.players[0].mana = message;
				updateManaDisplay(game.players[0]);
				return true;
			}
			case "hideCursor": { // hide opponent's cursor
				opponentCursor.setAttribute("hidden", "");
				return true;
			}
			case "placeCursor": { // move the opponent's cursor somewhere on the field
				oppCursorTargetX = message.substr(0, message.indexOf("|")) * -1;
				oppCursorTargetY = 1 - message.substr(message.indexOf("|") + 1);
				if (opponentCursor.hidden) {
					opponentCursor.removeAttribute("hidden");
					oppCursorX = oppCursorTargetX;
					oppCursorY = oppCursorTargetY;
				}
				return true;
			}
			case "hideHand": { // opponent hid their hand
				cardAreas["hand0"].hideCards();
				return true;
			}
			case "showHand": { // opponent revealed their hand
				cardAreas["hand0"].showCards();
				return true;
			}
			case "dice": { // opponent rolled a dice with /dice in chat
				putChatMessage(locale["cardActions"]["I00040"]["opponentRoll"].replace("{#RESULT}", message), "notice");
				return true;
			}
			case "revealCard": { // opponent revealed a presented card
				let cardDiv = presentedCards0.children.item(parseInt(message));
				cardDiv.src = cardAreas["presentedCards0"].cards[cardDiv.dataset.cardIndex].getImage();
				cardDiv.dataset.shown = true;
				return true;
			}
			case "unrevealCard": { // opponent hid a presented card
				let cardDiv = presentedCards0.children.item(parseInt(message));
				cardDiv.src = "images/cardBackFrameP0.png";
				cardDiv.dataset.shown = false;
				return true;
			}
			case "counterAdd": {
				addCounter(message);
				return true;
			}
			case "counterIncrease": {
				let slotIndex = message.substr(0, message.indexOf("|"));
				let counterIndex = message.substr(message.indexOf("|") + 1);
				let counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
				counter.innerHTML = parseInt(counter.innerHTML) + 1;
				return true;
			}
			case "counterDecrease": {
				let slotIndex = message.substr(0, message.indexOf("|"));
				let counterIndex = message.substr(message.indexOf("|") + 1);
				let counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
				counter.innerHTML = parseInt(counter.innerHTML) - 1;
				return true;
			}
			case "counterRemove": {
				let slotIndex = message.substr(0, message.indexOf("|"));
				let counterIndex = message.substr(message.indexOf("|") + 1);
				document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex).remove();
				return true;
			}
			case "createToken": {
				cardAreas.tokens.createOpponentToken(message);
				return true;
			}
			case "returnAllToDeck": {
				let pileArea = cardAreas[cardAreaToLocal(message)];
				while (pileArea.cards.length > 0) {
					cardAreas["deck0"].cards.push(pileArea.cards.pop());
				}
				pileArea.updateDOM();
				return true;
			}
		}
		return false;
	}
	
	// called after partner selection
	getPartnerFromDeck(partnerPosInDeck = -1) {
		mainGameBlackout.textContent = locale["partnerSelect"]["waitingForOpponent"];
		document.getElementById("field17").src = "images/cardBackFrameP1.png";
		if (partnerPosInDeck == -1) {
			partnerPosInDeck = cardAreas["deck1"].cards.findIndex(card => {return card.cardId == game.players[localPlayer.index].deck["suggestedPartner"]});
		}
		this.chosenPartners[1] = cardAreas["deck1"].cards.splice(partnerPosInDeck, 1)[0];
		
		socket.send("[choosePartner]" + partnerPosInDeck);
		
		//shuffle the just loaded deck
		cardAreas["deck1"].shuffle();
		cardAreas["deck1"].updateVisual();
		
		doSelectStartingPlayer();
	}
}