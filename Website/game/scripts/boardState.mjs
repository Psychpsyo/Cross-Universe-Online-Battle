// This module exports the board state which is the main game state where the players actually play.

import {locale} from "../../scripts/locale.mjs";
import {GameState} from "./gameState.mjs";
import {netSend, spectators} from "./netcode.mjs";
import {ManualController} from "./manualController.mjs";
import {AutomaticController} from "./automaticController.mjs";
import * as ui from "./gameUI.mjs";
import * as generalUI from "./generalUI.mjs";

export class BoardState extends GameState {
	constructor(automatic) {
		super();

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
		blackoutMainMessage.textContent = "";
		blackoutSubtitle.textContent = "";
		mainGameArea.hidden = false;

		this.controller = automatic? new AutomaticController() : new ManualController();

		if (localPlayer) {
			this.givePartnerChoice();
		}

		// Any AI-controlled players just pick the deck's assigned partner
		for (const player of game.players) {
			if (!player.aiSystem) continue;
			const aiPartnerPosInDeck = player.deckZone.cards.findIndex(card => {return card.cardId === playerData[player.index].deck.suggestedPartner});
			gameState.setPartner(player, aiPartnerPosInDeck);
		}
	}

	receiveMessage(command, message, player) {
		switch (command) {
			case "choosePartner": { // opponent selected their partner
				let partnerPosInDeck = parseInt(message);
				this.setPartner(player, partnerPosInDeck);
				return true;
			}
			case "revealPartner": { // opponent revealed their partner
				player.partnerZone.cards[0].hiddenFor = [];
				ui.updateCard(player.partnerZone, 0);
				return true;
			}
			default: {
				let done = ui.receiveMessage(command, message, player);
				if (!done) {
					done = this.controller.receiveMessage(command, message, player);
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
				return true;
			}
			case "showOpponentDiscard": {
				ui.toggleCardSelect(game.players[0].discardPile);
				return true;
			}
			case "showYourExile": {
				ui.toggleCardSelect(localPlayer.exileZone);
				return true;
			}
			case "showOpponentExile": {
				ui.toggleCardSelect(game.players[0].exileZone);
				return true;
			}
			case "showDeck": {
				if (deckSelector.open) {
					generalUI.closeDeckView();
				} else {
					generalUI.loadDeckPreview(playerData[1].deck);
					generalUI.openDeckView();
				}
				return true;
			}
			case "showField": {
				ui.closeCardSelect();
				generalUI.closeCardPreview();
				return true;
			}
			case "zoom": {
				if (mainGameArea.matches(":hover")) {
					mainGameArea.classList.add("zoomedIn");
					return true;
				}
				return false;
			}
			default: {
				return this.controller.hotkeyPressed(name);
			}
		}
	}

	hotkeyReleased(name) {
		if (!mainGameBlackout.classList.contains("hidden")) {
			return;
		}
		switch(name) {
			case "zoom": {
				mainGameArea.classList.remove("zoomedIn");
				return mainGameArea.matches(":hover");
			}
			default: {
				return this.controller.hotkeyReleased(name);
			}
		}
	}

	syncToSpectator(spectator) {
		this.controller.syncToSpectator(spectator);
	}

	givePartnerChoice() {
		// Do we already have a partner? (happens when replays are loaded)
		if (localPlayer.partnerZone.cards[0]) return;

		if (playerData[localPlayer.index].deck.suggestedPartner) {
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
	}
	setPartner(player, partnerPosInDeck) {
		player.setPartner(partnerPosInDeck);
		ui.removeCard(player.deckZone, partnerPosInDeck);
		ui.insertCard(player.partnerZone, 0);
		this.doStartGame();
	}
	openPartnerSelect() {
		for (let card of localPlayer.deckZone.cards) {
			card.showTo(localPlayer);
		}
		ui.presentCardChoice(
			localPlayer.deckZone.cards,
			locale.game.partnerSelect.popupTitle,
			card => card.values.current.cardTypes.includes("unit") && card.values.current.level < 6).then(cards => {
				for (let card of localPlayer.deckZone.cards) {
					card.hideFrom(localPlayer);
				}
				gameState.getPartnerFromDeck(cards[0]);
			}
		);
	}
	// called after partner selection
	getPartnerFromDeck(partnerPosInDeck = -1) {
		ui.showBlackoutMessage(locale.game.partnerSelect.waitingForOpponent);
		if (partnerPosInDeck === -1) {
			partnerPosInDeck = localPlayer.deckZone.cards.findIndex(card => {return card.cardId == playerData[localPlayer.index].deck.suggestedPartner});
		}
		netSend("choosePartner", partnerPosInDeck);
		this.setPartner(localPlayer, partnerPosInDeck);
	}

	doStartGame(fromTheBeginning = true) {
		if (game.players[0].partnerZone.cards[0] && game.players[1].partnerZone.cards[0]) {
			mainGameBlackout.classList.add("hidden");
			for (const spectator of spectators) {
				this.syncToSpectator(spectator);
			}
			this.controller.startGame(fromTheBeginning);
		}
	}
}