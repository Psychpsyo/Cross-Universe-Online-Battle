import {cardActions} from "/modules/cardActions.js";
import {socket, zoneToLocal} from "/modules/netcode.js";

let cardSlots = [];
export let uiPlayers = [];
let lastFrame = 0;

let cardSelectorSlots = [];
export let cardSelectorZone = null;

export function init() {
	new fieldCardSlot(game.players[0].partnerZone, 0, 2);
	new fieldCardSlot(game.players[1].partnerZone, 0, 17);
	for (let i = 0; i < 5; i++) {
		new fieldCardSlot(game.players[0].unitZone, i, 9 - i);
		new fieldCardSlot(game.players[1].unitZone, i, 10 + i);
	}
	new fieldCardSlot(game.players[0].spellItemZone, 3, 0);
	new fieldCardSlot(game.players[0].spellItemZone, 2, 1);
	new fieldCardSlot(game.players[0].spellItemZone, 1, 3);
	new fieldCardSlot(game.players[0].spellItemZone, 0, 4);
	new fieldCardSlot(game.players[1].spellItemZone, 0, 15);
	new fieldCardSlot(game.players[1].spellItemZone, 1, 16);
	new fieldCardSlot(game.players[1].spellItemZone, 2, 18);
	new fieldCardSlot(game.players[1].spellItemZone, 3, 19);
	
	game.players.forEach(player => {
		uiPlayers.push(new UiPlayer(player));
		
		new deckCardSlot(player.deckZone);
		new pileCardSlot(player.discardPile);
		new pileCardSlot(player.exileZone);
		
		document.getElementById("hand" + player.index).addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, player.handZone, player.handZone.cards.length);
		});
	});
	
	// dropping cards off in nowhere
	document.addEventListener("mouseup", function() {
		dropCard(localPlayer, null, 0);
	});
	
	// setup cursor movement
	document.addEventListener("mousemove", function(e) {
		let fieldRect = document.getElementById("field").getBoundingClientRect();
		uiPlayers[1].targetX = (e.clientX - fieldRect.left - fieldRect.width / 2) / fieldRect.height;
		uiPlayers[1].targetY = (e.clientY - fieldRect.top) / fieldRect.height;
		uiPlayers[1].posX = uiPlayers[1].targetX;
		uiPlayers[1].posY = uiPlayers[1].targetY;
	});
	document.getElementById("field").addEventListener("mouseleave", function() {
		socket.send("[hideCursor]");
	});
	document.getElementById("field").addEventListener("mousemove", function() {
		// check if the normalized cursor position is within the bounds of the visual field
		if (Math.abs(uiPlayers[1].posX) < 3500 / 2741 / 2) { // 3500 and 2741 being the width and height of the field graphic
			socket.send("[placeCursor]" + uiPlayers[1].posX + "|" + uiPlayers[1].posY);
		} else {
			socket.send("[hideCursor]");
		}
	});
	
	cardSelector.addEventListener("click", function(e) {
		if (e.target === cardSelector) {
			closeCardSelect();
		}
	});
	cardSelector.addEventListener("cancel", function(e) {
		e.preventDefault();
		closeCardSelect();
	});
	
	lastFrame = performance.now();
	animate();
}

export function receiveMessage(command, message) {
	switch (command) {
		case "uiGrabbedCard": { // opponent picked up a card
			let zone = zoneToLocal(message.substr(0, message.indexOf("|")));
			let index = message.substr(message.indexOf("|") + 1);
			
			grabCard(game.players[0], zone, index);
			return true;
		}
		case "uiDroppedCard": { // opponent dropped a card
			let zone = null;
			let index = 0;
			if (message != "") {
				zone = zoneToLocal(message.substr(0, message.indexOf("|")));
				index = message.substr(message.indexOf("|") + 1);
			}
			
			dropCard(game.players[0], zone, index);
			return true;
		}
		case "hideCursor": { // hide opponent's cursor
			uiPlayers[0].dragCardElem.setAttribute("hidden", "");
			uiPlayers[0].cursorElem.setAttribute("hidden", "");
			return true;
		}
		case "placeCursor": { // move the opponent's cursor somewhere on the field
			uiPlayers[0].targetX = message.substr(0, message.indexOf("|")) * -1;
			uiPlayers[0].targetY = 1 - message.substr(message.indexOf("|") + 1);
			if (uiPlayers[0].dragCardElem.hidden) {
				uiPlayers[0].dragCardElem.removeAttribute("hidden");
				uiPlayers[0].cursorElem.removeAttribute("hidden");
				uiPlayers[0].posX = uiPlayers[0].targetX;
				uiPlayers[0].posY = uiPlayers[0].targetY;
			}
			return true;
		}
		case "revealCard": { // opponent revealed a presented card
			let index = parseInt(message);
			game.players[0].presentedZone.cards[index].hidden = false;
			updateCard(game.players[0].presentedZone, index);
			return true;
		}
		case "unrevealCard": { // opponent hid a presented card
			let index = parseInt(message);
			game.players[0].presentedZone.cards[index].hidden = true;
			updateCard(game.players[0].presentedZone, index);
			return true;
		}
		default: {
			return false;
		}
	}
}

