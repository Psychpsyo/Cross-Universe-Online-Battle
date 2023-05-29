// This module exports the manual controller, used for manually operated Cross Universe games.

import {InteractionController} from "/modules/interactionController.js";
import {locale} from "/modules/locale.js";
import {Zone} from "/modules/zone.js";
import {Card} from "/modules/card.js";
import {socket, zoneToLocal} from "/modules/netcode.js";
import * as generalUI from "/modules/generalUI.js";
import * as manualUI from "/modules/manualUI.js";

export class ManualController extends InteractionController {
	constructor() {
		super();
		
		this.opponentHandShown = false;
		this.playerInfos = [];
		for (let i = 0; i < game.players.length; i++) {
			this.playerInfos.push(new ManualPlayerInfo(i));
		}
		
		manualUI.init();
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
					generalUI.updateCard(game.players[0].handZone, i);
				}
				return true;
			}
			case "hideHand": {
				this.opponentHandShown = false;
				document.getElementById("hand0").classList.remove("shown");
				for (let i = 0; i < game.players[0].handZone.cards.length; i++) {
					game.players[0].handZone.cards[i].hidden = true;
					generalUI.updateCard(game.players[0].handZone, i);
				}
				return true;
			}
			default: {
				return manualUI.receiveMessage(command, message);
			}
		}
	}
	
	grabCard(player, zone, index) {
		if (!zone.cards[index] || (zone.cards[index].hidden && player === localPlayer) || this.playerInfos[player.index].heldCard !== null) {
			return false;
		}
		for (const playerInfo of this.playerInfos) {
			if (playerInfo.heldCard == zone.cards[index]) {
				return false;
			}
		}
		this.playerInfos[player.index].setHeld(zone.cards[index]);
		generalUI.makeDragSource(zone, index);
		return true;
	}
	
	dropCard(player, zone, index) {
		let card = this.playerInfos[player.index].heldCard;
		if (!card) {
			return;
		}
		if (zone != null && zone.name.startsWith("deck") && index == -1) {
			generalUI.uiPlayers[player.index].clearDrag();
			if (player === localPlayer) {
				manualUI.showDeckOptions(zone);
			}
			return;
		}
		
		let source = card.location;
		let sourceIndex = source.cards.indexOf(card);
		
		generalUI.clearDragSource(source, sourceIndex);
		
		if (!zone) {
			this.playerInfos[player.index].clearHeld();
			return;
		}
		
		let insertedIndex = zone.add(card, index);
		if (insertedIndex != -1) {
			if (zone === game.players[0].handZone) {
				card.hidden = !this.opponentHandShown;
			} else if (zone.name.startsWith("deck")) {
				card.hidden = true;
			} else if (!zone.name.startsWith("presented")) {
				card.hidden = false;
			}
			
			generalUI.removeCard(source, sourceIndex);
			generalUI.insertCard(zone, insertedIndex);
		}
		this.playerInfos[player.index].clearHeld();
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
		generalUI.removeCard(player.deckZone, player.deckZone.cards.length);
		generalUI.insertCard(player.handZone, insertedIndex);
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
		
		generalUI.clearDragSource(source, sourceIndex);
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
		let insertedIndex = player.presentedZone.add(card, player.presentedZone.cards.length);
		if (player == localPlayer) {
			card.hidden = false;
		}
		generalUI.removeCard(deckZone, deckZone.cards.length);
		generalUI.insertCard(player.presentedZone, insertedIndex);
	}
	returnAllToDeck(zone) {
		while (zone.cards.length > 0) {
			zone.player.deckZone.add(zone.cards[0], 0);
			generalUI.removeCard(zone, 0);
			generalUI.insertCard(zone.player.deckZone, 0);
		}
		if (zone.player === localPlayer) {
			socket.send("[returnAllToDeck]" + cardSelectorZone.name);
			this.deckShuffle(localPlayer.deckZone);
		}
	}
	
	setLife(player, value) {
		value = Math.max(value, 0);
		if (value == player.life) {
			return;
		}
		player.life = value;
		generalUI.uiPlayers[player.index].setLife(value);
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
		generalUI.uiPlayers[player.index].setMana(value);
		if (player === localPlayer) {
			socket.send("[mana]" + localPlayer.mana);
		}
	}
}

class ManualPlayerInfo {
	constructor(index) {
		this.index = index;
		this.heldCard = null;
	}
	
	setHeld(card) {
		this.heldCard = card;
		generalUI.uiPlayers[this.index].setDrag(card);
	}
	clearHeld() {
		this.heldCard = null;
		generalUI.uiPlayers[this.index].clearDrag();
	}
}