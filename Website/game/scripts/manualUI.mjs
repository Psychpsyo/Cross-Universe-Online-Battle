// this file holds all the code needed for UI that is required during manual games.

import localize from "../../scripts/locale.mjs";
import {netSend} from "./netcode.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";

export function init() {
	Array.from(document.querySelectorAll(".automaticOnly")).forEach(elem => elem.remove());
	document.documentElement.classList.add("manualGame");

	if (localPlayer) {
		initInteraction();
	}
}

function initInteraction() {
	// translation
	for (let i = 0; i < 2; i++) {
		document.getElementById("deckTopBtn"+ i).textContent = localize("game.manual.deck.dropTop");
		document.getElementById("deckShuffleInBtn" + i).textContent = localize("game.manual.deck.dropShuffle");
		document.getElementById("deckBottomBtn" + i).textContent = localize("game.manual.deck.dropBottom");
		document.getElementById("deckCancelBtn" + i).textContent = localize("game.manual.deck.dropCancel");
		document.getElementById("showTopBtn" + i).textContent = localize("game.manual.deck.showTop");
	}

	drawBtn.textContent = localize("game.manual.deck.draw");
	shuffleBtn.textContent = localize("game.manual.deck.shuffle");
	deckSearchBtn.textContent = localize("game.manual.deck.search");

	lifeBtnHeader.textContent = localize("game.manual.actions.life");
	manaBtnHeader.textContent = localize("game.manual.actions.mana");
	tokenBtn.textContent = localize("game.manual.actions.tokens");
	lifeHalf.textContent = localize("game.manual.actions.half");
	showHandBtn.textContent = localize("game.manual.actions.showHand");

	cardSelectorReturnToDeck.textContent = localize("game.cardSelector.returnAllToDeck");

	gameInteractions.hidden = false;

	//showing/hiding your hand
	function hideHand() {
		netSend("hideHand");
		document.getElementById("showHandBtn").textContent = localize("game.manual.actions.showHand");
		document.getElementById("showHandBtn").addEventListener("click", showHand, {once: true});
		document.getElementById("hand1").classList.remove("shown");
	}
	function showHand() {
		netSend("showHand");
		document.getElementById("showHandBtn").textContent = localize("game.manual.actions.hideHand");
		document.getElementById("showHandBtn").addEventListener("click", hideHand, {once: true});
		document.getElementById("hand1").classList.add("shown");
	}
	document.getElementById("showHandBtn").addEventListener("click", showHand, {once: true});

	// life changes
	document.getElementById("lifeUp100").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, localPlayer.life + 100);
	});
	document.getElementById("lifeUp50").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, localPlayer.life + 50);
	});
	document.getElementById("lifeUp1").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, localPlayer.life + 1);
	});
	document.getElementById("lifeDown100").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, localPlayer.life - 100);
	});
	document.getElementById("lifeDown50").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, localPlayer.life - 50);
	});
	document.getElementById("lifeDown1").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, localPlayer.life - 1);
	});
	document.getElementById("lifeHalf").addEventListener("click", function() {
		gameState.controller.setLife(localPlayer, Math.ceil(localPlayer.life / 2));
	});

	// mana changes
	document.getElementById("manaUp").addEventListener("click", function() {
		gameState.controller.setMana(localPlayer, localPlayer.mana + 1);
	});
	document.getElementById("manaFive").addEventListener("click", function() {
		gameState.controller.setMana(localPlayer, 5);
	});
	document.getElementById("manaDown").addEventListener("click", function() {
		gameState.controller.setMana(localPlayer, localPlayer.mana - 1);
	});

	// tokens
	tokenBtn.addEventListener("click", function() {
		gameUI.openCardSelect(gameState.controller.tokenZone);
	});

	// counters
	document.getElementById("field").addEventListener("contextmenu", function (e) {e.preventDefault();});

	// event listeners to add counters and sync those additions.
	for (let btn of Array.from(document.getElementsByClassName("counterAddBtn"))) {
		btn.addEventListener("click", function() {
			let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substring(5));
			addCounter(fieldSlot);
			netSend("counterAdd", fieldSlot);
		});
	}

	// deck options
	document.getElementById("drawBtn").addEventListener("click", function() {
		gameState.controller.deckDraw(localPlayer);
		if (localPlayer.deckZone.cards.length == 0) {
			document.getElementById("deckHoverBtns1").style.display = "none";
		}
	});
	document.getElementById("shuffleBtn").addEventListener("click", function() {
		gameState.controller.deckShuffle(localPlayer.deckZone);
	});
	document.getElementById("deckSearchBtn").addEventListener("click", function() {
		gameUI.openCardSelect(localPlayer.deckZone);
	});

	for (const player of game.players) {
		// dropping to deck
		document.getElementById("deckTopBtn" + player.index).addEventListener("click", function() {
			gameState.controller.deckToTop(localPlayer, player.deckZone);
			document.getElementById("deckDropOptions" + player.index).style.display = "none";
		});
		document.getElementById("deckBottomBtn" + player.index).addEventListener("click", function() {
			gameState.controller.deckToBottom(localPlayer, player.deckZone);
			document.getElementById("deckDropOptions" + player.index).style.display = "none";
		});
		document.getElementById("deckShuffleInBtn" + player.index).addEventListener("click", function() {
			gameState.controller.deckShuffleIn(localPlayer, player.deckZone);
			document.getElementById("deckDropOptions" + player.index).style.display = "none";
		});
		document.getElementById("deckCancelBtn" + player.index).addEventListener("click", function() {
			gameState.controller.deckCancelDrop(localPlayer);
			document.getElementById("deckDropOptions" + player.index).style.display = "none";
		});

		// hovering the deck
		document.getElementById("deck" + player.index).addEventListener("mouseover", function() {
			if (player.deckZone.cards.length > 0 && !gameState.controller.playerInfos[localPlayer.index].heldCard) {
				document.getElementById("deckHoverBtns" + player.index).style.display = "block";
			}
		});
		document.getElementById("deck" + player.index).parentElement.addEventListener("mouseleave", function(e) {
			document.getElementById("deckHoverBtns" + player.index).style.display = "none";
		});
		document.getElementById("showTopBtn" + player.index).addEventListener("click", function() {
			gameState.controller.deckShowTop(localPlayer, player.deckZone);
			if (player.deckZone.cards.length == 0) {
				document.getElementById("deckHoverBtns" + player.index).style.display = "none";
			}
		});

		// presented cards
		document.getElementById("presentedCards" + player.index).addEventListener("pointerup", function(e) {
			if (e.pointerId != gameUI.currentPointer) {
				return;
			}
			e.stopPropagation();
			const presentedZone = gameState.controller.playerInfos[player.index].presentedZone;
			gameUI.dropCard(localPlayer, presentedZone, presentedZone.cards.length);
		});
	}

	// card selector
	cardSelectorReturnToDeck.addEventListener("click", function(e) {
		gameState.controller.returnAllToDeck(gameUI.cardSelectorMainSlot.zone);
		gameUI.closeCardSelect();
	});
}

