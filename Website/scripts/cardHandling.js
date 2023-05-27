import {Card} from "/modules/card.js";
import {cardActions} from "/modules/cardActions.js";
import {socket} from "/modules/netcode.js";

class cardArea {
	constructor(name, handleGrab=true, handleDrop=true) {
		this.name = name;
		cardAreas[this.name] = this;
		this.cards = [];
		
		// add event listeners
		if (handleGrab) {
			document.getElementById(name).addEventListener("dragstart", grabHandler);
		}
		if (handleDrop) {
			document.getElementById(name).addEventListener("mouseup", dropHandler);
		}
	}
	
	// call this to grab a card with a certain ID from the area. Returns the card (or null if grabbing failed).
	grabCard(cardIndex) {
		return null;
	}
	// call this when a card is moved into an area, returns true if the card was successfully moved there
	dropCard(player, card) {
		return false;
	}
	// returns the card to the area after an unsuccessful drag
	returnCard(card) {}
	// dragging a card off of this area has finished (this is called by the next area, once it accepted the card)
	dragFinish(card) {}
	// removing all cards from the area
	clear() {}
	
	// whether or not a card, when grabbed, should be hidden from the opponent
	isGrabHidden(cardIndex) {
		return false;
	}
	
	// gets the user-facing name of this card area
	getLocalizedName() {
		return "";
	}
}

class fieldCardArea extends cardArea {
	constructor(fieldIndex) {
		super("field" + fieldIndex);
		
		this.fieldSlot = document.getElementById("field" + fieldIndex);
		this.isDragSource = false;
		this.allowTokens = true;
		
		// event handler for inspecting the card in here
		this.fieldSlot.addEventListener("click", function(e) {
			if (cardAreas[this.id].cards[0]) {
				previewCard(cardAreas[this.id].cards[0]);
				e.stopPropagation();
			}
		});
	}
	
	// cardArea interface functions
	grabCard(cardIndex) {
		if (this.cards.length > 0 && !this.isDragSource && !this.isFaceDown()) {
			this.setDragSource(true);
			return this.cards.pop();
		}
		return null;
	}
	dropCard(player, card) {
		if (this.cards.length == 0 && !this.isDragSource && !this.isFaceDown()) {
			this.cards.push(card);
			card.location?.dragFinish(card);
			card.location = this;
			this.fieldSlot.src = card.getImage();
			
			// add card action buttons
			if (card.cardId in cardActions) {
				for (const [key, value] of Object.entries(cardActions[card.cardId])) {
					let button = document.createElement("button");
					button.textContent = locale.cardActions[card.cardId][key];
					button.addEventListener("click", value);
					this.fieldSlot.parentElement.querySelector(".cardActionHolder").appendChild(button);
				}
			}
			
			return true;
		}
		return false;
	}
	returnCard(card) {
		this.cards.push(card);
		this.setDragSource(false);
	}
	dragFinish(card) {
		this.fieldSlot.src = "images/cardHidden.png";
		this.setDragSource(false);
		this.fieldSlot.parentElement.querySelector(".cardActionHolder").innerHTML = "";
	}
	
	// This is a setter for the isDragSource variable, also updating the fieldSlot visual
	setDragSource(state) {
		this.isDragSource = state;
		if (state) {
			this.fieldSlot.classList.add("dragSource");
		} else {
			this.fieldSlot.classList.remove("dragSource");
		}
	}
	
	// returns a bool, stating whether or not the card in this slot is face-down
	isFaceDown() {
		return this.fieldSlot.src.endsWith("images/cardBackFrameP1.png") || this.fieldSlot.src.endsWith("images/cardBackFrameP0.png");
	}
}

class myHandCardArea extends cardArea {
	constructor() {
		super("hand1", false);
	}
	
