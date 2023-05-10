// used to keep track of local card IDs allocated by both the local player (P1, even) and the opponent (P0, odd)
// ID0 is left unallocated.
let nextP0CardId = 1;
let nextP1CardId = 2;
let allCards = [];

// card object
class Card {
	constructor(fromOpponent, cardId, deck = null, giveId = true) {
		if (giveId) {
			if (fromOpponent) {
				this.id = nextP0CardId;
				nextP0CardId += 2;
			} else {
				this.id = nextP1CardId;
				nextP1CardId += 2;
			}
		}
		this.cardId = cardId;
		switch (cardId[0]) {
			case "U":
				this.type = "unit";
				break;
			case "S":
				this.type = "spell";
				break;
			case "I":
				this.type = "item";
				break;
			case "T":
				this.type = "token";
				break;
			case "C":
				this.type = game.customCards[cardId].data.cardType;
				break;
		}
		this.location = null; // the card area that this card is in right now
		allCards.push(this);
	}
	
	getImage() {
		if (this.cardId[0] == "C") {
			return game.customCards[this.cardId].imageSrc;
		}
		return getCardImageFromID(this.cardId);
	}
	
	static sort(a, b) {
		if (a.cardId < b.cardId) {
			return -1;
		}
		if (a.cardId > b.cardId) {
			return 1;
		}
		return 0;
	}
}

function getCardById(id) {
	return allCards.find(card => card.id == id);
}

class cardArea {
	constructor(name, handleGrab=true, handleDrop=true) {
		this.name = name;
		cardAreas[this.name] = this;
		
		// add event listeners
		if (handleGrab) {
			document.getElementById(name).addEventListener("dragstart", grabHandler);
		}
		if (handleDrop) {
			document.getElementById(name).addEventListener("mouseup", dropHandler);
		}
	}
	
	// call this to grab a card with a certain ID from the area. Returns the card (or null if grabbing failed).
	grabCard(cardId) {
		return null;
	}
	// call this when a card is moved into an area, returns true if the card was successfully moved there
	dropCard(card) {
		return false;
	}
	// returns the card to the area after an unsuccessful drag
	returnCard(card) {}
	// dragging a card off of this area has finished (this is called by the next area, once it accepted the card)
	dragFinish(card) {}
	// removing all cards from the area
	clear() {}
	
	// whether or not a card, when grabbed, should be hidden from the opponent
	isGrabHidden(cardId) {
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
		this.card = null;
		this.isDragSource = false;
		this.allowTokens = true;
		
		// event handler for inspecting the card in here
		this.fieldSlot.addEventListener("click", function(e) {
			if (cardAreas[this.id]?.card) {
				previewCard(cardAreas[this.id].card.cardId);
				e.stopPropagation();
			}
		});
	}
	
