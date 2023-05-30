// This module exports the manual controller, used for manually operated Cross Universe games.

import {InteractionController} from "/modules/interactionController.js";
import {locale} from "/modules/locale.js";
import {Zone} from "/rulesEngine/zone.js";
import {Card} from "/rulesEngine/card.js";
import {socket, zoneToLocal} from "/modules/netcode.js";
import {putChatMessage} from "/modules/generalUI.js";
import * as gameUI from "/modules/gameUI.js";
import * as manualUI from "/modules/manualUI.js";

class tokenZone {
	constructor() {
		this.name = "token";
		this.cards = [];
		
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
				// intentionally bypasses registerCard()
				card.imageSrc = getCardImageFromID(card.cardID);
				game.cardData[card.cardID] = card;
				this.cards.push(new Card(localPlayer, card.cardID, false));
			});
		});
	}
	
	getLocalizedName() {
		return locale.cardSelector.tokens;
	}
}

export class ManualController extends InteractionController {
	constructor() {
		super();
		
		this.opponentHandShown = false;
		this.playerInfos = [];
		for (const player of game.players) {
			this.playerInfos.push(new ManualPlayerInfo(player));
		}
		
		manualUI.init();
		
		this.tokenZone = new tokenZone();
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "life": { // set opponent's life
				this.setLife(game.players[0], parseInt(message));
				return true;
			}
			case "mana": { // set opponent's mana
				this.setMana(game.players[0], parseInt(message));
				return true;
			}
			case "grabToken": {
				this.playerInfos[0].setHeld(new Card(game.players[0], message, false));
				return true;
			}
			case "drawCard": {
				this.deckDraw(game.players[0]);
				return true;
			}
			case "deckToTop": { // opponent sent their held card to the top of a deck
				this.deckToTop(game.players[0], zoneToLocal("deck" + message));
				return true;
			}
			case "deckToBottom": { // opponent sent their held card to the bottom of a deck
				this.deckToBottom(game.players[0], zoneToLocal("deck" + message));
				return true;
			}
			case "deckShuffleIn": { // opponent shuffles their held card into a deck
				this.deckShuffleIn(game.players[0], zoneToLocal("deck" + message));
				return true;
			}
			case "deckCancel": { // opponent cancelled dropping their held card into a deck
				this.deckCancelDrop(game.players[0]);
				return true;
			}
			case "deckShowTop": { // opponent presented a card
				this.deckShowTop(game.players[0], zoneToLocal("deck" + message));
				return true;
			}
			case "returnAllToDeck": {
				this.returnAllToDeck(zoneToLocal(message));
				return true;
			}
			case "showHand": {
				this.opponentHandShown = true;
				document.getElementById("hand0").classList.add("shown");
				for (let i = 0; i < game.players[0].handZone.cards.length; i++) {
					game.players[0].handZone.cards[i].hidden = false;
					gameUI.updateCard(game.players[0].handZone, i);
				}
				return true;
			}
			case "hideHand": {
				this.opponentHandShown = false;
				document.getElementById("hand0").classList.remove("shown");
				for (let i = 0; i < game.players[0].handZone.cards.length; i++) {
					game.players[0].handZone.cards[i].hidden = true;
					gameUI.updateCard(game.players[0].handZone, i);
				}
				return true;
			}
			default: {
				return manualUI.receiveMessage(command, message);
			}
		}
	}
	
	// returns whether or not the card was fully grabbed from the zone
	grabCard(player, zone, index) {
		if (zone == this.tokenZone) {
			this.playerInfos[player.index].setHeld(new Card(localPlayer, zone.cards[index].cardId, false));
			socket.send("[grabToken]" + zone.cards[index].cardId);
			return false;
		}
		if (!zone.cards[index] || (zone.cards[index].hidden && player === localPlayer) || this.playerInfos[player.index].heldCard !== null) {
			return false;
		}
		for (const playerInfo of this.playerInfos) {
			if (playerInfo.heldCard == zone.cards[index]) {
				return false;
			}
		}
		this.playerInfos[player.index].setHeld(zone.cards[index]);
		gameUI.makeDragSource(zone, index, player);
		return true;
	}
	
	dropCard(player, zone, index) {
		let card = this.playerInfos[player.index].heldCard;
		if (!card) {
			return;
		}
		if (zone != null && zone.name.startsWith("deck") && index == -1) {
			// When dropping a token, we don't want the UI, we want to just 'drop it to the top' which will make it vanish.
			if (!card.getCardTypes().includes("token")) {
				gameUI.uiPlayers[player.index].clearDrag();
				if (player === localPlayer) {
					manualUI.showDeckOptions(zone);
				}
				return;
			}
			index = zone.cards.length;
		}
		
		let source = card.location;
		let sourceIndex = source? source.cards.indexOf(card) : -1;
		if (source) {
			gameUI.clearDragSource(source, sourceIndex, player);
		}
		
		if (!zone) {
			this.playerInfos[player.index].clearHeld();
			return;
		}
		
		let insertedIndex = zone.add(card, index);
		if (card.location === zone) {
			if (source) {
				gameUI.removeCard(source, sourceIndex);
			}
			if (insertedIndex != -1) {
				if (zone === game.players[0].handZone) {
					card.hidden = !this.opponentHandShown;
				} else if (zone.name.startsWith("deck") || zone === this.playerInfos[0].presentedZone) {
					card.hidden = true;
				} else {
					card.hidden = false;
				}
				
				gameUI.insertCard(zone, insertedIndex);
			}
		}
		this.playerInfos[player.index].clearHeld();
	}
	
	hotkeyPressed(name) {
		switch(name) {
			case "showDeck": {
				gameUI.toggleCardSelect(localPlayer.deckZone);
				break;
			}
			case "selectToken": {
				gameUI.toggleCardSelect(this.tokenZone);
				break;
			}
			case "destroyToken": {
				let heldCard = this.playerInfos[localPlayer.index].heldCard;
				if (heldCard && heldCard.getCardTypes().includes("token")) {
					socket.send("[uiDroppedCard]" + localPlayer.discardPile.name + "|0");
					this.dropCard(localPlayer, localPlayer.discardPile, 0);
				}
				break;
			}
			case "drawCard": {
				this.deckDraw(localPlayer);
				break;
			}
			case "shuffleDeck": {
				this.deckShuffle(localPlayer.deckZone);
				break;
			}
			case "showDeckTop": {
				this.deckShowTop(localPlayer, player.deckZone);
				break;
			}
		}
	}
	
	deckDraw(player) {
		if (player.deckZone.cards.length == 0) {
			return;
		}
		if (player === localPlayer) {
			socket.send("[drawCard]");
		}
		let card = player.deckZone.cards[player.deckZone.cards.length - 1];
		let insertedIndex = player.handZone.add(card, player.handZone.cards.length);
		if (player == localPlayer || this.opponentHandShown) {
			card.hidden = false;
		}
		gameUI.removeCard(player.deckZone, player.deckZone.cards.length);
		gameUI.insertCard(player.handZone, insertedIndex);
	}
	deckShuffle(deckZone) {
		let order = [];
		for (var i = 0; i < deckZone.cards.length; i++) {
			order.push(i);
		}
		// Fisher-Yates shuffle
		for (let i = order.length - 1; i >= 0; i--) {
			// pick a random element and swap it with the current element
			let rand = Math.floor(Math.random() * i);
			
			[order[i], order[rand]] = [order[rand], order[i]];
		}
		deckZone.cards.sort((a, b) => order.indexOf(deckZone.cards.indexOf(a)) - order.indexOf(deckZone.cards.indexOf(b)));
		socket.send("[deckOrder]" + deckZone.player.index + "|" + order.join("|"));
		putChatMessage(locale[deckZone.player === localPlayer? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
	}
	deckToTop(player, deckZone) {
		if (player === localPlayer) {
			socket.send("[deckToTop]" + deckZone.player.index);
		}
		this.dropCard(player, deckZone, deckZone.cards.length);
	}
	deckToBottom(player, deckZone) {
		if (player === localPlayer) {
			socket.send("[deckToBottom]" + deckZone.player.index);
		}
		this.dropCard(player, deckZone, 0);
	}
	deckShuffleIn(player, deckZone) {
		this.dropCard(player, deckZone, 0);
		if (player === localPlayer) {
			socket.send("[deckShuffleIn]" + deckZone.player.index);
			this.deckShuffle(deckZone);
		}
	}
	deckCancelDrop(player) {
		if (player === localPlayer) {
			socket.send("[deckCancel]");
		}
		let card = this.playerInfos[player.index].heldCard;
		let source = card.location;
		let sourceIndex = source.cards.indexOf(card);
		
		gameUI.clearDragSource(source, sourceIndex, player);
		this.playerInfos[player.index].clearHeld();
	}
	deckShowTop(player, deckZone) {
		if (deckZone.cards.length == 0) {
			return;
		}
		if (player === localPlayer) {
			socket.send("[deckShowTop]" + deckZone.player.index);
		}
		let card = deckZone.cards[deckZone.cards.length - 1];
		let presentedZone = this.playerInfos[player.index].presentedZone;
		let insertedIndex = presentedZone.add(card, presentedZone.cards.length);
		if (player == localPlayer) {
			card.hidden = false;
		}
		gameUI.removeCard(deckZone, deckZone.cards.length);
		gameUI.insertCard(presentedZone, insertedIndex);
	}
	returnAllToDeck(zone) {
		if (zone.cards.length == 0) {
			return;
		}
		while (zone.cards.length > 0) {
			zone.cards[0].hidden = true;
			zone.player.deckZone.add(zone.cards[0], 0);
			gameUI.removeCard(zone, 0);
			gameUI.insertCard(zone.player.deckZone, 0);
		}
		if (zone.player === localPlayer) {
			socket.send("[returnAllToDeck]" + gameUI.cardSelectorZone.name);
			this.deckShuffle(localPlayer.deckZone);
		}
	}
	
	setLife(player, value) {
		value = Math.max(value, 0);
		if (value == player.life) {
			return;
		}
		player.life = value;
		gameUI.uiPlayers[player.index].setLife(value);
		if (player === localPlayer) {
			socket.send("[life]" + localPlayer.life);
		}
	}
	setMana(player, value) {
		value = Math.max(value, 0);
		if (value == player.mana) {
			return;
		}
		player.mana = value;
		gameUI.uiPlayers[player.index].setMana(value);
		if (player === localPlayer) {
			socket.send("[mana]" + localPlayer.mana);
		}
	}
}

class ManualPlayerInfo {
	constructor(player) {
		this.player = player;
		this.heldCard = null;
		this.presentedZone = new Zone("presented" + player.index, -1, player, false);
	}
	
	setHeld(card) {
		this.heldCard = card;
		gameUI.uiPlayers[this.player.index].setDrag(card);
	}
	clearHeld() {
		this.heldCard = null;
		gameUI.uiPlayers[this.player.index].clearDrag();
	}
}