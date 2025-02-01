import {cardActions} from "./cardActions.mjs";
import {netSend, parseNetZone} from "./netcode.mjs";
import {previewCard, closeCardPreview} from "./generalUI.mjs";
import localize from "../../scripts/locale.mjs";
import {locale} from "../../scripts/locale.mjs";
import {getCardImage} from "../../scripts/cardLoader.mjs";
import {Card} from "../../rulesEngine/src/card.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as fieldOverlay from "./fieldOverlay.mjs";

let cardSlots = [];
export let uiPlayers = [];
export let currentPointer = null;
let cursorHidden = true; // whether or not the cursor is hidden for the opponent
let lastFrame = 0;

let cardSelectorSlots = [];
export let cardSelectorMainSlot = null;
let cardSelectorSorted = false;
let cardChoiceSelected = [];


// localization
for (const elem of Array.from(document.querySelectorAll(".lifeTitle"))) {
	elem.textContent = localize("game.playerInfo.life");
}
for (const elem of Array.from(document.querySelectorAll(".manaTitle"))) {
	elem.textContent = localize("game.playerInfo.mana");
}

cardChoiceConfirm.textContent = localize("game.cardChoice.confirm");
leaveGameBtn.textContent = localize("game.gameOver.leaveGame");
showFieldBtn.textContent = localize("game.gameOver.showField");

if (localStorage.getItem("fieldLabelToggle") == "true") {
	document.querySelectorAll(".fieldLabelUnitZone").forEach(label => {
		label.textContent = localize("game.fieldLabels.unitZone");
	});
	document.querySelectorAll(".fieldLabelSpellItemZone").forEach(label => {
		label.textContent = localize("game.fieldLabels.spellItemZone");
	});
	document.querySelectorAll(".fieldLabelPartnerZone").forEach(label => {
		label.textContent = localize("game.fieldLabels.partnerZone");
	});
	document.querySelectorAll(".fieldLabelDeck").forEach(label => {
		label.textContent = localize("game.fieldLabels.deck");
		if (locale.game.fieldLabels.verticalText) {
			label.classList.add("verticalFieldLabel");
		}
	});
	document.querySelectorAll(".fieldLabelDiscardPile").forEach(label => {
		label.textContent = localize("game.fieldLabels.discardPile");
		if (locale.game.fieldLabels.verticalText) {
			label.classList.add("verticalFieldLabel");
		}
	});
	document.querySelectorAll(".fieldLabelExileZone").forEach(label => {
		label.textContent = localize("game.fieldLabels.exileZone");
		if (locale.game.fieldLabels.verticalText) {
			label.classList.add("verticalFieldLabel");
		}
	});
}

if (localStorage.getItem("alwaysShowCardButtons") == "true") {
	document.documentElement.classList.add("alwaysShowCardButtons");
}

// These are assigned/calculated as follows:
//  +----+----+----+----+----+
//  |  0 |  1 |  2 |  3 |  4 | <- Opponent Spell/Item/Partner Zones
//  +----+----+----+----+----+
//  |  5 |  6 |  7 |  8 |  9 | <- Opponent Unit Zone
//  +----+----+----+----+----+
//  | 10 | 11 | 12 | 13 | 14 | <- Your Unit Zone
//  +----+----+----+----+----+
//  | 15 | 16 | 17 | 18 | 19 | <- Your Spell/Item/Partner Zones
//  +----+----+----+----+----+
export function fieldSlotIndexFromZone(zone, index) {
	switch(zone) {
		case game.players[0].partnerZone: {
			return 2;
		}
		case game.players[1].partnerZone: {
			return 17;
		}
		case game.players[0].unitZone: {
			return 9 - index;
		}
		case game.players[1].unitZone: {
			return 10 + index;
		}
		case game.players[0].spellItemZone: {
			return [4, 3, 1, 0][index];
		}
		case game.players[1].spellItemZone: {
			return [15, 16, 18, 19][index];
		}
	}
	return -1;
}

// performant field rect tracking (where the field is on the page)
let fieldRect;
function recalculateFieldRect() {
	fieldRect = document.getElementById("field").getBoundingClientRect();
}
window.addEventListener("resize", recalculateFieldRect);