	// cardArea interface functions
	grabCard(cardId) {
		if (this.card && !this.isDragSource && !this.isFaceDown()) {
			let retVal = this.card;
			this.card = null;
			this.setDragSource(true);
			return retVal;
		}
		return null;
	}
	dropCard(card) {
		if (!this.card && !this.isDragSource && !this.isFaceDown()) {
			this.card = card;
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
		this.card = card;
		this.setDragSource(false);
	}
	dragFinish(card) {
		this.fieldSlot.src = "images/cardHidden.png";
		this.setDragSource(false);
		this.fieldSlot.parentElement.querySelector(".cardActionHolder").innerHTML = "";
	}
	
	clear() {
		this.card = null;
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
		
		this.cards = [];
	}
	
	grabCard(cardId) {
		let cardIndex = this.cards.findIndex(card => {return card.id == cardId});
		if (cardIndex >= 0) {
			let removedCard = this.cards.splice(cardIndex, 1)[0];
			this.getFromElement(cardId).classList.add("dragSource");
			return removedCard;
		}
		return null;
	}
	dropCard(card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		// add the img for the new card to the DOM with its event handlers
		let newCard = document.createElement("img");
		newCard.src = card.getImage();
		newCard.classList.add("card");
		newCard.dataset.cardId = card.id;
		newCard.dataset.cardArea = "hand1";
		newCard.addEventListener("dragstart", grabHandler);
		newCard.addEventListener("click", function(e) {
			previewCard(getCardById(this.dataset.cardId).cardId);
			e.stopPropagation();
		});
		hand1.appendChild(newCard);
		hand1.style.setProperty("--card-count", "" + hand1.childElementCount);
		
		return true;
	}
	returnCard(card) {
		this.cards.push(card);
		this.getFromElement(card.id).classList.remove("dragSource");
	}
	dragFinish(card) {
		this.getFromElement(card.id).remove();
		hand1.style.setProperty("--card-count", "" + hand1.childElementCount);
	}
	clear() {
		this.cards = [];
		hand1.innerHTML = "";
		hand1.style.setProperty("--card-count", "0");
	}
	
	// gets the img element in hand that corresponds to a cardId
	getFromElement(cardId) {
		return Array.from(hand1.children).find(elem => {return elem.dataset.cardId == cardId});
	}
}

// This is discard piles and exile zones since they work the same way
class pileCardArea extends cardArea {
	constructor(type, playerIndex) {
		super(type + playerIndex);
		
		this.cards = [];
		this.playerIndex = playerIndex;
		this.type = type;
		
		// event handler to open the card list
		document.getElementById(type + playerIndex).addEventListener("click", function() {
			openCardSelect(cardAreas[type + playerIndex]);
		});
	}
	
	grabCard(cardId) {
		let cardIndex = this.cards.findIndex(card => {return card.id == cardId});
		if (cardIndex != -1 && cardIndex < this.cards.length) {
			let removedCard = this.cards.splice(cardIndex, 1)[0];
			this.updateDOM();
			return removedCard;
		}
		return null;
	}
	dropCard(card) {
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
	clear() {
		this.cards = [];
		this.updateDOM();
	}
	
	// called whenever the contents of the pile are changed
	updateDOM() {
		document.getElementById(this.type + this.playerIndex).src = this.cards[this.cards.length - 1]?.getImage() ?? "images/cardHidden.png";
		document.getElementById(this.type + this.playerIndex).dataset.cardId = this.cards[this.cards.length - 1]?.id;
		document.getElementById(this.type + this.playerIndex + "CardCount").textContent = this.cards.length > 0? this.cards.length : "";
	}
	
	getLocalizedName() {
		return locale["cardSelector"][this.name];
	}
	
	returnAllToDeck() {
		while (this.cards.length > 0) {
			cardAreas["deck1"].dropToTop(this.cards.pop());
		}
		cardAreas["deck1"].shuffle();
		this.updateDOM();
	}
}

class deckCardArea extends cardArea {
	constructor(playerIndex) {
		super("deck" + playerIndex, false)
		
		this.playerIndex = playerIndex;
		this.cards = [];
		this.droppingCard = null;
		
		// event handlers for dropping to deck
		document.getElementById("deckTopBtn" + playerIndex).addEventListener("click", function() {
			this.dropToTop(this.droppingCard);
		}.bind(this));
		document.getElementById("deckBottomBtn" + playerIndex).addEventListener("click", function() {
			this.dropToBottom(this.droppingCard);
		}.bind(this));
		document.getElementById("deckShuffleInBtn" + playerIndex).addEventListener("click", function() {
			this.shuffleIn(this.droppingCard);
		}.bind(this));
		document.getElementById("deckCancelBtn" + playerIndex).addEventListener("click", this.cancelDrop.bind(this));
		
		// event handlers for hovering the deck
		document.getElementById(this.name).addEventListener("mouseover", function() {
			let deck = cardAreas["deck" + playerIndex];
			if (deck.cards.length > 0 && !deck.droppingCard && !heldCard) {
				document.getElementById("deckHoverBtns" + playerIndex).style.display = "block";
			}
		});
		document.getElementById(this.name).parentElement.addEventListener("mouseleave", function(e) {
			document.getElementById("deckHoverBtns" + playerIndex).style.display = "none";
		});
		document.getElementById("showTopBtn" + playerIndex).addEventListener("click", function() {
			cardAreas["deck" + playerIndex].showTop(1);
			syncShowDeckTop(cardAreas["deck" + playerIndex]);
		});
		document.getElementById(this.name).addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		
		// event handlers for local player deck options
		if (playerIndex == 1) {
			document.getElementById("drawBtn").addEventListener("click", function() {
				cardAreas["deck1"].draw();
				syncDraw();
			});
			document.getElementById("shuffleBtn").addEventListener("click", function() {
				cardAreas["deck1"].shuffle();
			});
			document.getElementById("deckSearchBtn").addEventListener("click", function() {
				openCardSelect(cardAreas["deck1"], true);
				document.getElementById("deckHoverBtns1").style.display = "none"; //workaround for bug in (at least) Firefox where mouseleave does not fire when element is covered by another. (in this case the card selector)
			});
		}
	}
	