	grabCard(cardIndex) {
		if (cardIndex >= 0 && !Array.from(hand1.children)[cardIndex].classList.contains("dragSource")) {
			Array.from(hand1.children)[cardIndex].classList.add("dragSource");
			return this.cards[cardIndex];
		}
		return null;
	}
	dropCard(player, card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		// add the img for the new card to the DOM with its event handlers
		let newCard = document.createElement("img");
		newCard.src = card.getImage();
		newCard.classList.add("card");
		newCard.dataset.cardIndex = this.cards.length - 1;
		newCard.dataset.cardArea = "hand1";
		newCard.addEventListener("dragstart", grabHandler);
		newCard.addEventListener("click", function(e) {
			previewCard(cardAreas["hand1"].cards[parseInt(this.dataset.cardIndex)]);
			e.stopPropagation();
		});
		hand1.appendChild(newCard);
		hand1.style.setProperty("--card-count", "" + hand1.childElementCount);
		
		return true;
	}
	returnCard(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		Array.from(hand1.children)[cardIndex].classList.remove("dragSource");
	}
	dragFinish(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		this.cards.splice(cardIndex, 1)[0];
		Array.from(hand1.children)[cardIndex].remove();
		hand1.style.setProperty("--card-count", "" + hand1.childElementCount);
		Array.from(hand1.children).forEach((elem, i) => {
			elem.dataset.cardIndex = i;
		});
	}
}

// This is discard piles and exile zones since they work the same way
class pileCardArea extends cardArea {
	constructor(type, playerIndex) {
		super(type + playerIndex);
		this.playerIndex = playerIndex;
		this.type = type;
		
		// event handler to open the card list
		document.getElementById(type + playerIndex).addEventListener("click", function() {
			openCardSelect(cardAreas[type + playerIndex]);
		});
	}
	
	grabCard(cardIndex) {
		if (cardIndex >= 0 && cardIndex < this.cards.length) {
			let removedCard = this.cards.splice(cardIndex, 1)[0];
			this.updateDOM();
			return removedCard;
		}
		return null;
	}
	dropCard(player, card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		this.updateDOM();
		return true;
	}
	returnCard(card) {
		this.cards.push(card);
		this.updateDOM();
	}
	
	// called whenever the contents of the pile are changed
	updateDOM() {
		document.getElementById(this.type + this.playerIndex).src = this.cards[this.cards.length - 1]?.getImage() ?? "images/cardHidden.png";
		document.getElementById(this.type + this.playerIndex).dataset.cardIndex = this.cards.length - 1;
		document.getElementById(this.type + this.playerIndex + "CardCount").textContent = this.cards.length > 0? this.cards.length : "";
	}
	
	getLocalizedName() {
		return locale["cardSelector"][this.name];
	}
	
	returnAllToDeck() {
		if (this.cards.length == 0) {
			return;
		}
		socket.send("[returnAllToDeck]" + this.name);
		while (this.cards.length > 0) {
			cardAreas["deck1"].cards.push(this.cards.pop());
		}
		cardAreas["deck1"].shuffle();
		cardAreas["deck1"].updateVisual();
		this.updateDOM();
	}
}

class deckCardArea extends cardArea {
	constructor(playerIndex) {
		super("deck" + playerIndex, false)
		
		this.playerIndex = playerIndex;
		this.droppingCards = [null, null];
		
		// event handlers for dropping to deck
		document.getElementById("deckTopBtn" + playerIndex).addEventListener("click", function() {
			this.dropToTop(localPlayer);
		}.bind(this));
		document.getElementById("deckBottomBtn" + playerIndex).addEventListener("click", function() {
			this.dropToBottom(localPlayer);
		}.bind(this));
		document.getElementById("deckShuffleInBtn" + playerIndex).addEventListener("click", function() {
			this.shuffleIn(localPlayer);
		}.bind(this));
		document.getElementById("deckCancelBtn" + playerIndex).addEventListener("click", function() {
			this.cancelDrop(localPlayer);
		}.bind(this));
		
		// event handlers for hovering the deck
		document.getElementById(this.name).addEventListener("mouseover", function() {
			let deck = cardAreas["deck" + playerIndex];
			if (deck.cards.length > 0 && !cardDrags[localPlayer.index].card && !heldCard) {
				document.getElementById("deckHoverBtns" + playerIndex).style.display = "block";
			}
		});
		document.getElementById(this.name).parentElement.addEventListener("mouseleave", function(e) {
			document.getElementById("deckHoverBtns" + playerIndex).style.display = "none";
		});
		document.getElementById("showTopBtn" + playerIndex).addEventListener("click", function() {
			cardAreas["deck" + playerIndex].showTop(1);
			socket.send("[showDeckTop]" + playerIndex);
		});
		document.getElementById(this.name).addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		
		// event handlers for local player deck options
		if (playerIndex == 1) {
			document.getElementById("drawBtn").addEventListener("click", function() {
				cardAreas["deck1"].draw();
				socket.send("[drawCard]");
			});
			document.getElementById("shuffleBtn").addEventListener("click", function() {
				cardAreas["deck1"].shuffle();
			});
			document.getElementById("deckSearchBtn").addEventListener("click", function() {
				openCardSelect(cardAreas["deck1"]);
				document.getElementById("deckHoverBtns1").style.display = "none"; //workaround for bug in (at least) Firefox where mouseleave does not fire when element is covered by another. (in this case the card selector)
			});
		}
	}
	