export function updateCard(zone, index) {
	cardSlots.forEach(slot => {
		if (slot.zone === zone && slot.index == index) {
			slot.update();
		}
	});
}
export function removeCard(zone, index) {
	// iterates in reverse since the array may be modified during iteration
	for (let i = cardSlots.length - 1; i >= 0; i--) {
		if (cardSlots[i].zone === zone) {
			if (cardSlots[i].index == index) {
				cardSlots[i].remove();
			} else if (cardSlots[i].index > index && zone.size == -1) {
				cardSlots[i].index--;
			} else if (cardSlots[i].index == -1) {
				cardSlots[i].update();
			}
		}
	}
}
export function insertCard(zone, index) {
	if (zone.size > -1) {
		updateCard(zone, index);
		return;
	}
	cardSlots.forEach(slot => {
		if (slot.zone === zone) {
			if (slot.index >= index) {
				slot.index++;
			} else if (slot.index == -1) {
				slot.update();
			}
		}
	});
	
	if (zone.name.startsWith("hand")) {
		new handCardSlot(zone, index);
	} else if (zone.name.startsWith("presented")) {
		new presentedCardSlot(zone, index);
	}
}
export function makeDragSource(zone, index) {
	cardSlots.forEach(slot => {
		if (slot.zone == zone && slot.index == index) {
			slot.makeDragSource();
		}
	});
}
export function clearDragSource(zone, index) {
	cardSlots.forEach(slot => {
		if (slot.zone === zone && slot.index == index) {
			slot.clearDragSource();
		}
	});
}

function grabCard(player, zone, index) {
	if (gameState.controller.grabCard(player, zone, index) && player === localPlayer) {
		socket.send("[uiGrabbedCard]" + zone.name + "|" + index);
	}
}
function dropCard(player, zone, index) {
	if (uiPlayers[player.index].dragging) {
		if (player === localPlayer) {
			socket.send("[uiDroppedCard]" + (zone? zone.name + "|" + index : ""));
		}
		gameState.controller.dropCard(player, zone, index);
	}
}

export class uiCardSlot {
	constructor(zone, index) {
		this.zone = zone;
		this.index = index;
		cardSlots.push(this);
	}
	
	makeDragSource() {}
	clearDragSource() {}
	update() {}
	remove() {
		cardSlots.splice(cardSlots.indexOf(this), 1);
	}
}

class fieldCardSlot extends uiCardSlot {
	constructor(zone, index, fieldIndex) {
		super(zone, index);
		this.fieldSlot = document.getElementById("field" + fieldIndex);
		
		this.fieldSlot.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, zone, index);
		});
		this.fieldSlot.addEventListener("click", function(e) {
			if (zone.cards[index]) {
				e.stopPropagation();
				previewCard(zone.cards[index]);
			}
		});
		this.fieldSlot.addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, zone, index);
		});
	}
	
	makeDragSource() {
		this.fieldSlot.classList.add("dragSource");
	}
	clearDragSource() {
		this.fieldSlot.classList.remove("dragSource");
	}
	update() {
		this.fieldSlot.parentElement.querySelector(".cardActionHolder").innerHTML = "";
		let card = this.zone.cards[this.index];
		if (card) {
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
		} else {
			this.fieldSlot.src = "images/cardHidden.png";
		}
	}
	remove() {
		this.update();
	}
}

class handCardSlot extends uiCardSlot {
	constructor(zone, index) {
		super(zone, index);
		
		this.handElem = document.getElementById("hand" + zone.player.index);
		this.cardElem = document.createElement("img");
		this.cardElem.src = zone.cards[index].getImage();
		this.cardElem.classList.add("card");
		this.cardElem.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, this.zone, this.index);
		}.bind(this));
		this.cardElem.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(zone.cards[this.index]);
		}.bind(this));
		if (this.handElem.childElementCount > index) {
			this.handElem.insertBefore(this.cardElem, this.handElem.childNodes[index]);
		} else {
			this.handElem.appendChild(this.cardElem);
		}
		this.handElem.style.setProperty("--card-count", "" + this.handElem.childElementCount);
	}
	
	makeDragSource() {
		this.cardElem.classList.add("dragSource");
	}
	clearDragSource() {
		this.cardElem.classList.remove("dragSource");
	}
	update() {
		this.cardElem.src = this.zone.cards[this.index].getImage();
	}
	remove() {
		super.remove();
		this.cardElem.remove();
		this.handElem.style.setProperty("--card-count", "" + this.handElem.childElementCount);
	}
}

