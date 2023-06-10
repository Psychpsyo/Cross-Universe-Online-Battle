// This module exports the manual controller, used for manually operated Cross Universe games.

import {InteractionController} from "/modules/interactionController.js";
import {locale} from "/modules/locale.js";
import {Zone} from "/rulesEngine/zones.js";
import {Card} from "/rulesEngine/card.js";
import {socket, zoneToLocal} from "/modules/netcode.js";
import {putChatMessage} from "/modules/generalUI.js";
import * as gameUI from "/modules/gameUI.js";
import * as manualUI from "/modules/manualUI.js";
import * as cardLoader from "/modules/cardLoader.js";

class tokenZone {
	constructor() {
		this.type = "tokens";
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
				cardLoader.getManualCdf(card.cardID).then(cdf => this.cards.push(new Card(localPlayer, cdf, false)));
			});
		});
	}

	get(index) {
		return this.cards[index];
	}
}

function addPartnerRevealButton() {
	gameUI.addFieldButton(localPlayer.partnerZone, 0, locale.game.partnerSelect.revealPartner, "revealPartner", function() {
		gameUI.clearFieldButtons(localPlayer.partnerZone, 0, "revealPartner");
		localPlayer.partnerZone.cards[0].hidden = false;
		gameUI.updateCard(localPlayer.partnerZone, 0);
		socket.send("[revealPartner]");
	}, true);
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
		gameState.zones["tokens"] = this.tokenZone;
	}
	
	async startGame() {
		if (youAre === 0) {
			this.deckShuffle(localPlayer.deckZone);
			let startingPlayer = Math.random() > .5;
			putChatMessage(startingPlayer? locale.game.youStart : locale.game.opponentStarts, "notice");
			socket.send("[selectPlayer]" + startingPlayer);
			addPartnerRevealButton();
		}
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "life": { // set opponent's life
				this.setLife(game.players[0], parseInt(message), false);
				return true;
			}
			case "mana": { // set opponent's mana
				this.setMana(game.players[0], parseInt(message));
				return true;
			}
			case "grabToken": {
				cardLoader.getManualCdf(message).then(cdf => this.playerInfos[0].setHeld(new Card(game.players[0], cdf, false)));
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
			case "deckOrder": { // opponent shuffled a deck
				let deck = zoneToLocal("deck" + message[0]);
				message = message.substr(2);
				let order = message.split("|").map(i => parseInt(i));
				deck.cards.sort((a, b) => order.indexOf(deck.cards.indexOf(a)) - order.indexOf(deck.cards.indexOf(b)));
				deck.reindex();
				for (let i = 0; i < deck.cards.length; i++) {
					gameUI.updateCard(deck, i);
				}
				putChatMessage(deck.playerIndex == 1? locale.game.yourDeckShuffled : locale.game.opponentDeckShuffled, "notice");
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
			case "selectPlayer": { // opponent chose the starting player (at random)
				this.deckShuffle(localPlayer.deckZone);
				putChatMessage(message == "true"? locale.game.opponentStarts : locale.game.youStart, "notice");
				addPartnerRevealButton();
				return true;
			}
			default: {
				return manualUI.receiveMessage(command, message);
			}
		}
	}
	
	// returns whether or not the card was fully grabbed from the zone
	grabCard(player, zone, index) {
		if (!zone.cards[index] || (zone.cards[index].hidden && player === localPlayer) || this.playerInfos[player.index].heldCard !== null) {
			return false;
		}
		if (zone == this.tokenZone) {
			cardLoader.getManualCdf(zone.cards[index].cardId).then(cdf => this.playerInfos[player.index].setHeld(new Card(localPlayer, cdf, false)));
			socket.send("[grabToken]" + zone.cards[index].cardId);
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
		if (zone != null && zone.type == "deck" && index == -1) {
			// When dropping a token, we don't want the UI, we want to just 'drop it to the top' which will make it vanish.
			if (!card.cardTypes.get().includes("token")) {
				gameUI.uiPlayers[player.index].clearDrag();
				if (player === localPlayer) {
					manualUI.showDeckOptions(zone);
				}
				return;
			}
			index = zone.cards.length;
		}
		
		if (card.zone) {
			gameUI.clearDragSource(card.zone, card.index, player);
		}
		
		if (!zone) {
			this.playerInfos[player.index].clearHeld();
			return;
		}
		
		let source = card.zone;
		let sourceIndex = card.index;
		let insertedIndex = zone.add(card, index);
		if (card.zone === zone) {
			if (source) {
				gameUI.removeCard(source, sourceIndex);
			}
			if (insertedIndex != -1) {
				if (zone === game.players[0].handZone) {
					card.hidden = !this.opponentHandShown;
				} else if (zone.type == "deck" || zone === this.playerInfos[0].presentedZone) {
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
				if (heldCard && heldCard.cardTypes.get().includes("token")) {
					socket.send("[uiDroppedCard]" + gameState.getZoneName(localPlayer.discardPile) + "|0");
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
		for (let i = order.length - 1; i > 0; i--) {
			// pick a random element and swap it with the current element
			let rand = Math.floor(Math.random() * i);
			
			[order[i], order[rand]] = [order[rand], order[i]];
		}
		deckZone.cards.sort((a, b) => order.indexOf(deckZone.cards.indexOf(a)) - order.indexOf(deckZone.cards.indexOf(b)));
		deckZone.reindex();
		for (let i = 0; i < deckZone.cards.length; i++) {
			gameUI.updateCard(deckZone, i);
		}
		socket.send("[deckOrder]" + deckZone.player.index + "|" + order.join("|"));
		putChatMessage(locale.game[deckZone.player === localPlayer? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
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
		
		gameUI.clearDragSource(card.zone, card.index, player);
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
			socket.send("[returnAllToDeck]" + gameState.getZoneName(zone));
			this.deckShuffle(localPlayer.deckZone);
		}
	}
	
	setLife(player, value) {
		value = Math.max(value, 0);
		if (value == player.life) {
			return;
		}
		player.life = value;
		gameUI.uiPlayers[player.index].life.set(value, false);
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
		gameUI.uiPlayers[player.index].mana.set(value, true);
		if (player === localPlayer) {
			socket.send("[mana]" + localPlayer.mana);
		}
	}
}

class ManualPlayerInfo {
	constructor(player) {
		this.player = player;
		this.heldCard = null;
		this.presentedZone = new Zone(player, "presented");
		gameState.zones["presented" + player.index] = this.presentedZone;
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