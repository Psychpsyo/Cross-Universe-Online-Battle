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
		
		this.automatic = automatic;
		
		// remove draft game section and deck drop zone since they are not needed anymore
		draftGameSetupMenu.remove();
		
		// show game area
		mainGameBlackout.textContent = "";
		mainGameArea.removeAttribute("hidden");
		
		// do partner select
		if (localPlayer.deck.suggestedPartner) {
			if (localStorage.getItem("partnerChoiceToggle") === "true") {
				partnerSelectQuestionText.textContent = locale.partnerSelect.useSuggestedQuestion;
				chooseSuggestedPartnerBtn.textContent = locale.partnerSelect.useSuggested;
				manualChoosePartnerBtn.textContent = locale.partnerSelect.selectManually;
				document.getElementById("partnerSelectQuestion").style.display = "block";
				
				document.getElementById("chooseSuggestedPartnerBtn").addEventListener("click", function() {
					document.getElementById("partnerSelectQuestion").remove();
					this.getPartnerFromDeck();
				}.bind(this));
				document.getElementById("manualChoosePartnerBtn").addEventListener("click", function() {
					document.getElementById("partnerSelectQuestion").remove();
					this.openPartnerSelect();
				}.bind(this));
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
	
	hotkeyPressed(name) {
		if (document.getElementById("mainGameBlackout")) {
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
		ui.presentCardChoice(localPlayer.deckZone.cards, locale.partnerSelect.popupTitle, card => card.cardTypes.get().includes("unit") && card.level.get() < 6).then(card => {
			for (let card of localPlayer.deckZone.cards) {
				card.hidden = true;
			}
			gameState.getPartnerFromDeck(card.location.cards.indexOf(card));
		});
	}
	// called after partner selection
	getPartnerFromDeck(partnerPosInDeck = -1) {
		mainGameBlackout.textContent = locale.partnerSelect.waitingForOpponent;
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
			mainGameBlackout.remove();
			this.controller.startGame();
		}
	}
}