// hides your cursor from the opponent
function hideCursor() {
	if (cursorHidden) {
		return;
	}
	cursorHidden = true;
	netSend("hideCursor");
}

export function init() {
	for (const player of game.players) {
		uiPlayers.push(new UiPlayer(player));

		new DeckCardSlot(player.deckZone);
		new PileCardSlot(player.discardPile);
		new PileCardSlot(player.exileZone);
		new FieldCardSlot(player.partnerZone, 0);
		for (let i = 0; i < 5; i++) {
			new FieldCardSlot(player.unitZone, i);
		}
		for (let i = 0; i < 4; i++) {
			new FieldCardSlot(player.spellItemZone, i);
		}
	}

	// card selector
	cardSelectorMainSlot = new CardSelectorMainSlot()
	cardSelector.addEventListener("click", function(e) {
		if (e.target === cardSelector) {
			closeCardSelect();
		}
	});
	cardSelector.addEventListener("cancel", function(e) {
		e.preventDefault();
		closeCardSelect();
	});

	if (localPlayer) {
		document.body.classList.add("interactable");
		initInteraction();
	} else {
		document.body.classList.add("uninteractable");
	}

	recalculateFieldRect();
	lastFrame = performance.now();
	animate();
}
function initInteraction() {
	for (const player of game.players) {
		document.getElementById("hand" + player.index).addEventListener("pointerup", function(e) {
			if (e.pointerId != currentPointer) {
				return;
			}
			e.stopPropagation();
			dropCard(localPlayer, player.handZone, player.handZone.cards.length);
		});
	}

	// dropping cards off in nowhere
	document.addEventListener("pointerup", function(e) {
		if (e.pointerId != currentPointer) {
			return;
		}
		dropCard(localPlayer, null, 0);
	});

	// setup cursor movement
	document.addEventListener("pointermove", function(e) {
		if (e.pointerId != currentPointer) {
			if (uiPlayers[1].dragging) {
				return;
			}
			currentPointer = e.pointerId;
			hideCursor();
		}
		uiPlayers[1].targetX = (e.clientX - fieldRect.left - fieldRect.width / 2) / fieldRect.height;
		uiPlayers[1].targetY = (e.clientY - fieldRect.top) / fieldRect.height;
		uiPlayers[1].posX = uiPlayers[1].targetX;
		uiPlayers[1].posY = uiPlayers[1].targetY;

		// zoom hotkey related stuff
		const zoom = 5;
		const pointerX = e.clientX - mainGameArea.offsetLeft;
		const pointerY = e.clientY - mainGameArea.offsetTop;
		const finalX = mainGameArea.offsetWidth / 2;
		const finalY = mainGameArea.offsetHeight / 2;

		const offsetX = (finalX - pointerX * zoom) / (-zoom + 1);
		const offsetY = (finalY - pointerY * zoom) / (-zoom + 1);

		mainGameArea.style.setProperty("transform-origin", `${
			Math.min(Math.max(offsetX, 0), mainGameArea.offsetWidth)
		}px ${
			Math.min(Math.max(offsetY, 0), mainGameArea.offsetHeight)
		}px`);
	});
	document.getElementById("field").addEventListener("pointerleave", function() {
		hideCursor();
	});
	document.getElementById("field").addEventListener("pointermove", function(e) {
		if (e.pointerId != currentPointer) {
			if (uiPlayers[1].dragging) {
				return;
			}
			currentPointer = e.pointerId;
		}
		// check if the normalized cursor position is within the bounds of the visual field
		if (Math.abs(uiPlayers[1].posX) < 3500 / 2741 / 2) { // 3500 and 2741 being the width and height of the field graphic
			netSend("placeCursor", uiPlayers[1].posX + "|" + uiPlayers[1].posY, false);
			cursorHidden = false;
		} else {
			hideCursor();
		}
	});

	// previewing hand cards
	document.addEventListener("keydown", function(e) {
		if (e.code.startsWith("Digit") && !e.shiftKey && !e.altKey && !e.ctrlKey) {
			let cardIndex = e.code.substring(5);
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

	// card choice menu
	cardChoiceMenu.addEventListener("cancel", function(e) {
		e.preventDefault();
	});
	cardChoiceConfirm.addEventListener("click", function() {
		gameFlexBox.appendChild(cardDetails);
		cardChoiceMenu.close(cardChoiceSelected.join("|"));
		cardChoiceArea.innerHTML = "";
		cardChoiceSelected = [];
		// The timeout is necessary because reparenting and transitioning an element at the same time skips the transition.
		window.setTimeout(closeCardPreview, 0);
	});
}

export function receiveMessage(command, message, player) {
	switch (command) {
		case "uiGrabbedCard": { // opponent picked up a card
			let zone = parseNetZone(message.substring(0, message.indexOf("|")), player);
			let index = message.substring(message.indexOf("|") + 1);

			grabCard(player, zone, index);
			return true;
		}
		case "uiDroppedCard": { // opponent dropped a card
			let zone = null;
			let index = 0;
			if (message != "") {
				zone = parseNetZone(message.substring(0, message.indexOf("|")), player);
				index = message.substring(message.indexOf("|") + 1);
			}
			dropCard(player, zone, index);
			return true;
		}
		case "hideCursor": { // hide opponent's cursor
			uiPlayers[player.index].dragCardElem.hidden = true;
			uiPlayers[player.index].cursorElem.hidden = true;
			return true;
		}
		case "placeCursor": { // move the opponent's cursor somewhere on the field
			const uiPlayer = uiPlayers[player.index];
			// only the player on the top half of the screen needs to get their cursor flipped
			if (player.index === 0) {
				uiPlayer.targetX = message.substring(0, message.indexOf("|")) * -1;
				uiPlayer.targetY = 1 - message.substring(message.indexOf("|") + 1);
			} else {
				uiPlayer.targetX = parseFloat(message.substring(0, message.indexOf("|")));
				uiPlayer.targetY = parseFloat(message.substring(message.indexOf("|") + 1));
			}
			if (uiPlayer.dragCardElem.hidden) {
				uiPlayer.dragCardElem.hidden = false;
				uiPlayer.cursorElem.hidden = false;
				uiPlayer.posX = uiPlayer.targetX;
				uiPlayer.posY = uiPlayer.targetY;
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
			cardSlots[i].remove(index);
		}
	}
}
export function insertCard(zone, index) {
	cardSlots.forEach(slot => {
		if (slot.zone === zone) {
			slot.insert(index);
		}
	});

	switch (zone.type) {
		case "hand": {
			new HandCardSlot(zone, index);
			break;
		}
		case "presented": {
			new PresentedCardSlot(zone, index);
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

export function grabCard(player, zone, index) {
	if (gameState.controller.grabCard(player, zone, index) && player === localPlayer) {
		netSend("uiGrabbedCard", gameState.getZoneName(zone) + "|" + index);
		document.documentElement.classList.add("localPlayerActiveGrab");
		return true;
	}
	return false;
}
export function dropCard(player, zone, index) {
	if (uiPlayers[player.index].dragging) {
		if (player === localPlayer) {
			netSend("uiDroppedCard", (zone? gameState.getZoneName(zone) + "|" + index : ""));
			document.documentElement.classList.remove("localPlayerActiveGrab");
		}
		gameState.controller.dropCard(player, zone, index);
	}
}

export function addCardButton(zone, index, label, type, onClick, visible = false) {
	for (let slot of cardSlots) {
		if (slot.zone === zone && (slot.index == index || slot.index == -1 || slot instanceof PileCardSlot)) {
			let button = slot.addCardButton(label, type, onClick, visible);
			if (button) {
				return button;
			}
		}
	}
	throw new Error("Can't add card buttons to zone of this type.");
}
export function clearCardButtons(zone, index, type) {
	for (let slot of cardSlots) {
		if (slot.zone === zone && (slot.index == index || slot.index == -1 || slot instanceof PileCardSlot)) {
			slot.clearCardButtons(type);
		}
	}
}

function setCardDragEvent(element, uiCardSlot) {
	element.draggable = false;
	if (!localPlayer) return;
	element.addEventListener("pointerdown", function(e) {
		if (e.button != 1) {
			element.setPointerCapture(e.pointerId);
		}
	});
	element.addEventListener("pointermove", function(e) {
		if (e.buttons == 0 || !element.hasPointerCapture(e.pointerId)) {
			return;
		}
		e.target.releasePointerCapture(e.pointerId);
		e.preventDefault();
		if (grabCard(localPlayer, uiCardSlot.zone, uiCardSlot.index) || uiCardSlot.zone == gameState.controller.tokenZone) {
			if (uiCardSlot instanceof CardSelectorSlot) {
				closeCardSelect();
			}
			currentPointer = e.pointerId;
		}
	});
}

export class UiCardSlot {
	constructor(zone, index) {
		this.zone = zone;
		this.index = index;
		cardSlots.push(this);
	}

	makeDragSource(player) {}
	clearDragSource(player) {}
	update() {}
	remove(index) {
		if (index == this.index) {
			cardSlots.splice(cardSlots.indexOf(this), 1);
		}
	}
	insert(index) {}

	getButtonHolder() {}

	addCardButton(label, type, onClick, visible = false) {
		let buttonHolder = this.getButtonHolder();
		if (!buttonHolder) {
			return;
		}
		let button = document.createElement("button");
		button.classList.add(type);
		button.textContent = label;
		button.addEventListener("click", onClick);
		buttonHolder.appendChild(button);
		if (visible) {
			buttonHolder.classList.add("visible");
		}
		return button;
	}
	clearCardButtons(type) {
		let buttonHolder = this.getButtonHolder();
		if (!buttonHolder) {
			return;
		}
		for (let button of Array.from(buttonHolder.querySelectorAll("." + type))) {
			button.remove();
		}
		if (buttonHolder.childElementCount == 0) {
			buttonHolder.classList.remove("visible");
		}
	}
}

class FieldCardSlot extends UiCardSlot {
	constructor(zone, index) {
		super(zone, index);
		this.fieldSlot = document.getElementById("field" + fieldSlotIndexFromZone(zone, index));
		this.equipLines = [];

		setCardDragEvent(this.fieldSlot, this);
		this.fieldSlot.addEventListener("click", function(e) {
			if (zone.get(index)) {
				e.stopPropagation();
				previewCard(zone.get(index));
			}
		});
		this.fieldSlot.addEventListener("pointerup", function(e) {
			if (e.pointerId != currentPointer) {
				return;
			}
			e.stopPropagation();
			dropCard(localPlayer, zone, index);
		});

		// equipment lines
		this.fieldSlot.addEventListener("pointerenter", function() {
			let card = this.zone.get(this.index);
			if (card) {
				if (card.equippedTo) {
					this.equipLines.push(fieldOverlay.equipLine(card, card.equippedTo));
				}
				for (const equipment of card.equipments) {
					this.equipLines.push(fieldOverlay.equipLine(equipment, card));
				}
			}
		}.bind(this));
		this.fieldSlot.addEventListener("pointerleave", function() {
			while (this.equipLines.length > 0) {
				this.equipLines.pop()?.remove();
			}
		}.bind(this));
	}

	makeDragSource(player) {
		this.fieldSlot.classList.add("dragSource");
	}
	clearDragSource(player) {
		this.fieldSlot.classList.remove("dragSource");
	}
	update() {
		let card = this.zone.get(this.index);
		this.clearCardButtons("cardSpecific");
		if (card) {
			this.fieldSlot.src = getCardImage(card, "tiny");
			// add card action buttons
			if (!gameState.automatic && !card.hiddenFor.includes(localPlayer) && this.zone.player === localPlayer) {
				if (card.cardId in cardActions) {
					for (const [key, value] of Object.entries(cardActions[card.cardId])) {
						this.addCardButton(localize(`cardActions.${card.cardId}.${key}`), "cardSpecific", value);
					}
				}
			}
		} else {
			this.fieldSlot.src = "images/cardHidden.png";
			this.clearDragSource(null);
			clearCounters(fieldSlotIndexFromZone(this.zone, this.index));
		}
	}
	insert(index) {
		this.update();
	}
	remove(index) {
		this.update();
	}

	getButtonHolder() {
		return this.fieldSlot.parentElement.querySelector(".cardActionHolder");
	}
}

class HandCardSlot extends UiCardSlot {
	constructor(zone, index) {
		super(zone, index);

		this.handElem = document.getElementById("hand" + this.zone.player.index);
		this.cardElem = document.createElement("img");
		this.cardElem.src = getCardImage(zone.get(index), "tiny");
		this.cardElem.classList.add("card");

		setCardDragEvent(this.cardElem, this);
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
		this.cardElem.src = getCardImage(this.zone.get(this.index), "tiny");
	}
	insert(index) {
		if (index <= this.index) {
			this.index++;
			this.update();
		}
	}
	remove(index) {
		if (index == this.index) {
			super.remove(index);
			this.cardElem.remove();
			this.handElem.style.setProperty("--card-count", "" + this.handElem.childElementCount);
		} else if (index < this.index) {
			this.index--;
			this.update();
		}
	}
}

class DeckCardSlot extends UiCardSlot {
	constructor(zone) {
		super(zone, -1);
		this.cardCount = zone.cards.length;

		document.getElementById("deck" + this.zone.player.index).addEventListener("pointerup", function(e) {
			if (e.pointerId != currentPointer) {
				return;
			}
			e.stopPropagation();
			dropCard(localPlayer, this.zone, -1);
		}.bind(this));
	}

	update() {
		this.cardCount = this.zone.cards.length;
		this.setVisuals();
	}
	remove(index) {
		this.cardCount -= 1;
		this.setVisuals();
	}
	insert(index) {
		this.cardCount += 1;
		this.setVisuals();
	}
	setVisuals() {
		document.getElementById("deck" + this.zone.player.index).src = getCardImage(this.zone.get(this.zone.cards.length - 1), "tiny");
		document.getElementById("deck" + this.zone.player.index + "CardCount").textContent = this.cardCount > 0? this.cardCount : "";
	}
}

class PileCardSlot extends UiCardSlot {
	constructor(zone) {
		super(zone, -1);
		this.cardCount = zone.cards.length;

		setCardDragEvent(document.getElementById(this.zone.type + this.zone.player.index), this);
		document.getElementById(this.zone.type + this.zone.player.index).addEventListener("click", function() {
			openCardSelect(zone);
		});
		document.getElementById(this.zone.type + this.zone.player.index).addEventListener("pointerup", function(e) {
			if (e.pointerId != currentPointer) {
				return;
			}
			e.stopPropagation();
			dropCard(localPlayer, zone, zone.cards.length);
		});
	}

	update() {
		this.index = this.zone.cards.length - 1;
		this.cardCount = this.zone.cards.length;
		this.setVisuals();
	}
	remove(index) {
		this.cardCount -= 1;
		this.update();
	}
	insert(index) {
		this.cardCount += 1;
		this.update();
	}
	setVisuals() {
		document.getElementById(this.zone.type + this.zone.player.index).src = getCardImage(this.zone.get(this.index), "tiny");
		document.getElementById(this.zone.type + this.zone.player.index + "CardCount").textContent = this.cardCount > 0? this.cardCount : "";
	}

	getButtonHolder() {
		return document.getElementById(this.zone.type + this.zone.player.index + "CardButtons");
	}
}

// technically only needed for manual games but manualUI.js can't easily create these on its own so it's here for now.
class PresentedCardSlot extends UiCardSlot {
	constructor(zone, index) {
		super(zone, index);

		this.isRevealed = !zone.get(index).hiddenFor.includes(game.players[0]);
		this.zoneElem = document.getElementById("presentedCards" + zone.player.index);
		this.cardElem = document.createElement("div");

		this.cardImg = document.createElement("img");
		this.cardImg.src = getCardImage(zone.get(index), "tiny");
		this.cardImg.addEventListener("click", function(e) {
			e.stopPropagation();
			previewCard(this.zone.get(this.index));
		}.bind(this));
		setCardDragEvent(this.cardImg, this);
		this.cardElem.appendChild(this.cardImg);

		if (this.zone.player === localPlayer) {
			this.revealBtn = document.createElement("button");
			this.revealBtn.textContent = localize(`game.manual.presented.${this.isRevealed? "hide" : "reveal"}`);
			this.revealBtn.addEventListener("click", function() {
				this.isRevealed = !this.isRevealed;
				netSend(this.isRevealed? "revealCard" : "unrevealCard", this.index);
				this.revealBtn.textContent = localize(`game.manual.presented.${this.isRevealed? "hide" : "reveal"}`);
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
		this.cardImg.src = getCardImage(this.zone.get(this.index), "tiny");
	}
	insert(index) {
		if (index <= this.index) {
			this.index++;
			this.update();
		}
	}
	remove(index) {
		if (index == this.index) {
			super.remove(index);
			this.cardElem.remove();
		} else if (index < this.index) {
			this.index--;
			this.update();
		}
	}
}

class CardSelectorSlot extends UiCardSlot {
	constructor(zone, index) {
		super(zone, index);

		this.cardElem = document.createElement("img");
		this.cardElem.src = getCardImage(zone.get(index), "tiny");
		this.cardElem.classList.add("card");
		if (!cardSelectorSorted) {
			this.cardElem.style.order = -index;
		}
		setCardDragEvent(this.cardElem, this);
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
		this.cardElem.src = getCardImage(this.zone.get(this.index), "tiny");
	}
	insert(index) {
		if (index <= this.index) {
			this.index++;
			this.update();
		}
	}
	remove(index) {
		if (index == this.index) {
			super.remove(index);
			this.cardElem.remove();
			cardSelectorSlots.splice(cardSelectorSlots.indexOf(this), 1);
		} else if (index < this.index) {
			this.index--;
			this.update();
		}
	}
}

class CardSelectorMainSlot extends UiCardSlot {
	constructor() {
		super(null, -1);
	}

	remove(index) {}
	insert(index) {
		this.zone.cards[index].showTo(localPlayer);
		cardSelectorSlots.push(new CardSelectorSlot(this.zone, index));
	}
}

export function openCardSelect(zone) {
	if (cardSelector.open) {
		closeCardSelect();
	}
	cardSelectorMainSlot.zone = zone;
	let cards = Array.from(zone.cards.entries());
	if (zone.type === "deck") {
		cardSelectorSorted = true;
		cards.sort((a, b) => Card.sort(a[1], b[1]));
	}
	for (const card of cards) {
		card[1].showTo(localPlayer);
		cardSelectorSlots.push(new CardSelectorSlot(zone, card[0]));
	}

	//show selector
	cardSelectorTitle.textContent = localize("game.cardSelector.title", zone);
	if (document.getElementById("cardSelectorReturnToDeck")) {
		if ((zone.player === localPlayer) && (zone.type == "discard" || zone.type == "exile")) {
			cardSelectorReturnToDeck.hidden = false;
		} else {
			cardSelectorReturnToDeck.hidden = true;
		}
	}
	cardSelector.showModal();
	cardSelector.appendChild(cardDetails);

	cardSelectorGrid.parentNode.scrollTop = 0;
}
export function closeCardSelect() {
	if (cardSelectorMainSlot.zone?.type === "deck") {
		for (let card of cardSelectorMainSlot.zone.cards) {
			card.hideFrom(localPlayer);
		}
	}
	cardSelectorMainSlot.zone = null;
	while (cardSelectorSlots.length > 0) {
		cardSelectorSlots[0].remove(cardSelectorSlots[0].index);
	}
	gameFlexBox.appendChild(cardDetails);
	cardSelector.close();
	// The timeout is necessary because reparenting and transitioning an element at the same time skips the transition.
	window.setTimeout(closeCardPreview, 0);
}
export function toggleCardSelect(zone) {
	if (cardSelectorMainSlot.zone === zone) {
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

		this.dragging = null;
		this.dragCardElem = document.createElement("img");
		this.dragCardElem.classList.add("dragCard");

		this.cursorElem = document.createElement("img");
		this.cursorElem.classList.add("dragCard");
		this.cursorElem.src = "images/opponentCursor.png";
		this.cursorElem.hidden = true;
		this.cursorElem.style.setProperty("pointer-events", "none");
		draggedCardImages.appendChild(this.cursorElem);
		draggedCardImages.appendChild(this.dragCardElem);
		if (player === localPlayer) {
			this.dragCardElem.id = "yourDragCard";
			this.cursorElem.hidden = true;
		} else {
			this.dragCardElem.hidden = true;
			this.dragCardElem.addEventListener("click", function () {
				previewCard(this.dragging);
			}.bind(this));
		}
	}

	setDrag(card) {
		if (card) {
			this.dragCardElem.src = getCardImage(card, "tiny");
			this.dragging = card;
		}
	}
	clearDrag() {
		this.dragCardElem.src = "images/cardHidden.png";
		this.dragging = null;
	}
}

const uiValues = [];
export class UiValue {
	constructor(initial, speed, displayElem) {
		this.value = initial;
		this.targetValue = initial;
		this.counter = 0;
		this.baseSpeed = speed; // larger values = slower, 0 = instant
		this.speed = speed; // the speed with multiplier applied
		this.displayElem = displayElem;
		uiValues.push(this);
	}

	async set(value, speedMultiplier = 1) {
		if (value != this.value) {
			this.targetValue = value;
			if (speedMultiplier === 0) {
				this.value = value;
				this.displayElem.textContent = this.value;
			} else {
				this.speed = this.baseSpeed * speedMultiplier;
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

	remove() {
		uiValues.splice(uiValues.indexOf(this), 1);
	}
}

function animate(currentTime) {
	const delta = currentTime - lastFrame;
	lastFrame = currentTime;

	for (const value of uiValues) {
		value.animate(delta);
	}

	for (const uiPlayer of uiPlayers) {
		// cursors
		uiPlayer.posX += (uiPlayer.targetX - uiPlayer.posX) / 5;
		uiPlayer.posY += (uiPlayer.targetY - uiPlayer.posY) / 5;

		uiPlayer.dragCardElem.style.left = (uiPlayer.posX * fieldRect.height + fieldRect.width / 2) + "px";
		uiPlayer.dragCardElem.style.top = uiPlayer.posY * fieldRect.height + "px";
		uiPlayer.cursorElem.style.left = uiPlayer.dragCardElem.style.left;
		uiPlayer.cursorElem.style.top = uiPlayer.dragCardElem.style.top;

		const velX = uiPlayer.posX - uiPlayer.lastX;
		const velY = uiPlayer.lastY - uiPlayer.posY;

		const flipped = uiPlayer.player.index % 2 == 0;
		uiPlayer.dragCardElem.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (velX > 0? Math.min(Math.PI / 3, velX * 100) : Math.max(Math.PI / -3, velX * 100)) + "rad) rotateX(" + (velY > 0? Math.min(Math.PI / 3, velY * 100) : Math.max(Math.PI / -3, velY * 100)) + "rad)" + (flipped? " rotateZ(180deg)" : "");

		uiPlayer.lastX = uiPlayer.posX;
		uiPlayer.lastY = uiPlayer.posY;

		if (uiPlayer.life.value == 0) {
			document.getElementById("profilePicture" + uiPlayer.player.index).style.filter = "grayscale(100%)";
			document.getElementById("playerInfoHolder" + uiPlayer.player.index).style.filter = "opacity(50%)";
		} else {
			document.getElementById("profilePicture" + uiPlayer.player.index).style.filter = "";
			document.getElementById("playerInfoHolder" + uiPlayer.player.index).style.filter = "";
		}
	}

	requestAnimationFrame(animate);
}

// card choice modal (blocking card selector)
export async function presentCardChoice(cards, title, matchFunction = () => true, validAmounts = [1], request = null) {
	return new Promise(resolve => {
		let validOptions = 0;
		let currentGrid;
		for (let i = 0; i < cards.length; i++) {
			if (i === 0 || cards[i].zone != cards[i-1].zone) {
				const zoneDiv = document.createElement("div");
				const header = document.createElement("div");
				header.classList.add("gridHeader");
				header.textContent = localize("game.cardSelector.title", cards[i].zone);
				currentGrid = document.createElement("div");
				currentGrid.classList.add("cardGrid");

				if (i !== 0) {
					zoneDiv.appendChild(document.createElement("hr"));
				}
				zoneDiv.appendChild(header);
				zoneDiv.appendChild(currentGrid);
				cardChoiceArea.appendChild(zoneDiv);
			}

			let cardImg = document.createElement("img");
			cardImg.src = getCardImage(cards[i], "tiny");
			if (matchFunction(cards[i])) {
				validOptions++;
				cardImg.dataset.selectionIndex = i;
				cardImg.addEventListener("click", async function(e) {
					e.stopPropagation();
					previewCard(cards[i]);
					if (this.classList.toggle("cardHighlight")) {
						if (validAmounts.length === 1 && validAmounts[0] === 1 && cardChoiceSelected.length > 0) {
							for (let elem of Array.from(cardChoiceArea.querySelectorAll(".cardHighlight"))) {
								if (elem != this) {
									elem.classList.remove("cardHighlight");
								}
							}
							cardChoiceSelected = [];
						}
						cardChoiceSelected.push(parseInt(this.dataset.selectionIndex));
					} else {
						cardChoiceSelected.splice(cardChoiceSelected.indexOf(parseInt(this.dataset.selectionIndex)), 1);
					}
					cardChoiceConfirm.disabled = !validAmounts.includes(cardChoiceSelected.length) ||
												 (await request?.validate({
													type: "chooseCards",
													value: cardChoiceSelected
												 }) ?? "") !== "";
				});
			} else {
				cardImg.classList.add("unselectableCard");
			}
			currentGrid.appendChild(cardImg);
		}
		cardChoiceMenu.addEventListener("close", function() {
			resolve(this.returnValue.split("|").map(val => parseInt(val)));
		});

		cardChoiceTitle.textContent = title;
		cardChoiceConfirm.disabled = true;
		cardChoiceMenu.showModal();
		cardChoiceMenu.appendChild(cardDetails);

		cardChoiceArea.parentNode.scrollTop = 0;
	});
}

export async function askQuestion(question, yesButton, noButton) {
	questionPopupText.textContent = question;
	questionPopupYesButton.textContent = yesButton;
	questionPopupNoButton.textContent = noButton;
	questionPopup.showModal();

	return new Promise(resolve => {
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


// adds a new counter element to a card
export function addCounter(slotIndex, name) {
	const counter = document.createElement("div");
	counter.classList.add("counter");
	counter.textContent = "1";
	if (name) {
		counter.title = name;
	}

	const holder = document.getElementById(`field${slotIndex}`).parentElement.querySelector(".counterHolder");
	holder.insertBefore(counter, holder.querySelector(".counterAddBtn"));
	return counter;
}

export function setCounter(counterElem, value) {
	counterElem.textContent = value;
	if (value == 6 || value == 9) {
		counterElem.textContent += ".";
	}
}

export function clearCounters(slotIndex) {
	for (const counter of document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").querySelectorAll(".counter")) {
		counter.remove();
	}
}


// blackout-overlay
export function showBlackoutMessage(message, subtitle = "") {
	closeCardPreview();
	blackoutMainMessage.textContent = message;
	blackoutSubtitle.textContent = subtitle;
	mainGameBlackout.classList.remove("hidden");
}

export async function playerWon(player) {
	let winString = "";
	if (player.victoryConditions[0].startsWith("cardEffect:")) {
		winString = localize(`game.gameOver.cardEffect`, {PLAYER: player, CARD: (await cardLoader.getCardInfo(request.reason.split(":")[1])).name});
	} else {
		winString = localize(`game.gameOver.${player.victoryConditions[0]}`, player.next());
	}
	finishGame(
		// Victory message is focused on the local player, or the winner if there is no local player
		localPlayer? localize(`game.gameOver.${player === localPlayer? "victory" : "loss"}`) : localize("game.gameOver.playerWon", player),
		winString
	);
}
export function gameDrawn() {
	finishGame(localize("game.gameOver.draw"), localize("game.gameOver.bothWon"));
}

function finishGame(message, subtitle) {
	showBlackoutMessage(message, subtitle);
	playerDeckButton0.disabled = false;
	leaveGameBtn.hidden = false;
	showFieldBtn.hidden = false;
}

leaveGameBtn.addEventListener("click", () => {
	callingWindow.postMessage({type: "leaveGame"});
	netSend("leave");
});
showFieldBtn.addEventListener("click", function() {
	if (mainGameBlackout.hidden) {
		mainGameBlackout.hidden = false;
		this.textContent = localize("game.gameOver.showField");
	} else {
		mainGameBlackout.hidden = true;
		this.textContent = localize("game.gameOver.reopenGameOverMenu");
	}
});