	grabCard(cardId) {
		let cardIndex = this.cards.findIndex(card => {return card.id == cardId});
		if (cardIndex != -1 && cardIndex < this.cards.length) {
			let removedCard = this.cards.splice(cardIndex, 1)[0];
			this.updateVisual();
			return removedCard;
		}
		return null;
	}
	dropCard(card) {
		this.droppingCard = card;
		document.getElementById("deckDropOptions" + this.playerIndex).style.display = "block";
		canGrab = false;
		return true;
	}
	returnCard(card) {
		this.cards.push(card);
		this.updateVisual();
	}
	clear() {
		this.cards = [];
		this.updateVisual();
	}
	
	getLocalizedName() {
		return locale["cardSelector"]["yourDeck"];
	}
	
	// all the options for when a card is dropped to deck:
	dropToTop(card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		this.dropDone();
		syncDeckTop(this, card);
	}
	dropToBottom(card) {
		this.cards.unshift(card);
		card.location?.dragFinish(card);
		card.location = this;
		this.dropDone();
		syncDeckBottom(this, card);
	}
	shuffleIn(card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		syncDeckShuffleIn(this, card);
		this.shuffle();
		this.dropDone();
	}
	cancelDrop() {
		this.droppingCard.location?.returnCard(this.droppingCard);
		this.dropDone();
		syncDeckCancel();
	}
	// called by the above functions
	dropDone() {
		this.droppingCard = null;
		document.getElementById("deckDropOptions" + this.playerIndex).style.display = "none";
		this.updateVisual();
		canGrab = true;
	}
	
	// general deck related functions
	// sets the deck up from a json deck
	async setDeck(deck) {
		this.cards = await deckToCardList(deck, this.playerIndex == 0);
		this.cards.forEach(card => {
			card.location = this;
		});
		this.updateVisual();
	}
	
