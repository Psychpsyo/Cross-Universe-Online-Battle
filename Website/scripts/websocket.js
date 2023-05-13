// generate random default room code
let defaultRoomCode = 10000 + (Math.floor(Math.random() * 90000));
document.getElementById("roomCodeInputField").placeholder = defaultRoomCode;
// if no room code filled in, fill in the default
if (roomCodeInputField.value == "") {
	roomCodeInputField.value = defaultRoomCode;
}
// refresh button refreshes default room code
document.getElementById("roomCodeRefresh").addEventListener("click", function() {
	defaultRoomCode = 10000 + (Math.floor(Math.random() * 90000));
	roomCodeInputField.placeholder = defaultRoomCode;
	roomCodeInputField.value = defaultRoomCode;
	roomCodeInputField.setAttribute("aria-live", "polite");
});

function cardIdToLocal(cardId) {
	cardId = parseInt(cardId);
	return cardId + (cardId % 2? 1 : -1);
}
var cardAreaMirrorTable = {
	"deck0": "deck1",
	"deck1": "deck0",
	"hand0": "hand1",
	"hand1": "hand0",
	"discard0": "discard1",
	"discard1": "discard0",
	"exile0": "exile1",
	"exile1": "exile0",
	"presentedCards0": "presentedCards1",
	"presentedCards1": "presentedCards0",
	"tokens": "tokens",
	"field0": "field19",
	"field1": "field18",
	"field2": "field17",
	"field3": "field16",
	"field4": "field15",
	"field5": "field14",
	"field6": "field13",
	"field7": "field12",
	"field8": "field11",
	"field9": "field10",
	"field10": "field9",
	"field11": "field8",
	"field12": "field7",
	"field13": "field6",
	"field14": "field5",
	"field15": "field4",
	"field16": "field3",
	"field17": "field2",
	"field18": "field1",
	"field19": "field0"
};
function cardAreaToLocal(cardArea) {
	return cardAreaMirrorTable[cardArea];
}