	grabCard(cardIndex) {
		if (cardIndex >= 0 && cardIndex < this.cards.length) {
			let removedCard = this.cards.splice(cardIndex, 1)[0];
			this.updateVisual();
			return removedCard;
		}
		return null;
	}
	dropCard(player, card) {
		this.droppingCards[player.index] = card;
		if (player === localPlayer) {
			document.getElementById("deckDropOptions" + this.playerIndex).style.display = "block";
			canGrab = false;
		}
		return true;
	}
	returnCard(card) {
		this.cards.push(card);
		this.updateVisual();
	}
	
	getLocalizedName() {
		return locale["cardSelector"]["yourDeck"];
	}
	
	// all the options for when a card is dropped to deck:
	dropToTop(player) {
		let card = this.droppingCards[player.index];
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		this.dropDone(player);
		if (player === localPlayer) {
			socket.send("[deckTop]" + this.playerIndex);
		}
	}
	dropToBottom(player) {
		let card = this.droppingCards[player.index];
		this.cards.unshift(card);
		card.location?.dragFinish(card);
		card.location = this;
		this.dropDone(player);
		if (player === localPlayer) {
			socket.send("[deckBottom]" + this.playerIndex);
		}
	}
	shuffleIn(player) {
		let card = this.droppingCards[player.index];
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		if (player === localPlayer) {
			socket.send("[deckShuffle]" + this.playerIndex);
			this.shuffle();
		}
		this.dropDone(player);
	}
	cancelDrop(player) {
		this.droppingCards[player.index].location?.returnCard(this.droppingCards[player.index]);
		this.dropDone(player);
		if (player === localPlayer) {
			socket.send("[deckCancel]" + this.playerIndex);
		}
	}
	// called by the above functions
	dropDone(player) {
		this.droppingCards[player.index] = null;
		this.updateVisual();
		if (player === localPlayer) {
			document.getElementById("deckDropOptions" + this.playerIndex).style.display = "none";
			canGrab = true;
		}
	}
	