	// Fisher-Yates shuffle
	shuffle() {
		let i = this.cards.length;
		while (i != 0) {
			// pick a random element and swap it with the current element
			let rand = Math.floor(Math.random() * i);
			i--;
			
			[this.cards[i], this.cards[rand]] = [this.cards[rand], this.cards[i]];
		}
		syncDeckOrder(this);
		putChatMessage(locale[this.playerIndex == 1? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
	}
	
	//drawing a card to hand (returns whether or not a card was revealed)
	draw() {
		if (this.cards.length == 0) {
			return false;
		}
		
		let drawnCard = this.cards.pop();
		cardAreas["hand" + this.playerIndex].dropCard(drawnCard);
		this.updateVisual();
	}
	
	// revealing the top of the deck to a player (returns whether or not a card was revealed)
	showTop(player) {
		if (this.cards.length == 0) {
			return false;
		}
		
		let shownCard = this.cards.pop();
		cardAreas["presentedCards" + player].dropCard(shownCard);
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
		
		this.cards = [];
		this.isDragSource = false;
	}
	
	grabCard(cardId) {
		if (!this.isDragSource) {
			let cardIndex = this.cards.findIndex(card => {return card.id == cardId});
			if (cardIndex >= 0) {
				let removedCard = this.cards.splice(cardIndex, 1)[0];
				presentedCards1.classList.add("presentedCardsDragSource");
				this.isDragSource = true;
				return removedCard;
			}
		}
		return null;
	}
	dropCard(card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		//set up the card DOM element
		let container = document.createElement("div");
		let cardImg = document.createElement("img")
		let revealBtn = document.createElement("button");
		
		cardImg.dataset.cardId = card.id;
		cardImg.src = card.getImage();
		cardImg.addEventListener("click", function(e) {
			previewCard(getCardById(this.dataset.cardId).cardId);
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
				syncCardUnreveal(Array.from(this.parentElement.parentElement.children).indexOf(this.parentElement));
			} else {
				this.dataset.shown = true;
				this.textContent = locale["presentHide"];
				syncCardReveal(Array.from(this.parentElement.parentElement.children).indexOf(this.parentElement));
			}
		});
		
		container.appendChild(cardImg);
		container.appendChild(revealBtn);
		
		presentedCards1.appendChild(container);
		
		return true;
	}
	returnCard(card) {
		this.cards.push(card);
		presentedCards1.classList.remove("presentedCardsDragSource");
		this.isDragSource = false;
	}
	dragFinish(card) {
		Array.from(presentedCards1.children).find(elem => {return elem.firstChild.dataset.cardId == card.id}).remove();
		presentedCards1.classList.remove("presentedCardsDragSource");
		this.isDragSource = false;
	}
	clear() {
		this.cards = [];
		presentedCards1.innerHTML = "";
	}
}

class opponentHandCardArea extends cardArea {
	constructor() {
		super("hand0", false, false);
		
		this.cards = [];
		this.hidden = true;
	}
	
	grabCard(cardId) {
		let cardIndex = this.cards.findIndex(card => {return card.id == cardId});
		if (cardIndex >= 0) {
			let removedCard = this.cards.splice(cardIndex, 1)[0];
			this.getFromElement(cardId).classList.add("dragSource");
			return removedCard;
		}
		return null;
	}
	dropCard(card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		// add the img for the new card to the DOM with its event handlers
		let newCard = document.createElement("img");
		newCard.src = this.hidden? "images/cardBackFrameP0.png" : card.getImage();
		newCard.classList.add("card");
		newCard.dataset.cardId = card.id;
		newCard.addEventListener("click", function(e) {
			if (!cardAreas["hand0"].hidden) {
				previewCard(getCardById(this.dataset.cardId).cardId);
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
		this.cards.push(card);
		this.getFromElement(card.id).classList.remove("dragSource");
	}
	dragFinish(card) {
		this.getFromElement(card.id).remove();
		hand0.style.setProperty("--card-count", "" + hand0.childElementCount);
	}
	clear() {
		this.cards = [];
		hand0.innerHTML = "";
		hand0.style.setProperty("--card-count", "0");
		this.hidden = true;
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
			img.src = this.cards.find(card => {return card.id == img.dataset.cardId}).getImage();
		});
		document.getElementById("hand0").classList.add("shown");
	}
	
	// gets the img element in hand that corresponds to a cardId
	getFromElement(cardId) {
		return Array.from(hand0.children).find(elem => {return elem.dataset.cardId == cardId});
	}
}

class opponentPresentedCardsArea extends cardArea {
	constructor() {
		super("presentedCards0", false, false);
		
		this.cards = [];
	}
	