class deckCardSlot extends uiCardSlot {
	constructor(zone) {
		super(zone, -1);
		
		document.getElementById("deck" + this.zone.player.index).addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		document.getElementById("deck" + this.zone.player.index).addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, this.zone, -1);
		}.bind(this));
	}
	
	update() {
		document.getElementById("deck" + this.zone.player.index).src = this.zone.cards[this.zone.cards.length - 1]?.getImage() ?? "images/cardHidden.png";
		document.getElementById("deck" + this.zone.player.index + "CardCount").textContent = this.zone.cards.length > 0? this.zone.cards.length : "";
	}
	remove() {
		this.update();
	}
}

class pileCardSlot extends uiCardSlot {
	constructor(zone) {
		super(zone, -1);
		
		document.getElementById(this.zone.name).addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, this.zone, this.zone.cards.length - 1);
		}.bind(this));
		document.getElementById(this.zone.name).addEventListener("click", function() {
			openCardSelect(this.zone);
		}.bind(this));
		document.getElementById(this.zone.name).addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, this.zone, this.zone.cards.length);
		}.bind(this));
	}
	
	update() {
		document.getElementById(this.zone.name).src = this.zone.cards[this.zone.cards.length - 1]?.getImage() ?? "images/cardHidden.png";
		document.getElementById(this.zone.name + "CardCount").textContent = this.zone.cards.length > 0? this.zone.cards.length : "";
	}
	remove() {
		this.update();
	}
}

class presentedCardSlot extends uiCardSlot {
	constructor(zone, index) {
		super(zone, index);
		
		this.isRevealed = false;
		this.zoneElem = document.getElementById("presentedCards" + zone.player.index);
		this.cardElem = document.createElement("div");
		
		this.cardImg = document.createElement("img")
		this.cardImg.src = zone.cards[index].getImage();
		this.cardImg.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(this.zone.cards[this.index]);
		}.bind(this));
		this.cardImg.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, this.zone, this.index);
		}.bind(this));
		this.cardElem.appendChild(this.cardImg);
		
		if (zone.player === localPlayer) {
			this.revealBtn = document.createElement("button");
			this.revealBtn.textContent = locale["presentReveal"];
			this.revealBtn.addEventListener("click", function() {
				this.isRevealed = !this.isRevealed;
				if (this.isRevealed) {
					socket.send("[revealCard]" + this.index);
					this.revealBtn.textContent = locale["presentHide"];
				} else {
					socket.send("[unrevealCard]" + this.index);
					this.revealBtn.textContent = locale["presentReveal"];
				}
			}.bind(this));
			this.cardElem.appendChild(this.revealBtn);
		}
		this.zoneElem.appendChild(this.cardElem);
	}
	
	makeDragSource() {
		this.cardElem.classList.add("dragSource");
	}
	clearDragSource() {
		this.cardElem.classList.remove("dragSource");
	}
	update() {
		console.log(this.zone);
		console.log(this.index);
		this.cardImg.src = this.zone.cards[this.index].getImage();
	}
	remove() {
		super.remove();
		this.cardElem.remove();
	}
}

class cardSelectorSlot extends uiCardSlot {
	constructor(zone, index) {
		super(zone, index);
		
		this.cardElem = document.createElement("img");
		this.cardElem.src = zone.cards[index].getImage();
		this.cardElem.classList.add("card");
		this.cardElem.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, zone, this.index);
			closeCardSelect();
		}.bind(this));
		this.cardElem.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(zone.cards[this.index]);
		}.bind(this));
		cardSelectorGrid.insertBefore(this.cardElem, cardSelectorGrid.firstChild);
	}
	
	makeDragSource() {
		this.cardElem.classList.add("dragSource");
	}
	clearDragSource() {
		this.cardElem.classList.remove("dragSource");
	}
	update() {
		this.cardElem.src = card.getImage();
	}
	remove() {
		super.remove();
		this.cardElem.remove();
		cardSelectorSlots.splice(cardSelectorSlots.indexOf(this), 1);
	}
}

export function openCardSelect(zone) {
	cardSelectorZone = zone;
	for (let i = 0; i < zone.cards.length; i++) {
		zone.cards[i].hidden = false;
		cardSelectorSlots.push(new cardSelectorSlot(zone, i));
	}
	
	//show selector
	cardSelectorTitle.textContent = zone.getLocalizedName();
	cardSelectorReturnToDeck.style.display = (zone.name == "discard1" || zone.name == "exile1")? "block" : "none";
	cardSelector.showModal();
	cardSelector.appendChild(cardDetails);
	
	cardSelectorGrid.parentNode.scrollTop = 0;
}