	// general deck related functions
	shuffle() {
		let order = [];
		for (var i = 0; i < this.cards.length; i++) {
			order.push(i);
		}
		// Fisher-Yates shuffle
		for (let i = order.length - 1; i >= 0; i--) {
			// pick a random element and swap it with the current element
			let rand = Math.floor(Math.random() * i);
			
			[order[i], order[rand]] = [order[rand], order[i]];
		}
		this.cards.sort((a, b) => order.indexOf(this.cards.indexOf(a)) - order.indexOf(this.cards.indexOf(b)));
		socket.send("[deckOrder]" + this.playerIndex + "|" + order.join("|"));
		putChatMessage(locale[this.playerIndex == 1? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
	}
	
	//drawing a card to hand (returns whether or not a card was revealed)
	draw() {
		if (this.cards.length == 0) {
			return false;
		}
		
		let drawnCard = this.cards.pop();
		cardAreas["hand" + this.playerIndex].dropCard(localPlayer, drawnCard);
		this.updateVisual();
	}
	
	// revealing the top of the deck to a player (returns whether or not a card was revealed)
	showTop(player) {
		if (this.cards.length == 0) {
			return false;
		}
		
		let shownCard = this.cards.pop();
		cardAreas["presentedCards" + player].dropCard(localPlayer, shownCard);
		this.updateVisual();
		return true;
	}
	
	// updates what the deck looks like in the DOM
	updateVisual() {
		document.getElementById("deck" + this.playerIndex).src = this.cards.length > 0? "images/cardBackFrameP" + this.playerIndex + ".png" : "images/cardHidden.png";
		document.getElementById("deck" + this.playerIndex + "CardCount").textContent = this.cards.length > 0? this.cards.length : "";
	}
}

class myPresentedCardsArea extends cardArea {
	constructor() {
		super("presentedCards1", false);
		this.isDragSource = false;
	}
	
	grabCard(cardIndex) {
		if (!this.isDragSource) {
			if (cardIndex >= 0) {
				presentedCards1.classList.add("presentedCardsDragSource");
				this.isDragSource = true;
				return this.cards[cardIndex];
			}
		}
		return null;
	}
	dropCard(player, card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		//set up the card DOM element
		let container = document.createElement("div");
		let cardImg = document.createElement("img")
		let revealBtn = document.createElement("button");
		
		cardImg.dataset.cardIndex = this.cards.length - 1;
		cardImg.src = card.getImage();
		cardImg.addEventListener("click", function(e) {
			previewCard(cardAreas["presentedCards1"].cards[parseInt(this.dataset.cardIndex)]);
			e.stopPropagation();
		});
		// make card grabbable
		cardImg.dataset.cardArea = this.name;
		cardImg.addEventListener("dragstart", grabHandler);
		
		//add the reveal button to reveal it to the opponent.
		revealBtn.textContent = locale["presentReveal"];
		revealBtn.dataset.shown = false;
		revealBtn.addEventListener("click", function() {
			if (this.dataset.shown == "true") {
				this.dataset.shown = false;
				this.textContent = locale["presentReveal"];
				socket.send("[unrevealCard]" + Array.from(this.parentElement.parentElement.children).indexOf(this.parentElement));
			} else {
				this.dataset.shown = true;
				this.textContent = locale["presentHide"];
				socket.send("[revealCard]" + Array.from(this.parentElement.parentElement.children).indexOf(this.parentElement));
			}
		});
		
		container.appendChild(cardImg);
		container.appendChild(revealBtn);
		
		presentedCards1.appendChild(container);
		
		return true;
	}
	returnCard(card) {
		presentedCards1.classList.remove("presentedCardsDragSource");
		this.isDragSource = false;
	}
	dragFinish(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		this.cards.splice(cardIndex, 1)[0];
		Array.from(presentedCards1.children)[cardIndex].remove();
		presentedCards1.classList.remove("presentedCardsDragSource");
		this.isDragSource = false;
		Array.from(presentedCards1.children).forEach((elem, i) => {
			elem.firstChild.dataset.cardIndex = i;
		});
	}
}

class opponentHandCardArea extends cardArea {
	constructor() {
		super("hand0", false, false);
		this.hidden = true;
	}
	
	grabCard(cardIndex) {
		if (cardIndex >= 0 && !Array.from(hand0.children)[cardIndex].classList.contains("dragSource")) {
			Array.from(hand0.children)[cardIndex].classList.add("dragSource");
			return this.cards[cardIndex];
		}
		return null;
	}
	dropCard(player, card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		// add the img for the new card to the DOM with its event handlers
		let newCard = document.createElement("img");
		newCard.src = this.hidden? "images/cardBackFrameP0.png" : card.getImage();
		newCard.classList.add("card");
		newCard.dataset.cardIndex = this.cards.length - 1;
		newCard.addEventListener("click", function(e) {
			if (!cardAreas["hand0"].hidden) {
				previewCard(cardAreas["hand0"].cards[parseInt(this.dataset.cardIndex)]);
				e.stopPropagation();
			}
		});
		newCard.addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		hand0.appendChild(newCard, hand0.firstChild);
		hand0.style.setProperty("--card-count", "" + hand0.childElementCount);
		return true;
	}
	returnCard(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		Array.from(hand0.children)[cardIndex].classList.remove("dragSource");
	}
	dragFinish(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		this.cards.splice(cardIndex, 1)[0];
		Array.from(hand0.children)[cardIndex].remove();
		hand0.style.setProperty("--card-count", "" + hand0.childElementCount);
		Array.from(hand0.children).forEach((elem, i) => {
			elem.dataset.cardIndex = i;
		});
	}
	
	// hiding and revealing the hand
	hideCards() {
		this.hidden = true;
		Array.from(hand0.children).forEach(img => {
			img.src = "images/cardBackFrameP0.png";
		});
		document.getElementById("hand0").classList.remove("shown");
	}
	
	showCards() {
		this.hidden = false;
		Array.from(document.getElementById("hand0").children).forEach(img => {
			img.src = this.cards[parseInt(img.dataset.cardIndex)].getImage();
		});
		document.getElementById("hand0").classList.add("shown");
	}
}

class opponentPresentedCardsArea extends cardArea {
	constructor() {
		super("presentedCards0", false, false);
	}
	
	grabCard(cardIndex) {
		Array.from(presentedCards0.children)[cardIndex].classList.add("dragSource");
		return this.cards[cardIndex];
	}
	dropCard(player, card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		//set up the card DOM element
		let cardImg = document.createElement("img")
		cardImg.src = "images/cardBackFrameP0.png";
		cardImg.dataset.shown = false;
		cardImg.dataset.cardIndex = this.cards.length - 1;
		cardImg.addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		cardImg.addEventListener("click", function(e) {
			if (this.dataset.shown == "true") {
				previewCard(cardAreas["presentedCards0"].cards[parseInt(this.dataset.cardIndex)]);
				e.stopPropagation();
			}
		});
		presentedCards0.appendChild(cardImg);
		
		return true;
	}
	returnCard(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		Array.from(presentedCards0.children)[cardIndex].classList.remove("dragSource");
		this.isDragSource = false;
	}
	dragFinish(card) {
		let cardIndex = this.cards.findIndex(c => c == card);
		this.cards.splice(cardIndex, 1)[0];
		Array.from(presentedCards0.children)[cardIndex].remove();
		presentedCards0.classList.remove("presentedCardsDragSource");
		Array.from(presentedCards0.children).forEach((elem, i) => {
			elem.dataset.cardIndex = i;
		});
		this.isDragSource = false;
	}
	
	isGrabHidden(cardIndex) {
		return Array.from(presentedCards0.children)[cardIndex].dataset.shown == "false";
	}
	
	// gets the img element in hand that corresponds to a cardId
	getFromElement(cardId) {
		return Array.from(presentedCards0.children).find(elem => {return elem.dataset.cardId == cardId});
	}
}

class tokenCardsArea extends cardArea {
	constructor(type, playerIndex) {
		super("tokens", false, false);
		
		this.createdToken = null;
		
		// event handler to open the token list
		tokenBtn.addEventListener("click", function() {
			openCardSelect(cardAreas["tokens"]);
		});
	}
	
	grabCard(cardIndex) {
		if (this.createdToken) {
			return this.createdToken;
		}
		socket.send("[createToken]" + this.cards[cardIndex].cardId);
		return new Card(localPlayer, this.cards[cardIndex].cardId);
	}
	
	// creates token cards when the opponent asks for them
	createOpponentToken(cardId) {
		this.createdToken = new Card(game.players[0], cardId);
	}
	
	getLocalizedName() {
		return locale["cardSelector"]["tokens"];
	}
}

// universal grab and drop handlers for dragging cards around
window.grabHandler = function(e) {
	e.preventDefault();
	if (canGrab) {
		let cardIndex = this.dataset.cardIndex;
		grabCard(localPlayer, cardAreas[this.dataset.cardArea], cardIndex);
		socket.send("[grabbedCard]" + this.dataset.cardArea + "|" + cardIndex);
	}
}
export function grabCard(player, cardArea, cardIndex) {
	let grabbedCard = cardArea.grabCard(cardIndex);
	if (grabbedCard) {
		cardDrags[player.index].set(grabbedCard, cardArea.isGrabHidden(cardIndex));
	}
}
window.dropHandler = function() {
	if (cardDrags[localPlayer.index].card) {
		dropCard(localPlayer, cardAreas[this.dataset.cardArea]);
		socket.send("[droppedCard]" + this.dataset.cardArea);
	}
}
export function dropCard(player, cardArea) {
	let heldCard = cardDrags[player.index].card;
	if (heldCard.getCardTypes().includes("token") && !cardArea.allowTokens) {
		heldCard.location?.dragFinish(heldCard);
	} else if (!cardArea || !cardArea.dropCard(player, heldCard)) {
		heldCard.location?.returnCard(heldCard);
	}
	cardDrags[player.index].clear();
}

// create all the cardAreas
// TODO: move this into init once it is no longer needed by Player.setDeck()
new deckCardArea(0);
new deckCardArea(1);
export function uiInit() {
	for (let i = 0; i < 20; i++) {
		new fieldCardArea(i);
	}
	new myHandCardArea();
	new opponentHandCardArea();
	new pileCardArea("discard", 0);
	new pileCardArea("discard", 1);
	new pileCardArea("exile", 0);
	new pileCardArea("exile", 1);
	new myPresentedCardsArea();
	new opponentPresentedCardsArea();
	new tokenCardsArea();
	
	// dropping cards off in nowhere
	document.addEventListener("mouseup", function() {
		if (cardDrags[localPlayer.index].card) {
			dropCard(localPlayer, null);
			socket.send("[droppedCard]");
		}
	});
	
	fetch("https://crossuniverse.net/cardInfo", {
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
			cardAreas["tokens"].cards.push(new Card(localPlayer, card.cardID));
		});
	});
}