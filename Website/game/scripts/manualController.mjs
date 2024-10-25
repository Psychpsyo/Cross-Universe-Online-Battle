// This module exports the manual controller, used for manually operated Cross Universe games.

import {InteractionController} from "./interactionController.mjs";
import localize from "../../scripts/locale.mjs";
import {Zone} from "../../rulesEngine/src/zones.mjs";
import {Card} from "../../rulesEngine/src/card.mjs";
import {netSend, parseNetZone} from "./netcode.mjs";
import * as gameUI from "./gameUI.mjs";
import * as manualUI from "./manualUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as localeExtensions from "../../scripts/localeExtensions.mjs";

class TokenZone {
	constructor() {
		this.type = "tokens";
		this.cards = [];
		this.localeInfo = localeExtensions.zoneExtension;

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
class PresentedZone extends Zone {
	constructor(player) {
		super(player, "presented");
	}

	get defaultHiddenFor() {
		return game.players.filter(p => p !== this.player);
	}

	add(card, index, clearValues) {
		const insertedIndex = super.add(card, index, clearValues);
		card.showTo(this.player);
		return insertedIndex;
	}
}

function addPartnerRevealButton() {
	gameUI.addCardButton(localPlayer.partnerZone, 0, localize("game.partnerSelect.revealPartner"), "revealPartner", function() {
		gameUI.clearCardButtons(localPlayer.partnerZone, 0, "revealPartner");
		localPlayer.partnerZone.cards[0].hiddenFor = [];
		gameUI.updateCard(localPlayer.partnerZone, 0);
		netSend("revealPartner");
	}, true);
}

export class ManualController extends InteractionController {
	constructor() {
		super();

		this.playerInfos = [];
		for (const player of game.players) {
			this.playerInfos.push(new ManualPlayerInfo(player));
		}

		manualUI.init();

		// only if there is an actual player do we need a token zone
		if (localPlayer) {
			this.tokenZone = new TokenZone();
			gameState.zones["tokens"] = this.tokenZone;
		}
	}

	async startGame(fromTheBeginning) {
		if (fromTheBeginning) {
			if (localPlayer) this.deckShuffle(localPlayer.deckZone);
			const startingPlayer = await game.randomPlayer();
			chat.putMessage(localize("game.notices.playerStarts", startingPlayer), "notice");
			if (localPlayer) addPartnerRevealButton();
		}
	}

	receiveMessage(command, message, player) {
		switch (command) {
			case "life": { // set player's life
				this.setLife(player, parseInt(message), false);
				return true;
			}
			case "mana": { // set player's mana
				this.setMana(player, parseInt(message));
				return true;
			}
			case "grabToken": {
				cardLoader.getManualCdf(message).then(cdf => this.playerInfos[player.index].setHeld(new Card(player, cdf)));
				return true;
			}
			case "drawCard": {
				this.deckDraw(player);
				return true;
			}
			case "deckToTop": { // opponent sent their held card to the top of a deck
				this.deckToTop(player, parseNetZone("deck" + message, player));
				return true;
			}
			case "deckToBottom": { // opponent sent their held card to the bottom of a deck
				this.deckToBottom(player, parseNetZone("deck" + message, player));
				return true;
			}
			case "deckShuffleIn": { // opponent shuffles their held card into a deck
				this.deckShuffleIn(player, parseNetZone("deck" + message, player));
				return true;
			}
			case "deckCancel": { // opponent cancelled dropping their held card into a deck
				this.deckCancelDrop(player);
				return true;
			}
			case "deckShowTop": { // opponent presented a card
				this.deckShowTop(player, parseNetZone("deck" + message, player));
				return true;
			}
			case "returnAllToDeck": {
				this.returnAllToDeck(parseNetZone(message, player));
				return true;
			}
			case "deckOrder": { // opponent shuffled a deck
				const deck = parseNetZone("deck" + message[0], player);
				message = message.substring(2);
				const order = message.split("|").map(i => parseInt(i));
				deck.cards.sort((a, b) => order.indexOf(deck.cards.indexOf(a)) - order.indexOf(deck.cards.indexOf(b)));
				deck.reindex();
				for (let i = 0; i < deck.cards.length; i++) {
					gameUI.updateCard(deck, i);
				}
				chat.putMessage(localize("game.notices.deckShuffled", deck), "notice");
				return true;
			}
			case "showHand": {
				document.getElementById("hand" + player.index).classList.add("shown");
				for (let i = 0; i < player.handZone.cards.length; i++) {
					player.handZone.cards[i].showTo(localPlayer);
					gameUI.updateCard(player.handZone, i);
				}
				return true;
			}
			case "hideHand": {
				document.getElementById("hand" + player.index).classList.remove("shown");
				for (let i = 0; i < player.handZone.cards.length; i++) {
					player.handZone.cards[i].hideFrom(localPlayer);
					gameUI.updateCard(player.handZone, i);
				}
				return true;
			}
			default: {
				return manualUI.receiveMessage(command, message, player);
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
			netSend("grabToken", zone.cards[index].cardId);
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
		const card = this.playerInfos[player.index].heldCard;
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

		const source = card.zone;
		const sourceIndex = card.index;
		const insertedIndex = zone.add(card, index, false);
		if (card.zone === zone) {
			if (source) {
				gameUI.removeCard(source, sourceIndex);
			}
			if (insertedIndex != -1) {
				if (zone === game.players[0].handZone) {
					if (document.getElementById("hand0").classList.contains("shown")) {
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
					netSend("uiDroppedCard", gameState.getZoneName(localPlayer.discardPile) + "|0");
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
			netSend("drawCard");
		}
		const card = player.deckZone.cards.at(-1);
		const insertedIndex = player.handZone.add(card, player.handZone.cards.length, false);
		if (player === localPlayer || document.getElementById("hand0").classList.contains("shown")) {
			card.showTo(localPlayer);
		}
		gameUI.removeCard(player.deckZone, player.deckZone.cards.length);
		gameUI.insertCard(player.handZone, insertedIndex);
	}
	deckShuffle(deckZone) {
		const order = [];
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
		netSend("deckOrder", deckZone.player.index + "|" + order.join("|"));
		chat.putMessage(localize("game.notices.deckShuffled", deckZone), "notice");
	}
	deckToTop(player, deckZone) {
		if (player === localPlayer) {
			netSend("deckToTop", deckZone.player.index);
		}
		this.dropCard(player, deckZone, deckZone.cards.length);
	}
	deckToBottom(player, deckZone) {
		if (player === localPlayer) {
			netSend("deckToBottom", deckZone.player.index);
		}
		this.dropCard(player, deckZone, 0);
	}
	deckShuffleIn(player, deckZone) {
		this.dropCard(player, deckZone, 0);
		if (player === localPlayer) {
			netSend("deckShuffleIn", deckZone.player.index);
			this.deckShuffle(deckZone);
		}
	}
	deckCancelDrop(player) {
		if (player === localPlayer) {
			netSend("deckCancel");
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
			netSend("deckShowTop", deckZone.player.index);
		}
		const card = deckZone.cards.at(-1);
		const presentedZone = this.playerInfos[player.index].presentedZone;
		const insertedIndex = presentedZone.add(card, presentedZone.cards.length, false);
		if (player === localPlayer) {
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
			netSend("returnAllToDeck", gameState.getZoneName(zone));
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
			netSend("life", localPlayer.life);
		}
		await gameUI.uiPlayers[player.index].life.set(value);
		if (value === 0) {
			const winner = player.next();
			winner.victoryConditions.push("lifeZero");
			callingWindow.postMessage({type: "playerWon", players: [winner.index]});
			await gameUI.playerWon(winner);
		}
	}
	setMana(player, value) {
		value = Math.max(value, 0);
		if (value == player.mana) {
			return;
		}
		player.mana = value;
		gameUI.uiPlayers[player.index].mana.set(value, 0);
		if (player === localPlayer) {
			netSend("mana", localPlayer.mana);
		}
	}

	syncToSpectator(spectator) {
		const manualState = {
			players: this.playerInfos.map(playerInfo => {return {
				index: playerInfo.player.index,
				life: playerInfo.player.life,
				mana: playerInfo.player.mana,
				heldCardZone: playerInfo.heldCard? gameState.getZoneName(playerInfo.heldCard.zone) : null,
				heldCardIndex: playerInfo.heldCard?.index
			}}),
			cards: this.getAllCards().map(card => {return {
				id: card.cardId,
				zone: gameState.getZoneName(card.zone),
				index: card.index,
				player: card.owner.index,
				hiddenFor: card.hiddenFor.map(player => player.index)
			}}),
			counters: Array.from(Array(20).keys()).map(i => {
				const counterHolder = document.getElementById(`field${i}`).parentElement.querySelector(".counterHolder");
				const counters = Array.from(counterHolder.querySelectorAll(".counter"));
				return counters.map(counter => parseInt(counter.innerHTML));
			})
		}
		spectator.send(`${localPlayer.index}[initManual]${JSON.stringify(manualState)}`);
	}

	getAllCards() {
		return game.getAllCards().concat(this.playerInfos.map(playerInfo => playerInfo.presentedZone.cards).flat());
	}
}

class ManualPlayerInfo {
	constructor(player) {
		this.player = player;
		this.heldCard = null;
		this.presentedZone = new PresentedZone(player);
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