export function closeCardSelect() {
	if (cardSelectorZone.name.startsWith("deck")) {
		for (let card of cardSelectorZone.cards) {
			card.hidden = true;
		}
	}
	cardSelectorZone = null;
	while (cardSelectorSlots.length > 0) {
		cardSelectorSlots[0].remove();
	}
	gameFlexBox.appendChild(cardDetails);
	cardSelector.close();
}

// held cards
class UiPlayer {
	constructor(player) {
		this.player = player;
		this.life = player.life;
		this.targetLife = player.life;
		this.lifeCounter = 0;
		
		this.posX = 0;
		this.posY = 0;
		this.lastX = 0;
		this.lastY = 0;
		this.targetX = 0;
		this.targetY = 0;
		
		this.dragging = false;
		this.dragCardElem = document.createElement("img");
		this.dragCardElem.classList.add("dragCard");
		draggedCardImages.appendChild(this.dragCardElem);
		if (player == localPlayer) {
			this.dragCardElem.id = "yourDragCard";
		} else {
			this.dragCardElem.setAttribute("hidden", "");
			
			this.cursorElem = document.createElement("img");
			this.cursorElem.classList.add("dragCard");
			this.cursorElem.src = "images/opponentCursor.png";
			this.cursorElem.setAttribute("hidden", "");
			draggedCardImages.appendChild(this.cursorElem);
		}
	}
	
	setDrag(card) {
		if (card) {
			this.dragCardElem.src = card.getImage();
			this.dragging = true;
			if (this.player === localPlayer) {
				document.documentElement.classList.add("isDragging");
			}
		}
	}
	clearDrag() {
		this.dragCardElem.src = "images/cardHidden.png";
		this.dragging = false;
		if (this.player === localPlayer) {
			document.documentElement.classList.remove("isDragging");
		}
	}
	
	setLife(value) {
		if (value != this.life) {
			this.targetLife = value;
			document.getElementById("lifeDisplay" + this.player.index).classList.add(value < this.life? "lifeDown" : "lifeUp");
		}
	}
	setMana(value) {
		document.getElementById("manaDisplay" + this.player.index).textContent = value;
	}
}

function animate(currentTime) {
	let delta = currentTime - lastFrame;
	lastFrame = currentTime;
	
	let fieldRect = document.getElementById("field").getBoundingClientRect();
	for (let uiPlayer of uiPlayers) {
		// cursors
		uiPlayer.posX += (uiPlayer.targetX - uiPlayer.posX) / 5;
		uiPlayer.posY += (uiPlayer.targetY - uiPlayer.posY) / 5;
		
		uiPlayer.dragCardElem.style.left = (uiPlayer.posX * fieldRect.height + fieldRect.width / 2) + "px";
		uiPlayer.dragCardElem.style.top = uiPlayer.posY * fieldRect.height + "px";
		if (uiPlayer.player !== localPlayer) {
			uiPlayer.cursorElem.style.left = uiPlayer.dragCardElem.style.left;
			uiPlayer.cursorElem.style.top = uiPlayer.dragCardElem.style.top;
		}
		
		let velX = uiPlayer.posX - uiPlayer.lastX;
		let velY = uiPlayer.lastY - uiPlayer.posY;
		
		let flipped = uiPlayer.player.index % 2 == 0;
		uiPlayer.dragCardElem.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (velX > 0? Math.min(Math.PI / 3, velX * 100) : Math.max(Math.PI / -3, velX * 100)) + "rad) rotateX(" + (velY > 0? Math.min(Math.PI / 3, velY * 100) : Math.max(Math.PI / -3, velY * 100)) + "rad)" + (flipped? " rotateZ(180deg)" : "");
		
		uiPlayer.lastX = uiPlayer.posX;
		uiPlayer.lastY = uiPlayer.posY;
		
		// life displays
		if (uiPlayer.life != uiPlayer.targetLife) {
			uiPlayer.lifeCounter += delta;
			while (uiPlayer.lifeCounter > 5) {
				uiPlayer.lifeCounter -= 5;
				uiPlayer.life += Math.sign(uiPlayer.targetLife - uiPlayer.life);
			}
			document.getElementById("lifeDisplay" + uiPlayer.player.index).textContent = uiPlayer.life;
			
			if (uiPlayer.life == uiPlayer.targetLife) {
				document.getElementById("lifeDisplay" + uiPlayer.player.index).classList.remove("lifeDown");
				document.getElementById("lifeDisplay" + uiPlayer.player.index).classList.remove("lifeUp");
			}
		}
	}
	
	requestAnimationFrame(animate);
}