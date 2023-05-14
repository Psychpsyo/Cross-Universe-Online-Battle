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
		case "quit": { // opponent quit the game (or crashed)
			socket.close();
			location.reload();
			break;
		}
		default: {
			if (!gameState?.receiveMessage(command, message)) {
				console.log("Received unknown message:\nCommand: " + command + "\nMessage: " + message);
			}
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
		
		import("/modules/initState.js").then(initModule => {
			gameState = new initModule.InitState();
		});
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


// Functions to sync various parts of gameplay

// initial setup
function syncPartnerChoice(partnerPosInDeck) {
	socket.send("[choosePartner]" + partnerPosInDeck);
}
function syncRevealPartner() {
	socket.send("[revealPartner]");
}
function syncDeckOrder(deck, order) {
	let message = "[deckOrder]" + deck.playerIndex;
	order.forEach(index => {
		message += "|" + index;
	});
	socket.send(message);
}

// grabbing & dropping cards...
function syncGrab(cardArea, cardIndex) {
	socket.send("[grabbedCard]" + cardArea + "|" + cardIndex);
}
function syncDrop(cardArea) {
	socket.send("[droppedCard]" + cardArea);
}

// ...to decks
function syncDeckTop(deck, card) {
	socket.send("[deckTop]" + deck.playerIndex);
}
function syncDeckBottom(deck, card) {
	socket.send("[deckBottom]" + deck.playerIndex);
}
function syncDeckShuffleIn(deck, card) {
	socket.send("[deckShuffle]" + deck.playerIndex);
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
	socket.send("[life]" + localPlayer.life);
}
function syncMana() {
	socket.send("[mana]" + localPlayer.mana);
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