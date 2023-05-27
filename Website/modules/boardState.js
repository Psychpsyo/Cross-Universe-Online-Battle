// This module exports the board state which is the main game state where the players actually play.
import {GameState} from "/modules/gameState.js";
import {socket, cardAreaToLocal} from "/modules/netcode.js";
import {uiInit, grabCard, dropCard} from "/scripts/cardHandling.js";

window.cardDrags = [];
let lastFrame = 0;

class CardDrag {
	constructor(player) {
		this.player = player;
		this.card = null;
		this.source = null;
		this.posX = 0;
		this.posY = 0;
		this.lastX = 0;
		this.lastY = 0;
		this.targetX = 0;
		this.targetY = 0;
		
		this.imgElem = document.createElement("img");
		this.imgElem.classList.add("dragCard");
		draggedCardImages.appendChild(this.imgElem);
		if (player == localPlayer) {
			this.imgElem.id = "yourDragCard";
		} else {
			this.cursorElem = document.createElement("img");
			this.cursorElem.classList.add("dragCard");
			this.cursorElem.src = "images/opponentCursor.png";
			draggedCardImages.appendChild(this.cursorElem);
		}
	}
	
	set(card, hidden) {
		if (card) {
			this.card = card;
			this.imgElem.src = hidden? "images/cardBackFrameP" + this.player.index + ".png" : card.getImage();
		}
	}
	
	clear() {
		this.imgElem.src = "images/cardHidden.png";
		this.card = null;
	}
}

//disable right-click on field
document.getElementById("field").addEventListener("contextmenu", function (e) {e.preventDefault();});

//showing/hiding your hand
function hideHand() {
	socket.send("[hideHand]");
	document.getElementById("showHandBtn").textContent = locale["actionsShowHand"];
	document.getElementById("showHandBtn").addEventListener("click", showHand, {once: true});
	document.getElementById("hand1").classList.remove("shown");
}
function showHand() {
	socket.send("[showHand]");
	document.getElementById("showHandBtn").textContent = locale["actionsHideHand"];
	document.getElementById("showHandBtn").addEventListener("click", hideHand, {once: true});
	document.getElementById("hand1").classList.add("shown");
}
document.getElementById("showHandBtn").addEventListener("click", showHand, {once: true});

//life changes
document.getElementById("lifeUp100").addEventListener("click", function() {
	localPlayer.life += 100;
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});
document.getElementById("lifeUp50").addEventListener("click", function() {
	localPlayer.life += 50;
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});
document.getElementById("lifeUp1").addEventListener("click", function() {
	localPlayer.life += 1;
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});
document.getElementById("lifeDown100").addEventListener("click", function() {
	localPlayer.life = Math.max(localPlayer.life - 100, 0);
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});
document.getElementById("lifeDown50").addEventListener("click", function() {
	localPlayer.life = Math.max(localPlayer.life - 50, 0);
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});
document.getElementById("lifeDown1").addEventListener("click", function() {
	localPlayer.life = Math.max(localPlayer.life - 1, 0);
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});
document.getElementById("lifeHalf").addEventListener("click", function() {
	localPlayer.life = Math.ceil(localPlayer.life / 2);
	updateLifeDisplay(localPlayer);
	socket.send("[life]" + localPlayer.life);
});

//mana changes
document.getElementById("manaUp").addEventListener("click", function() {
	localPlayer.mana++;
	updateManaDisplay(localPlayer);
	socket.send("[mana]" + localPlayer.mana);
});
document.getElementById("manaFive").addEventListener("click", function() {
	localPlayer.mana = 5;
	updateManaDisplay(localPlayer);
	socket.send("[mana]" + localPlayer.mana);
});
document.getElementById("manaDown").addEventListener("click", function() {
	localPlayer.mana = Math.max(localPlayer.mana - 1, 0);
	updateManaDisplay(localPlayer);
	socket.send("[mana]" + localPlayer.mana);
});

//adding counters
// adds a counter to the specified field slot
function addCounter(slotIndex) {
	let counter = document.createElement("div");
	counter.classList.add("counter");
	counter.textContent = "1";
	//prevent middle click default actions
	counter.addEventListener("mousedown", function (e) {e.preventDefault();})
	//edit the counter
	counter.addEventListener("click", function(e) {
		this.textContent = parseInt(this.textContent) + 1;
		let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
		let counterIndex = Array.from(this.parentElement.children).indexOf(this);
		socket.send("[counterIncrease]" + fieldSlot + "|" + counterIndex);
	});
	counter.addEventListener("auxclick", function(e) {
		let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
		let counterIndex = Array.from(this.parentElement.children).indexOf(this);
		switch (e.button) {
			case 1:
				this.remove();
				socket.send("[counterRemove]" + fieldSlot + "|" + counterIndex);
				break;
			case 2:
				if (parseInt(this.textContent) == 0) {
					this.remove();
					socket.send("[counterRemove]" + fieldSlot + "|" + counterIndex);
				} else {
					this.textContent = parseInt(this.textContent) - 1;
					socket.send("[counterDecrease]" + fieldSlot + "|" + counterIndex);
				}
				break;
		}
		e.preventDefault();
	});
	
	document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").prepend(counter);
}
// event listeners to add counters and sync those additions.
for (let btn of Array.from(document.getElementsByClassName("counterAddBtn"))) {
	btn.addEventListener("click", function() {
		let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
		addCounter(fieldSlot);
		socket.send("[counterAdd]" + fieldSlot);
	});
}