	grabCard(cardId) {
		let cardIndex = this.cards.findIndex(card => {return card.id == cardId});
		this.getFromElement(cardId).classList.add("dragSource");
		return this.cards.splice(cardIndex, 1)[0];
	}
	dropCard(card) {
		this.cards.push(card);
		card.location?.dragFinish(card);
		card.location = this;
		
		//set up the card DOM element
		let cardImg = document.createElement("img")
		cardImg.src = "images/cardBackFrameP0.png";
		cardImg.dataset.shown = false;
		cardImg.dataset.cardId = card.id;
		cardImg.addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		cardImg.addEventListener("click", function(e) {
			if (this.dataset.shown == "true") {
				previewCard(getCardById(this.dataset.cardId).cardId);
				e.stopPropagation();
			}
		});
		presentedCards0.appendChild(cardImg);
		
		return true;
	}
	returnCard(card) {
		this.cards.push(card);
		this.getFromElement(card.id).classList.remove("dragSource");
		this.isDragSource = false;
	}
	dragFinish(card) {
		this.getFromElement(card.id).remove();
		this.isDragSource = false;
	}
	clear() {
		this.cards = [];
		presentedCards0.innerHTML = "";
	}
	
	isGrabHidden(cardId) {
		return this.getFromElement(cardId).dataset.shown == "false";
	}
	
	// gets the img element in hand that corresponds to a cardId
	getFromElement(cardId) {
		return Array.from(presentedCards0.children).find(elem => {return elem.dataset.cardId == cardId});
	}
}

class tokenCardsArea extends cardArea {
	constructor(type, playerIndex) {
		super("tokens", false, false);
		
		this.cards = [];
		for (let i = TOKEN_COUNT; i > 0; i--) {
			let tokenId = "T" + ("" + i).padStart(5, "0");
			this.cards.push({
				"id": tokenId,
				"cardId": tokenId,
				"getImage": function() {
					return getCardImageFromID(this.cardId);
				}
			});
		}
		
		this.createdToken = null;
		
		// event handler to open the token list
		tokenBtn.addEventListener("click", function() {
			openCardSelect(cardAreas["tokens"]);
		});
	}
	
	grabCard(cardId) {
		if (("" + cardId).startsWith("T")) {
			syncCreateToken(cardId);
			return new Card(false, cardId);
		} else {
			return this.createdToken;
		}
	}
	
	// creates token cards when the opponent asks for them
	createOpponentToken(cardId) {
		this.createdToken = new Card(true, cardId);
	}
	
	getLocalizedName() {
		return locale["cardSelector"]["tokens"];
	}
}

// universal grab and drop handlers for dragging cards around
function grabHandler(e) {
	e.preventDefault();
	if (canGrab) {
		heldCard = cardAreas[this.dataset.cardArea].grabCard(this.dataset.cardId);
		if (heldCard) {
			dragCard.src = heldCard.getImage();
			syncGrab(this.dataset.cardArea, heldCard.id);
		}
	}
}
function dropHandler() {
	if (heldCard) {
		if (heldCard.type == "token" && !cardAreas[this.dataset.cardArea].allowTokens) {
			heldCard.location?.dragFinish(heldCard);
		} else if (!cardAreas[this.dataset.cardArea].dropCard(heldCard)) {
			heldCard.location?.returnCard(heldCard);
		}
		heldCard = null;
		dragCard.src = "images/cardHidden.png";
		syncDrop(this.dataset.cardArea);
	}
}

// create all the cardAreas
for (let i = 0; i < 20; i++) {
	new fieldCardArea(i);
}
new myHandCardArea();
new opponentHandCardArea();
new pileCardArea("discard", 0);
new pileCardArea("discard", 1);
new pileCardArea("exile", 0);
new pileCardArea("exile", 1);
new deckCardArea(0);
new deckCardArea(1);
new myPresentedCardsArea();
new opponentPresentedCardsArea();
new tokenCardsArea();

// dropping cards off in nowhere
document.addEventListener("mouseup", function() {
	if (heldCard) {
		heldCard.location?.returnCard(heldCard);
		heldCard = null;
		dragCard.src = "images/cardHidden.png";
		syncDrop("");
	}
});