// receiving messages
function receiveMessage(e) {
	let message = e.data;
	let command = message.substring(1, message.indexOf("]"));
	message = message.substring(message.indexOf("]") + 1);
	
	switch (command) {
		case "chat": { // incoming chat message
			if (!opponentName || opponentName == "") {
				putChatMessage(locale["chat"]["opponent"] + locale["chat"]["colon"] + message);
			} else {
				putChatMessage(opponentName + locale["chat"]["colon"] + message);
			}
			break;
		}
		case "deck": { // initially syncs the opponent deck.
			opponentDeck = JSON.parse(message);
			cardAreas["deck0"].setDeck(opponentDeck);
			break;
		}
		case "deckOrder": { // opponent shuffled a deck
			let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
			message = message.substr(2);
			cardOrder = message.split("|");
			cardOrder.forEach(id => {
				deck.cards.push(deck.cards.splice(deck.cards.findIndex(card => {return card.id == cardIdToLocal(id)}), 1)[0]);
			});
			putChatMessage(locale[deck.playerIndex == 1? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
			break;
		}
		case "choosePartner": { // opponent selected their partner
			field2.src = "images/cardBackFrameP0.png";
			let partnerPosInDeck = cardAreas["deck0"].cards.findIndex(card => {return card.id == cardIdToLocal(message)});
			opponentPartner = cardAreas["deck0"].cards.splice(partnerPosInDeck, 1)[0];
			cardAreas["deck0"].updateVisual();
			doSelectStartingPlayer();
			break;
		}
		case "revealPartner": { // opponent revealed their partner
			field2.src = "images/cardHidden.png";
			cardAreas["field2"].dropCard(opponentPartner);
			break;
		}
		case "selectPlayer": { // opponent chose the starting player (at random)
			startingPlayerSelect.style.display = "none";
			putChatMessage(message == "true"? locale["opponentStarts"] : locale["youStart"], "notice");
			partnerRevealButtonDiv.style.display = "block";
			break;
		}
		case "grabbedCard": { // opponent picked up a card
			let cardArea = cardAreas[cardAreaToLocal(message.substr(0, message.indexOf("|")))];
			let cardId = cardIdToLocal(message.substr(message.indexOf("|") + 1));
			
			let hiddenGrab = cardArea.isGrabHidden(cardId)
			opponentHeldCard = cardArea.grabCard(cardId);
			opponentCursor.src = hiddenGrab? "images/cardBackFrameP0.png" : opponentHeldCard.getImage();
			break;
		}
		case "droppedCard": { // opponent dropped a card
			if (message != "") {
				let cardArea = cardAreaToLocal(message);
				if (opponentHeldCard.type == "token" && !cardAreas[cardArea].allowTokens) { // no tokens allowed, this'll just vanish the card
					opponentHeldCard.location?.dragFinish(opponentHeldCard);
				} else if (cardArea.startsWith("deck")) { // if the card was dropped to deck, don't call the drop function to not prompt the local player with the options
					// return early if the opponent dropped to deck, so that opponentHeldCard does not get cleared.
					opponentCursor.src = "images/opponentCursor.png";
					return;
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
			break;
		}
		case "deckTop": { // opponent sent their held card to the top of a deck
			let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
			let cardId = cardIdToLocal(message.substr(message.indexOf("|") + 1));
			let card = getCardById(cardId);
			if (card != opponentHeldCard) {
				card.location.grabCard(cardId);
			} else {
				opponentHeldCard = null;
			}
			
			deck.cards.push(card);
			card.location?.dragFinish(card);
			card.location = deck;
			card = null;
			deck.updateVisual();
			break;
		}
		case "deckBottom": { // opponent sent their held card to the bottom of a deck
			let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
			let cardId = cardIdToLocal(message.substr(message.indexOf("|") + 1));
			let card = getCardById(cardId);
			if (card != opponentHeldCard) {
				card.location.grabCard(cardId);
			} else {
				opponentHeldCard = null;
			}
			
			deck.cards.unshift(card);
			card.location?.dragFinish(card);
			card.location = deck;
			card = null;
			deck.updateVisual();
			break;
		}
		case "deckShuffle": { // opponent shuffles their held card into a deck
			let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
			let cardId = cardIdToLocal(message.substr(message.indexOf("|") + 1));
			let card = getCardById(cardId);
			if (card != opponentHeldCard) {
				card.location.grabCard(cardId);
			} else {
				opponentHeldCard = null;
			}
			
			deck.cards.push(card); // the [deckOrder] message will arrive right after this one.
			card.location?.dragFinish(card);
			card.location = deck;
			card = null;
			deck.updateVisual();
			break;
		}
		case "deckCancel": { // opponent cancelled dropping their held card into a deck
			opponentHeldCard.location?.returnCard(opponentHeldCard);
			opponentHeldCard = null;
			break;
		}
		case "drawCard": { // opponent drew a card
			cardAreas["deck0"].draw();
			break;
		}
		case "showDeckTop": { // opponent presented a card
			let deck = cardAreas[cardAreaToLocal("deck" + message[0])];
			deck.showTop(0);
			break;
		}
		case "life": { // set opponent's life
			life[0] = message;
			updateLifeDisplay(0);
			break;
		}
		case "mana": { // set opponent's mana
			mana[0] = message;
			updateManaDisplay(0);
			break;
		}
		case "hideCursor": { // hide opponent's cursor
			opponentCursor.setAttribute("hidden", "");
			break;
		}
		case "placeCursor": { // move the opponent's cursor somewhere on the field
			oppCursorTargetX = message.substr(0, message.indexOf("|")) * -1;
			oppCursorTargetY = 1 - message.substr(message.indexOf("|") + 1);
			if (opponentCursor.hidden) {
				opponentCursor.removeAttribute("hidden");
				oppCursorX = oppCursorTargetX;
				oppCursorY = oppCursorTargetY;
			}
			break;
		}
		case "hideHand": { // opponent hid their hand
			cardAreas["hand0"].hideCards();
			break;
		}
		case "showHand": { // opponent revealed their hand
			cardAreas["hand0"].showCards();
			break;
		}
		case "playerFound": { // another player entered the roomcode
			roomCodeEntry.style.display = "none";
			// reset the waiting indicator
			waitingForOpponentSpan.style.display = "none";
			roomCodeInputFieldSpan.style.display = "inline";
			// send your own username and card back if you have any
			if (localStorage.getItem("username") !== "") {
				socket.send("[username]" + localStorage.getItem("username"));
			}
			if (localStorage.getItem("cardBack") !== "") {
				socket.send("[cardBack]" + localStorage.getItem("cardBack"));
			}
			
			updateRoomCodeDisplay();
			gameDiv.removeAttribute("hidden");
			
			switch (gameModeSelect.value) {
				case "normal":
					mainGameArea.removeAttribute("hidden");
					break;
				case "draft":
					startDraftGame();
					break;
			}
			break;
		}
		case "youAre": { // Indicates if this client is player 0 or 1.
			// TODO: This message is currently just sent by the server for simplicity but who is player 0 or 1 should really be negotiated by the clients in some form of initial handshake.
			youAre = parseInt(message);
			break;
		}
		case "dice": { // opponent rolled a dice with /dice in chat
			putChatMessage(locale["cardActions"]["I00040"]["opponentRoll"].replace("{#RESULT}", message), "notice");
			break;
		}
		case "quit": { // opponent quit the game (or crashed)
			socket.close();
			location.reload();
			break;
		}
		case "revealCard": { // opponent revealed a presented card
			let cardDiv = presentedCards0.children.item(parseInt(message));
			cardDiv.src = cardAreas["presentedCards0"].cards.find(card => {return card.id == cardDiv.dataset.cardId}).getImage();
			cardDiv.dataset.shown = true;
			break;
		}
		case "unrevealCard": { // opponent hid a presented card
			let cardDiv = presentedCards0.children.item(parseInt(message));
			cardDiv.src = "images/cardBackFrameP0.png";
			cardDiv.dataset.shown = false;
			break;
		}
		case "counterAdd": {
			addCounter(message);
			break;
		}
		case "counterIncrease": {
			let slotIndex = message.substr(0, message.indexOf("|"));
			let counterIndex = message.substr(message.indexOf("|") + 1);
			let counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
			counter.innerHTML = parseInt(counter.innerHTML) + 1;
			break;
		}
		case "counterDecrease": {
			let slotIndex = message.substr(0, message.indexOf("|"));
			let counterIndex = message.substr(message.indexOf("|") + 1);
			let counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
			counter.innerHTML = parseInt(counter.innerHTML) - 1;
			break;
		}
		case "counterRemove": {
			let slotIndex = message.substr(0, message.indexOf("|"));
			let counterIndex = message.substr(message.indexOf("|") + 1);
			document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex).remove();
			break;
		}
		case "username": {
			opponentName = message;
			draftDeckOwner1.textContent = opponentName;
			break;
		}
		case "cardBack": {
			setCardBackForPlayer(0, message);
			break;
		}
		case "createToken": {
			cardAreas.tokens.createOpponentToken(message);
			break;
		}
		case "draft": {
			draftHandleMessage(message);
			break;
		}
		default: {
			console.log("Received unknown message:\n" + message);
		}
	}
}

// roomcode entry and websocket initialization
function connect() {
	if (roomcode == "") {
		if (document.getElementById("roomCodeInputField").value == "") {
			roomcode = defaultRoomCode;
		} else {
			roomcode = document.getElementById("roomCodeInputField").value;
		}
		
		socket = new WebSocket("wss://battle.crossuniverse.net:443/ws");
		socket.addEventListener("open", function (event) {
			socket.send("[roomcode]" + roomcode + gameModeSelect.value.repeat(10));
		});
		
		socket.addEventListener("message", receiveMessage);
		
		// hide input field and show waiting indicator
		roomCodeInputFieldSpan.setAttribute("hidden", "");
		waitingForOpponentSpan.removeAttribute("hidden");
		// refresh the "Waiting for Opponent" text so screen readers read it out.
		setTimeout(() => {
			trWaitingForOpponent.textContent = locale["waitingForOpponent"];
			cancelWaitingBtn.focus();
		}, 100);
	}
}
// pressing enter in the roomcode entry field to connect
document.getElementById("roomCodeInputField").addEventListener("keyup", function() {
	if (event.keyCode === 13) {
		connect();
	}
});
// clicking the connect button to connect
document.getElementById("connectBtn").addEventListener("click", connect);
// canceling a connection
document.getElementById("cancelWaitingBtn").addEventListener("click", function() {
	roomcode = "";
	socket.close();
	waitingForOpponentSpan.setAttribute("hidden", "");
	roomCodeInputFieldSpan.removeAttribute("hidden");
	roomCodeInputField.focus();
});

// sending cursor updates
document.getElementById("field").addEventListener("mouseleave", function() {
	socket.send("[hideCursor]");
});
document.getElementById("field").addEventListener("mousemove", function(e) {
	// check if the normalized cursor position is within the bounds of the visual field
	if (Math.abs(myCursorX) < 3500 / 2741 / 2) { // 3500 and 2741 being the width and height of the field graphic
		socket.send("[placeCursor]" + myCursorX + "|" + myCursorY);
	} else {
		socket.send("[hideCursor]");
	}
});


// Functions to sync various parts of gameplay

// initial setup
function syncDeck() {
	let message = "[deck]";
	message += JSON.stringify(loadedDeck);
	socket.send(message);
}
function syncPartnerChoice() {
	socket.send("[choosePartner]" + loadedPartner.id);
}
function syncRevealPartner() {
	socket.send("[revealPartner]");
}
function syncDeckOrder(deck) {
	let message = "[deckOrder]" + deck.playerIndex;
	deck.cards.forEach(card => {
		message += "|" + card.id;
	});
	socket.send(message);
}

// grabbing & dropping cards...
function syncGrab(cardArea, cardId) {
	socket.send("[grabbedCard]" + cardArea + "|" + cardId);
}
function syncDrop(cardArea) {
	socket.send("[droppedCard]" + cardArea);
}

// ...to decks
function syncDeckTop(deck, card) {
	socket.send("[deckTop]" + deck.playerIndex + "|" + card.id);
}
function syncDeckBottom(deck, card) {
	socket.send("[deckBottom]" + deck.playerIndex + "|" + card.id);
}
function syncDeckShuffleIn(deck, card) {
	socket.send("[deckShuffle]" + deck.playerIndex + "|" + card.id);
}
function syncDeckCancel() {
	socket.send("[deckCancel]");
}
function syncDraw() {
	socket.send("[drawCard]");
}
function syncShowDeckTop(deck) {
	socket.send("[showDeckTop]" + deck.playerIndex);
}
// creating a token
function syncCreateToken(cardId) {
	socket.send("[createToken]" + cardId);
}

// syncing player values
function syncLife() {
	socket.send("[life]" + life[1]);
}
function syncMana() {
	socket.send("[mana]" + mana[1]);
}

// syncing hand and card presenting
function syncHandReveal() {
	socket.send("[showHand]");
}

function syncHandHide() {
	socket.send("[hideHand]");
}

function syncCardReveal(cardIndex) {
	socket.send("[revealCard]" + cardIndex);
}

function syncCardUnreveal(cardIndex) {
	socket.send("[unrevealCard]" + cardIndex);
}

// syncing counters
function syncAddCounter(fieldSlot) {
	fieldSlot = 19 - fieldSlot;
	socket.send("[counterAdd]" + fieldSlot);
}
function syncCounterIncrease(fieldSlot, counterIndex) {
	fieldSlot = 19 - fieldSlot;
	socket.send("[counterIncrease]" + fieldSlot + "|" + counterIndex);
}
function syncCounterDecrease(fieldSlot, counterIndex) {
	fieldSlot = 19 - fieldSlot;
	socket.send("[counterDecrease]" + fieldSlot + "|" + counterIndex);
}
function syncRemoveCounter(fieldSlot, counterIndex) {
	fieldSlot = 19 - fieldSlot;
	socket.send("[counterRemove]" + fieldSlot + "|" + counterIndex);
}