export function receiveMessage(command, message, player) {
	switch (command) {
		case "dice": { // opponent clicked the button on 'Fate's Dice' to roll a dice.
			cardLoader.getCardInfo(message.substring(message.indexOf("|") + 1)).then(card => {
				chat.putMessage(localize("cardActions.I00040.playerRolled", {
					PLAYER: player,
					CARDNAME: card.name,
					RESULT: message.substring(0, message.indexOf("|"))
				}), "notice");
			}, ()=>{}); // do nothing on errors
			return true;
		}
		case "laplaceScan": { // opponent used the button on 'Absolute God of the Perfect World' to look at your entire deck
			chat.putMessage(localize("cardActions.U00286.activation", {PLAYER: player, TARGET: player.next()}), "notice");
			return true;
		}
		case "counterAdd": {
			addCounter(getCounterSlotIndex(parseInt(message), player));
			return true;
		}
		case "counterIncrease": {
			const slotIndex = getCounterSlotIndex(parseInt(message.substring(0, message.indexOf("|"))), player);
			const counterIndex = message.substring(message.indexOf("|") + 1);
			const counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
			gameUI.setCounter(counter, parseInt(counter.innerHTML) + 1);
			return true;
		}
		case "counterDecrease": {
			const slotIndex = getCounterSlotIndex(parseInt(message.substring(0, message.indexOf("|"))), player);
			const counterIndex = message.substring(message.indexOf("|") + 1);
			const counter = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex);
			gameUI.setCounter(counter, parseInt(counter.innerHTML) - 1);
			return true;
		}
		case "counterRemove": {
			const slotIndex = getCounterSlotIndex(parseInt(message.substring(0, message.indexOf("|"))), player);
			const counterIndex = message.substring(message.indexOf("|") + 1);
			document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder").children.item(counterIndex).remove();
			return true;
		}
		case "revealCard": { // opponent revealed a presented card
			const index = parseInt(message);
			gameState.controller.playerInfos[0].presentedZone.cards[index].showTo(localPlayer);
			gameUI.updateCard(gameState.controller.playerInfos[0].presentedZone, index);
			return true;
		}
		case "unrevealCard": { // opponent hid a presented card
			const index = parseInt(message);
			gameState.controller.playerInfos[0].presentedZone.cards[index].hideFrom(localPlayer);
			gameUI.updateCard(gameState.controller.playerInfos[0].presentedZone, index);
			return true;
		}
		default: {
			return false;
		}
	}
}

export function showDeckOptions(deckZone) {
	document.getElementById("deckDropOptions" + deckZone.player.index).style.display = "block";
}

// adds a counter to the specified field slot
function addCounter(slotIndex) {
	const counter = gameUI.addCounter(slotIndex);
	// prevent middle click default actions
	counter.addEventListener("mousedown", function (e) {e.preventDefault();})
	// edit the counter
	counter.addEventListener("click", function(e) {
		gameUI.setCounter(this, parseInt(this.textContent) + 1);
		const fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substring(5));
		const counterIndex = Array.from(this.parentElement.children).indexOf(this);
		netSend("counterIncrease", fieldSlot + "|" + counterIndex);
	});
	counter.addEventListener("auxclick", function(e) {
		const fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substring(5));
		const counterIndex = Array.from(this.parentElement.children).indexOf(this);
		switch (e.button) {
			case 1:
				this.remove();
				netSend("counterRemove", fieldSlot + "|" + counterIndex);
				break;
			case 2:
				if (parseInt(this.textContent) == 0) {
					this.remove();
					netSend("counterRemove", fieldSlot + "|" + counterIndex);
				} else {
					gameUI.setCounter(this, parseInt(this.textContent) - 1);
					netSend("counterDecrease", fieldSlot + "|" + counterIndex);
				}
				break;
		}
		e.preventDefault();
	});
}

export function getCounterSlotIndex(slotIndex, fromPlayer) {
	const distance = fromPlayer.index - (localPlayer?.index ?? 1);
	return ((distance + game.players.length) % 2) === 0? slotIndex : 19 - slotIndex;
}