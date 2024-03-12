// This module exports the manual controller, used for manually operated Cross Universe games.

import {InteractionController} from "./interactionController.mjs";
import {locale} from "/scripts/locale.mjs";
import {Zone} from "/rulesEngine/src/zones.mjs";
import {Card} from "/rulesEngine/src/card.mjs";
import {netSend, zoneToLocal} from "./netcode.mjs";
import * as gameUI from "./gameUI.mjs";
import * as manualUI from "./manualUI.mjs";
import * as cardLoader from "/scripts/cardLoader.mjs";

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
				cardLoader.getManualCdf(card.cardID).then(cdf => this.cards.push(new Card(localPlayer, cdf)));
			});
		});
	}

	get(index) {
		return this.cards[index];
	}
}

function addPartnerRevealButton() {
	gameUI.addCardButton(localPlayer.partnerZone, 0, locale.game.partnerSelect.revealPartner, "revealPartner", function() {
		gameUI.clearCardButtons(localPlayer.partnerZone, 0, "revealPartner");
		localPlayer.partnerZone.cards[0].hiddenFor = [];
		gameUI.updateCard(localPlayer.partnerZone, 0);
		netSend("[revealPartner]");
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
		this.deckShuffle(localPlayer.deckZone);
		let startingPlayer = await game.randomPlayer();
		chat.putMessage(startingPlayer === localPlayer? locale.game.notices.youStart : locale.game.notices.opponentStarts, "notice");
		addPartnerRevealButton();
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
				cardLoader.getManualCdf(message).then(cdf => this.playerInfos[0].setHeld(new Card(game.players[0], cdf)));
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
				message = message.substring(2);
				let order = message.split("|").map(i => parseInt(i));
				deck.cards.sort((a, b) => order.indexOf(deck.cards.indexOf(a)) - order.indexOf(deck.cards.indexOf(b)));
				deck.reindex();
				for (let i = 0; i < deck.cards.length; i++) {
					gameUI.updateCard(deck, i);
				}
				chat.putMessage(deck.player.index == 1? locale.game.notices.yourDeckShuffled : locale.game.notices.opponentDeckShuffled, "notice");
				return true;
			}
			case "showHand": {
				this.opponentHandShown = true;
				document.getElementById("hand0").classList.add("shown");
				for (let i = 0; i < game.players[0].handZone.cards.length; i++) {
					game.players[0].handZone.cards[i].showTo(localPlayer);
					gameUI.updateCard(game.players[0].handZone, i);
				}
				return true;
			}
			case "hideHand": {
				this.opponentHandShown = false;
				document.getElementById("hand0").classList.remove("shown");
				for (let i = 0; i < game.players[0].handZone.cards.length; i++) {
					game.players[0].handZone.cards[i].hideFrom(localPlayer);
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
		if (!zone.cards[index] || (zone.cards[index].hiddenFor.includes(localPlayer) && player === localPlayer) || this.playerInfos[player.index].heldCard !== null) {
			return false;
		}
		if (zone == this.tokenZone) {
			cardLoader.getManualCdf(zone.cards[index].cardId).then(cdf => this.playerInfos[player.index].setHeld(new Card(localPlayer, cdf)));
			netSend("[grabToken]" + zone.cards[index].cardId);
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
			if (!card.isToken) {
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
		let insertedIndex = zone.add(card, index, false);
		if (card.zone === zone) {
			if (source) {
				gameUI.removeCard(source, sourceIndex);
			}
			if (insertedIndex != -1) {
				if (zone === game.players[0].handZone) {
					if (this.opponentHandShown) {
						card.showTo(localPlayer);
					} else {
						card.hideFrom(localPlayer);
					}
				}

				gameUI.insertCard(zone, insertedIndex);
			}
		}
		this.playerInfos[player.index].clearHeld();
	}

	hotkeyPressed(name) {
		switch(name) {
			case "searchDeck": {
				gameUI.toggleCardSelect(localPlayer.deckZone);
				return true;
			}
			case "selectToken": {
				gameUI.toggleCardSelect(this.tokenZone);
				return true;
			}
			case "destroyToken": {
				let heldCard = this.playerInfos[localPlayer.index].heldCard;
				if (heldCard && heldCard.isToken) {
					netSend("[uiDroppedCard]" + gameState.getZoneName(localPlayer.discardPile) + "|0");
					this.dropCard(localPlayer, localPlayer.discardPile, 0);
				}
				return true;
			}
			case "drawCard": {
				this.deckDraw(localPlayer);
				return true;
			}
			case "shuffleDeck": {
				this.deckShuffle(localPlayer.deckZone);
				return true;
			}
			case "showDeckTop": {
				this.deckShowTop(localPlayer, player.deckZone);
				return true;
			}
		}
		return false;
	}

	deckDraw(player) {
		if (player.deckZone.cards.length == 0) {
			return;
		}
		if (player === localPlayer) {
			netSend("[drawCard]");
		}
		let card = player.deckZone.cards[player.deckZone.cards.length - 1];
		let insertedIndex = player.handZone.add(card, player.handZone.cards.length, false);
		if (player == localPlayer || this.opponentHandShown) {
			card.showTo(localPlayer);
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
		netSend("[deckOrder]" + deckZone.player.index + "|" + order.join("|"));
		chat.putMessage(locale.game.notices[deckZone.player === localPlayer? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
	}
	deckToTop(player, deckZone) {
		if (player === localPlayer) {
			netSend("[deckToTop]" + deckZone.player.index);
		}
		this.dropCard(player, deckZone, deckZone.cards.length);
	}
	deckToBottom(player, deckZone) {
		if (player === localPlayer) {
			netSend("[deckToBottom]" + deckZone.player.index);
		}
		this.dropCard(player, deckZone, 0);
	}
	deckShuffleIn(player, deckZone) {
		this.dropCard(player, deckZone, 0);
		if (player === localPlayer) {
			netSend("[deckShuffleIn]" + deckZone.player.index);
			this.deckShuffle(deckZone);
		}
	}
	deckCancelDrop(player) {
		if (player === localPlayer) {
			netSend("[deckCancel]");
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
			netSend("[deckShowTop]" + deckZone.player.index);
		}
		let card = deckZone.cards[deckZone.cards.length - 1];
		let presentedZone = this.playerInfos[player.index].presentedZone;
		let insertedIndex = presentedZone.add(card, presentedZone.cards.length, false);
		if (player == localPlayer) {
			card.showTo(localPlayer);
		}
		gameUI.removeCard(deckZone, deckZone.cards.length);
		gameUI.insertCard(presentedZone, insertedIndex);
	}
	returnAllToDeck(zone) {
		if (zone.cards.length == 0) {
			return;
		}
		while (zone.cards.length > 0) {
			for (const player of game.players) {
				zone.cards[0].hideFrom(player);
			}
			zone.player.deckZone.add(zone.cards[0], 0, false);
			gameUI.removeCard(zone, 0);
			gameUI.insertCard(zone.player.deckZone, 0);
		}
		if (zone.player === localPlayer) {
			netSend("[returnAllToDeck]" + gameState.getZoneName(zone));
			this.deckShuffle(localPlayer.deckZone);
		}
	}

	async setLife(player, value) {
		value = Math.max(value, 0);
		if (value == player.life) {
			return;
		}
		player.life = value;
		if (player === localPlayer) {
			netSend("[life]" + localPlayer.life);
		}
		await gameUI.uiPlayers[player.index].life.set(value, false);
		if (value === 0) {
			const winner = player.next();
			winner.victoryConditions.push("lifeZero");
			gameUI.playerWon(winner);
			window.parent.postMessage({type: "playerWon", players: [winner.index]});
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
			netSend("[mana]" + localPlayer.mana);
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