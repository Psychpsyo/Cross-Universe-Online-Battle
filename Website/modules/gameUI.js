import {cardActions} from "/modules/cardActions.js";
import {socket, zoneToLocal} from "/modules/netcode.js";
import {previewCard} from "/modules/generalUI.js";
import {locale} from "/modules/locale.js";
import {FieldZone} from "/rulesEngine/zones.js";

let cardSlots = [];
export let uiPlayers = [];
let lastFrame = 0;

let cardSelectorSlots = [];
export let cardSelectorZone = null;

youInfoText.textContent = locale.game.info.you;
opponentInfoText.textContent = locale.game.info.opponent;
lifeInfoText.textContent = locale.game.info.life;
manaInfoText.textContent = locale.game.info.mana;

if (localStorage.getItem("fieldLabelToggle") == "true") {
	document.querySelectorAll(".fieldLabelUnitZone").forEach(label => {
		label.textContent = locale.game.fieldLabels.unitZone;
	});
	document.querySelectorAll(".fieldLabelSpellItemZone").forEach(label => {
		label.textContent = locale.game.fieldLabels.spellItemZone;
	});
	document.querySelectorAll(".fieldLabelPartnerZone").forEach(label => {
		label.textContent = locale.game.fieldLabels.partnerZone;
	});
	document.querySelectorAll(".fieldLabelDeck").forEach(label => {
		label.textContent = locale.game.fieldLabels.deck;
		if (locale.game.fieldLabels.verticalText) {
			label.classList.add("verticalFieldLabel");
		}
	});
	document.querySelectorAll(".fieldLabelDiscardPile").forEach(label => {
		label.textContent = locale.game.fieldLabels.discardPile;
		if (locale.game.fieldLabels.verticalText) {
			label.classList.add("verticalFieldLabel");
		}
	});
	document.querySelectorAll(".fieldLabelExileZone").forEach(label => {
		label.textContent = locale.game.fieldLabels.exileZone;
		if (locale.game.fieldLabels.verticalText) {
			label.classList.add("verticalFieldLabel");
		}
	});
}

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
		
		// presented cards (only used during manual play)
		document.getElementById("presentedCards" + player.index).addEventListener("mouseup", function(e) {
			e.stopPropagation();
			let presentedZone = gameState.controller.playerInfos[player.index].presentedZone;
			dropCard(localPlayer, presentedZone, presentedZone.cards.length);
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
	
	document.addEventListener("keydown", function(e) {
		if (e.code.startsWith("Digit") && !e.shiftKey && !e.altKey && !e.ctrlKey) {
			let cardIndex = e.code.substr(5);
			if (cardIndex == 0) {
				cardIndex = 10;
			}
			cardIndex -= 1;
			if (cardIndex < localPlayer.handZone.cards.length) {
				previewCard(localPlayer.handZone.get(cardIndex));
			}
			return;
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
	
	cardChoiceMenu.addEventListener("cancel", function(e) {
		e.preventDefault();
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
			} else if (cardSlots[i].index > index && !(zone instanceof FieldZone)) {
				cardSlots[i].index--;
			} else if (cardSlots[i].index == -1) {
				cardSlots[i].update();
			}
		}
	}
}
export function insertCard(zone, index) {
	if (zone instanceof FieldZone) {
		updateCard(zone, index);
		return;
	}
	cardSlots.forEach(slot => {
		if (slot.zone === zone) {
			if (slot.index >= index) {
				slot.index++;
			} else if (slot.index == -1) {
				slot.insert();
			}
		}
	});
	
	switch (zone.type) {
		case "hand": {
			new handCardSlot(zone, index);
			break;
		}
		case "presented": {
			new presentedCardSlot(zone, index);
			break;
		}
	}
}
export function makeDragSource(zone, index, player) {
	cardSlots.forEach(slot => {
		if (slot.zone == zone && slot.index == index) {
			slot.makeDragSource(player);
		}
	});
}
export function clearDragSource(zone, index, player) {
	cardSlots.forEach(slot => {
		if (slot.zone === zone && slot.index == index) {
			slot.clearDragSource(player);
		}
	});
}

function grabCard(player, zone, index) {
	if (gameState.controller.grabCard(player, zone, index) && player === localPlayer) {
		socket.send("[uiGrabbedCard]" + gameState.getZoneName(zone) + "|" + index);
	}
}
function dropCard(player, zone, index) {
	if (uiPlayers[player.index].dragging) {
		if (player === localPlayer) {
			socket.send("[uiDroppedCard]" + (zone? gameState.getZoneName(zone) + "|" + index : ""));
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
	
	makeDragSource(player) {}
	clearDragSource(player) {}
	update() {}
	remove() {
		cardSlots.splice(cardSlots.indexOf(this), 1);
	}
	insert() {}
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
			if (zone.get(index)) {
				e.stopPropagation();
				previewCard(zone.get(index));
			}
		});
		this.fieldSlot.addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, zone, index);
		});
	}
	
	makeDragSource(player) {
		this.fieldSlot.classList.add("dragSource");
	}
	clearDragSource(player) {
		this.fieldSlot.classList.remove("dragSource");
	}
	update() {
		let card = this.zone.get(this.index);
		if (card) {
			this.fieldSlot.src = card.getImage();
			// add card action buttons
			if (!gameState.automatic) {
				this.fieldSlot.parentElement.querySelector(".cardActionHolder").innerHTML = "";
				if (card.cardId in cardActions) {
					for (const [key, value] of Object.entries(cardActions[card.cardId])) {
						let button = document.createElement("button");
						button.textContent = locale.cardActions[card.cardId][key];
						button.addEventListener("click", value);
						this.fieldSlot.parentElement.querySelector(".cardActionHolder").appendChild(button);
					}
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
		
		this.handElem = document.getElementById("hand" + this.zone.player.index);
		this.cardElem = document.createElement("img");
		this.cardElem.src = zone.get(index).getImage();
		this.cardElem.classList.add("card");
		this.cardElem.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, this.zone, this.index);
		}.bind(this));
		this.cardElem.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(zone.get(this.index));
		}.bind(this));
		if (this.handElem.childElementCount > index) {
			this.handElem.insertBefore(this.cardElem, this.handElem.childNodes[index]);
		} else {
			this.handElem.appendChild(this.cardElem);
		}
		this.handElem.style.setProperty("--card-count", "" + this.handElem.childElementCount);
	}
	
	makeDragSource(player) {
		this.cardElem.classList.add("dragSource");
	}
	clearDragSource(player) {
		this.cardElem.classList.remove("dragSource");
	}
	update() {
		this.cardElem.src = this.zone.get(this.index).getImage();
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
		this.cardCount = zone.cards.length;
		
		document.getElementById("deck" + this.zone.player.index).addEventListener("dragstart", function(e) {
			e.preventDefault();
		});
		document.getElementById("deck" + this.zone.player.index).addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, this.zone, -1);
		}.bind(this));
	}
	
	update() {
		this.cardCount = this.zone.cards.length;
		this.setVisuals();
	}
	remove() {
		this.cardCount -= 1;
		this.setVisuals();
	}
	insert() {
		this.cardCount += 1;
		this.setVisuals();
	}
	setVisuals() {
		document.getElementById("deck" + this.zone.player.index).src = this.zone.get(this.zone.cards.length - 1)?.getImage() ?? "images/cardHidden.png";
		document.getElementById("deck" + this.zone.player.index + "CardCount").textContent = this.cardCount > 0? this.cardCount : "";
	}
}