function animateCursors(currentTime) {
	let delta = currentTime - lastFrame;
	lastFrame = currentTime;
	
	let fieldRect = document.getElementById("field").getBoundingClientRect();
	for (let drag of cardDrags) {
		drag.posX += (drag.targetX - drag.posX) / 5;
		drag.posY += (drag.targetY - drag.posY) / 5;
		
		drag.imgElem.style.left = (drag.posX * fieldRect.height + fieldRect.width / 2) + "px";
		drag.imgElem.style.top = drag.posY * fieldRect.height + "px";
		if (drag.player !== localPlayer) {
			drag.cursorElem.style.left = drag.imgElem.style.left;
			drag.cursorElem.style.top = drag.imgElem.style.top;
		}
		
		let velX = drag.posX - drag.lastX;
		let velY = drag.lastY - drag.posY;
		
		let flipped = drag.player.index % 2 == 0;
		drag.imgElem.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (velX > 0? Math.min(Math.PI / 3, velX * 100) : Math.max(Math.PI / -3, velX * 100)) + "rad) rotateX(" + (velY > 0? Math.min(Math.PI / 3, velY * 100) : Math.max(Math.PI / -3, velY * 100)) + "rad)" + (flipped? " rotateZ(180deg)" : "");
		
		drag.lastX = drag.posX;
		drag.lastY = drag.posY;
	}
	
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


// selecting starting player
document.getElementById("startingPlayerSelect").addEventListener("click", function() {
	document.getElementById("startingPlayerSelect").style.display = "none";
	let startingPlayer = Math.random() > .5;
	putChatMessage(startingPlayer? locale["youStart"] : locale["opponentStarts"], "notice");
	socket.send("[selectPlayer]" + startingPlayer);
	partnerRevealButtonDiv.style.display = "block";
});


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
		if (card.getCardTypes().contains("unit")) {
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
		for (const player of game.players) {
			cardDrags.push(new CardDrag(player));
		}
		document.addEventListener("mousemove", function(e) {
			let fieldRect = document.getElementById("field").getBoundingClientRect();
			cardDrags[1].targetX = (e.clientX - fieldRect.left - fieldRect.width / 2) / fieldRect.height;
			cardDrags[1].targetY = (e.clientY - fieldRect.top) / fieldRect.height;
			cardDrags[1].posX = cardDrags[1].targetX;
			cardDrags[1].posY = cardDrags[1].targetY;
		});
		document.getElementById("field").addEventListener("mouseleave", function() {
			socket.send("[hideCursor]");
		});
		document.getElementById("field").addEventListener("mousemove", function() {
			// check if the normalized cursor position is within the bounds of the visual field
			if (Math.abs(cardDrags[1].posX) < 3500 / 2741 / 2) { // 3500 and 2741 being the width and height of the field graphic
				socket.send("[placeCursor]" + cardDrags[1].posX + "|" + cardDrags[1].posY);
			} else {
				socket.send("[hideCursor]");
			}
		});
		uiInit();
		
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
			cardAreas["field17"].dropCard(localPlayer, gameState.chosenPartners[1]);
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
				cardAreas["field2"].dropCard(game.players[0], this.chosenPartners[0]);
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
				grabCard(game.players[0], cardArea, cardIndex);
				return true;
			}
			case "droppedCard": { // opponent dropped a card
				let cardArea = null;
				if (message != "") {
					cardArea = cardAreas[cardAreaToLocal(message)];
				}
				dropCard(game.players[0], cardArea);
				return true;
			}
			case "deckTop": { // opponent sent their held card to the top of a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				deck.dropToTop(game.players[0]);
				return true;
			}
			case "deckBottom": { // opponent sent their held card to the bottom of a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				deck.dropToBottom(game.players[0]);
				return true;
			}
			case "deckShuffle": { // opponent shuffles their held card into a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				deck.shuffleIn(game.players[0]);
				return true;
			}
			case "deckCancel": { // opponent cancelled dropping their held card into a deck
				let deck = cardAreas[cardAreaToLocal("deck" + message)];
				deck.cancelDrop(game.players[0]);
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
				cardDrags[0].imgElem.setAttribute("hidden", "");
				cardDrags[0].cursorElem.setAttribute("hidden", "");
				return true;
			}
			case "placeCursor": { // move the opponent's cursor somewhere on the field
				cardDrags[0].targetX = message.substr(0, message.indexOf("|")) * -1;
				cardDrags[0].targetY = 1 - message.substr(message.indexOf("|") + 1);
				if (cardDrags[0].imgElem.hidden) {
					cardDrags[0].imgElem.removeAttribute("hidden");
					cardDrags[0].cursorElem.removeAttribute("hidden");
					cardDrags[0].posX = cardDrags[0].targetX;
					cardDrags[0].posY = cardDrags[0].targetY;
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
				addCounter(19 - message);
				return true;
			}
			case "counterIncrease": {
				let slotIndex = 19 - message.substr(0, message.indexOf("|"));
				let counterIndex = message.substr(message.indexOf("|") + 1);
				let counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
				counter.innerHTML = parseInt(counter.innerHTML) + 1;
				return true;
			}
			case "counterDecrease": {
				let slotIndex = 19 - message.substr(0, message.indexOf("|"));
				let counterIndex = message.substr(message.indexOf("|") + 1);
				let counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
				counter.innerHTML = parseInt(counter.innerHTML) - 1;
				return true;
			}
			case "counterRemove": {
				let slotIndex = 19 - message.substr(0, message.indexOf("|"));
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
				cardAreas["deck0"].updateVisual();
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