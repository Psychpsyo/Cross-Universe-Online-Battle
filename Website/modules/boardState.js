// This module exports the board state which is the main game state where the players actually play.

import {locale} from "/modules/locale.js";
import {GameState} from "/modules/gameState.js";
import {socket, zoneToLocal} from "/modules/netcode.js";
import {ManualController} from "/modules/manualController.js";
import {AutomaticController} from "/modules/automaticController.js";
import {putChatMessage, previewCard} from "/modules/generalUI.js";
import * as ui from "/modules/gameUI.js";

export class BoardState extends GameState {
	constructor(automatic) {
		super();
		gameState = this;
		
		this.automatic = automatic;
		this.zones = {};
		for (const player of game.players) {
			this.zones["deck" + player.index] = player.deckZone;
			this.zones["hand" + player.index] = player.handZone;
			this.zones["unit" + player.index] = player.unitZone;
			this.zones["spellItem" + player.index] = player.spellItemZone;
			this.zones["partner" + player.index] = player.partnerZone;
			this.zones["discard" + player.index] = player.discardPile;
			this.zones["exile" + player.index] = player.exileZone;
		}
		
		// remove draft game section and deck drop zone since they are not needed anymore
		draftGameSetupMenu.remove();
		
		// show game area
		mainGameBlackoutContent.textContent = "";
		mainGameArea.hidden = false;
		
		// do partner select
		if (localPlayer.deck.suggestedPartner) {
			if (localStorage.getItem("partnerChoiceToggle") === "true") {
				ui.askQuestion(locale.game.partnerSelect.useSuggestedQuestion, locale.game.partnerSelect.useSuggested, locale.game.partnerSelect.selectManually).then(result => {
					if (result) {
						this.getPartnerFromDeck();
					} else {
						this.openPartnerSelect();
					}
				});
			} else {
				this.getPartnerFromDeck();
			}
		} else {
			this.openPartnerSelect();
		}
		
		this.controller = automatic? new AutomaticController() : new ManualController();
	}
	receiveMessage(command, message) {
		switch (command) {
			case "choosePartner": { // opponent selected their partner
			let partnerPosInDeck = parseInt(message);
				game.players[0].partnerZone.add(game.players[0].deckZone.cards[partnerPosInDeck], 0);
				ui.removeCard(game.players[0].deckZone, partnerPosInDeck);
				ui.insertCard(game.players[0].partnerZone, 0);
				this.doStartGame();
				return true;
			}
			case "revealPartner": { // opponent revealed their partner
				game.players[0].partnerZone.cards[0].hidden = false;
				ui.updateCard(game.players[0].partnerZone, 0);
				return true;
			}
			default: {
				let done = ui.receiveMessage(command, message);
				if (!done) {
					done = this.controller.receiveMessage(command, message);
				}
				return done;
			}
		}
	}
	
	getZoneName(zone) {
		return Object.keys(gameState.zones).find(key => gameState.zones[key] === zone);
	}
	
	hotkeyPressed(name) {
		if (!mainGameBlackout.classList.contains("hidden")) {
			return;
		}
		switch(name) {
			case "showYourDiscard": {
				ui.toggleCardSelect(localPlayer.discardPile);
				break;
			}
			case "showOpponentDiscard": {
				ui.toggleCardSelect(game.players[0].discardPile);
				break;
			}
			case "showYourExile": {
				ui.toggleCardSelect(localPlayer.exileZone);
				break;
			}
			case "showOpponentExile": {
				ui.toggleCardSelect(game.players[0].exileZone);
				break;
			}
			case "showField": {
				ui.closeCardSelect();
				closeCardPreview();
				break;
			}
			default: {
				this.controller.hotkeyPressed(name);
			}
		}
	}
	
	openPartnerSelect() {
		for (let card of localPlayer.deckZone.cards) {
			card.hidden = false;
		}
		ui.presentCardChoice(localPlayer.deckZone.cards, locale.game.partnerSelect.popupTitle, card => card.cardTypes.get().includes("unit") && card.level.get() < 6).then(cards => {
			for (let card of localPlayer.deckZone.cards) {
				card.hidden = true;
			}
			gameState.getPartnerFromDeck(cards[0]);
		});
	}
	// called after partner selection
	getPartnerFromDeck(partnerPosInDeck = -1) {
		mainGameBlackoutContent.textContent = locale.game.partnerSelect.waitingForOpponent;
		if (partnerPosInDeck == -1) {
			partnerPosInDeck = localPlayer.deckZone.cards.findIndex(card => {return card.cardId == game.players[localPlayer.index].deck["suggestedPartner"]});
		}
		localPlayer.partnerZone.add(localPlayer.deckZone.cards[partnerPosInDeck], 0);
		ui.removeCard(localPlayer.deckZone, partnerPosInDeck);
		ui.insertCard(localPlayer.partnerZone, 0);
		
		socket.send("[choosePartner]" + partnerPosInDeck);
		
		this.doStartGame();
	}
	
	doStartGame() {
		if (game.players[0].partnerZone.cards[0] && game.players[1].partnerZone.cards[0]) {
			mainGameBlackout.classList.add("hidden");
			this.controller.startGame();
		}
	}
}