class pileCardSlot extends uiCardSlot {
	constructor(zone) {
		super(zone, -1);
		this.cardCount = zone.cards.length;
		
		document.getElementById(this.zone.type + this.zone.player.index).addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, this.zone, this.zone.cards.length - 1);
		}.bind(this));
		document.getElementById(this.zone.type + this.zone.player.index).addEventListener("click", function() {
			openCardSelect(this.zone);
		}.bind(this));
		document.getElementById(this.zone.type + this.zone.player.index).addEventListener("mouseup", function(e) {
			e.stopPropagation();
			dropCard(localPlayer, this.zone, this.zone.cards.length);
		}.bind(this));
	}
	
	update() {
		this.cardCount = this.zone.cards.length;
		this.setVisuals();
	}
	remove() {
		this.cardCount -= 1;
		this.setVisuals();
	}
	insert() {
		this.cardCount += 1;
		this.setVisuals();
	}
	setVisuals() {
		document.getElementById(this.zone.type + this.zone.player.index).src = this.zone.get(this.zone.cards.length - 1)?.getImage() ?? "images/cardHidden.png";
		document.getElementById(this.zone.type + this.zone.player.index + "CardCount").textContent = this.cardCount > 0? this.cardCount : "";
	}
}

// technically only needed for manual games but manualUI.js can't easily create these on its own so it's here for now.
class presentedCardSlot extends uiCardSlot {
	constructor(zone, index) {
		super(zone, index);
		
		this.isRevealed = false;
		this.zoneElem = document.getElementById("presentedCards" + this.zone.player.index);
		this.cardElem = document.createElement("div");
		
		this.cardImg = document.createElement("img")
		this.cardImg.src = this.zone.get(index).getImage();
		this.cardImg.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(this.zone.get(this.index));
		}.bind(this));
		this.cardImg.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, this.zone, this.index);
		}.bind(this));
		this.cardElem.appendChild(this.cardImg);
		
		if (this.zone.player === localPlayer) {
			this.revealBtn = document.createElement("button");
			this.revealBtn.textContent = locale.game.manual.presented.reveal;
			this.revealBtn.addEventListener("click", function() {
				this.isRevealed = !this.isRevealed;
				if (this.isRevealed) {
					socket.send("[revealCard]" + this.index);
					this.revealBtn.textContent = locale.game.manual.presented.hide;
				} else {
					socket.send("[unrevealCard]" + this.index);
					this.revealBtn.textContent = locale.game.manual.presented.reveal;
				}
			}.bind(this));
			this.cardElem.appendChild(this.revealBtn);
		}
		this.zoneElem.appendChild(this.cardElem);
	}
	
	makeDragSource(player) {
		this.cardElem.classList.add("dragSource");
		if (player === localPlayer) {
			this.zoneElem.classList.add("presentedCardsDragSource");
		}
	}
	clearDragSource(player) {
		this.cardElem.classList.remove("dragSource");
		if (player === localPlayer) {
			this.zoneElem.classList.remove("presentedCardsDragSource");
		}
	}
	update() {
		this.cardImg.src = this.zone.get(this.index).getImage();
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
		this.cardElem.src = zone.get(index).getImage();
		this.cardElem.classList.add("card");
		this.cardElem.addEventListener("dragstart", function(e) {
			e.preventDefault();
			grabCard(localPlayer, zone, this.index);
			closeCardSelect();
		}.bind(this));
		this.cardElem.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(zone.get(this.index));
		}.bind(this));
		cardSelectorGrid.insertBefore(this.cardElem, cardSelectorGrid.firstChild);
	}
	
	makeDragSource(player) {
		this.cardElem.classList.add("dragSource");
	}
	clearDragSource(player) {
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
	if (cardSelector.open) {
		closeCardSelect();
	}
	cardSelectorZone = zone;
	for (let i = 0; i < zone.cards.length; i++) {
		zone.get(i).hidden = false;
		cardSelectorSlots.push(new cardSelectorSlot(zone, i));
	}
	
	//show selector
	cardSelectorTitle.textContent = locale.game.cardSelector[gameState.getZoneName(zone)];
	if (document.getElementById("cardSelectorReturnToDeck")) {
		if ((zone.player === localPlayer) && (zone.type == "discard" || zone.type == "exile")) {
			cardSelectorReturnToDeck.removeAttribute("hidden");
		} else {
			cardSelectorReturnToDeck.setAttribute("hidden", "");
		}
	}
	cardSelector.showModal();
	cardSelector.appendChild(cardDetails);
	
	cardSelectorGrid.parentNode.scrollTop = 0;
}
export function closeCardSelect() {
	if (cardSelectorZone.type =="deck") {
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
export function toggleCardSelect(zone) {
	if (cardSelectorZone === zone) {
		closeCardSelect();
	} else {
		openCardSelect(zone);
	}
}

// held cards
class UiPlayer {
	constructor(player) {
		this.player = player;
		
		this.life = new UiValue(player.life, 5, document.getElementById("lifeDisplay" + player.index));
		this.mana = new UiValue(player.mana, 100, document.getElementById("manaDisplay" + player.index));
		
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
		}
	}
	clearDrag() {
		this.dragCardElem.src = "images/cardHidden.png";
		this.dragging = false;
	}
}

class UiValue {
	constructor(initial, speed, displayElem) {
		this.value = initial;
		this.targetValue = initial;
		this.counter = 0;
		this.speed = speed;
		this.displayElem = displayElem;
	}
	
	async set(value, instant) {
		if (value != this.value) {
			this.targetValue = value;
			if (instant) {
				this.value = value;
				this.displayElem.textContent = this.value;
			} else {
				this.displayElem.classList.add(value < this.value? "valueDown" : "valueUp");
				return new Promise(resolve => setTimeout(resolve, Math.abs(this.targetValue - this.value) * this.speed));
			}
		}
	}
	
	animate(delta) {
		if (this.value != this.targetValue) {
			this.counter += delta;
			while (this.counter > this.speed) {
				this.counter -= this.speed;
				this.value += Math.sign(this.targetValue - this.value);
			}
			this.displayElem.textContent = this.value;
			
			if (this.value == this.targetValue) {
				this.displayElem.classList.remove("valueDown");
				this.displayElem.classList.remove("valueUp");
			}
		}
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
		
		uiPlayer.life.animate(delta);
		uiPlayer.mana.animate(delta);
	}
	
	requestAnimationFrame(animate);
}

// card choice modal (blocking card selector)
// TODO: Add multi-card selecting
export async function presentCardChoice(cards, title, matchFunction = () => true, validAmounts = [1]) {
	return new Promise((resolve, reject) => {
		let validOptions = 0;
		for (let i = 0; i < cards.length; i++) {
			let cardImg = document.createElement("img");
			cardImg.src = cards[i].getImage();
			if (matchFunction(cards[i])) {
				validOptions++;
				cardImg.dataset.selectionIndex = i;
				cardImg.addEventListener("click", function(e) {
					if (e.shiftKey || e.ctrlKey || e.altKey) {
						e.stopPropagation();
						previewCard(cards[i]);
					} else {
						gameFlexBox.appendChild(cardDetails);
						cardChoiceMenu.close(this.dataset.selectionIndex);
						cardChoiceGrid.innerHTML = "";
					}
				});
			} else {
				cardImg.classList.add("unselectableCard");
			}
			cardChoiceGrid.appendChild(cardImg);
		}
		if (validOptions == 0) {
			reject(new Error("No valid choices were passed to the card choice dialogue"));
		}
		cardChoiceMenu.addEventListener("close", function() {
			resolve([parseInt(this.returnValue)]);
		});
		
		cardChoiceTitle.textContent = title;
		cardChoiceMenu.showModal();
		cardChoiceMenu.appendChild(cardDetails);
		
		cardChoiceGrid.parentNode.scrollTop = 0;
	});
}

export async function askQuestion(question, yesButton, noButton) {
	questionPopupText.textContent = question;
	questionPopupYesButton.textContent = yesButton;
	questionPopupNoButton.textContent = noButton;
	questionPopup.showModal();
	
	return new Promise((resolve, reject) => {
		questionPopupYesButton.addEventListener("click", function() {
			questionPopup.close();
			resolve(true);
		}, {once: true});
		questionPopupNoButton.addEventListener("click", function() {
			questionPopup.close();
			resolve(false);
		}, {once: true});
	});
}