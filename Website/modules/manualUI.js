// this file holds all the code needed for UI that is required during manual games.

import {locale} from "/modules/locale.js";
import {socket} from "/modules/netcode.js";
import * as gameUI from "/modules/gameUI.js";
import {putChatMessage} from "/modules/generalUI.js";

export function init() {
	Array.from(document.querySelectorAll(".automaticOnly")).forEach(elem => elem.remove());
	
	// translation
	revealPartnerBtn.textContent = locale.partnerSelect.revealPartner;
	for (let i = 0; i < 2; i++) {
		document.getElementById("deckTopBtn"+ i).textContent = locale.deckDropTop;
		document.getElementById("deckShuffleInBtn" + i).textContent = locale.deckDropShuffle;
		document.getElementById("deckBottomBtn" + i).textContent = locale.deckDropBottom;
		document.getElementById("deckCancelBtn" + i).textContent = locale.deckDropCancel;
		document.getElementById("showTopBtn" + i).textContent = locale.deckShowTop;
	}
	
	drawBtn.textContent = locale.deckDraw;
	shuffleBtn.textContent = locale.deckShuffle;
	deckSearchBtn.textContent = locale.deckSearch;
	
	lifeBtnHeader.textContent = locale.life;
	manaBtnHeader.textContent = locale.mana;
	tokenBtn.textContent = locale.actionsTokens;
	lifeHalf.textContent = locale.actionsHalf;
	showHandBtn.textContent = locale.actionsShowHand;
	
	cardSelectorReturnToDeck.textContent = locale.cardSelector.returnAllToDeck;
	
	gameInteractions.removeAttribute("hidden");
	
	// partner reveal button
	revealPartnerBtn.addEventListener("click", function() {
		document.getElementById("partnerRevealButtonDiv").style.display = "none";
		localPlayer.partnerZone.cards[0].hidden = false;
		gameUI.updateCard(localPlayer.partnerZone, 0);
		socket.send("[revealPartner]");
	});
	
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
			let fieldSlot = parseInt(this.parentElement.parentElement.querySelector("img").id.substr(5));
			addCounter(fieldSlot);
			socket.send("[counterAdd]" + fieldSlot);
		});
	}
	
	// returns all cards from the card selector to your deck and closes the selector
	cardSelectorReturnToDeck.addEventListener("click", function() {
		gameState.controller.returnAllToDeck(gameUI.cardSelectorZone);
		gameUI.closeCardSelect();
	});
	
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
		document.getElementById("deckHoverBtns1").style.display = "none"; //workaround for bug in Firefox (at least) where mouseleave does not fire when element is covered by another. (in this case the card selector)
	});
	
	game.players.forEach(player => {
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
	});
	
	document.documentElement.classList.add("manualGame");
}

export function receiveMessage(command, message) {
	switch (command) {
		case "dice": { // opponent rolled a dice with /dice in chat
			putChatMessage(locale["cardActions"]["I00040"]["opponentRoll"].replace("{#RESULT}", message), "notice");
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
		case "revealCard": { // opponent revealed a presented card
			let index = parseInt(message);
			gameState.controller.playerInfos[0].presentedZone.cards[index].hidden = false;
			gameUI.updateCard(gameState.controller.playerInfos[0].presentedZone, index);
			return true;
		}
		case "unrevealCard": { // opponent hid a presented card
			let index = parseInt(message);
			gameState.controller.playerInfos[0].presentedZone.cards[index].hidden = true;
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
	let counter = document.createElement("div");
	counter.classList.add("counter");
	counter.textContent = "1";
	// prevent middle click default actions
	counter.addEventListener("mousedown", function (e) {e.preventDefault();})
	// edit the counter
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