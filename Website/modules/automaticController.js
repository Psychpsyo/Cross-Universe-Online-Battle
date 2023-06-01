// This module exports the controller for the automatic simulator which verifies the cross universe game rules

import {InteractionController} from "/modules/interactionController.js";
import {putChatMessage} from "/modules/generalUI.js";
import * as gameUI from "/modules/gameUI.js";
import * as autoUI from "/modules/automaticUI.js";

export class AutomaticController extends InteractionController {
	constructor() {
		super();
		
		autoUI.init();
	}
	
	async startGame() {
		let updateGenerator = game.begin();
		let updates = updateGenerator.next();
		
		while (updates.value.length != 0) {
			switch (updates.value[0].nature) {
				case "event": {
					await Promise.all(updates.value.map(event => this.handleEvent(event)));
					break;
				}
				case "action": {
					alert("Action: " + updates.value[0].type);
					break;
				}
			}
			updates = updateGenerator.next();
		}
	}
	
	receiveMessage(command, message) {
		return false;
	}
	
	grabCard(player, zone, index) {
		return false;
	}
	dropCard(player, zone, index) {}
	
	async handleEvent(event) {
		switch (event.type) {
			case "deckShuffled": {
				putChatMessage(event.playerIndex == localPlayer.index? locale.yourDeckShuffled : locale.opponentDeckShuffled, "notice");
				return this.gameSleep();
			}
			case "startingPlayerSelected": {
				putChatMessage(event.playerIndex == localPlayer.index? locale.youStart : locale.opponentStarts, "notice");
				return this.gameSleep();
			}
			case "cardsDrawn": {
				let player = game.players[event.playerIndex];
				for (let i = event.amount; i > 0; i--) {
					gameUI.removeCard(player.deckZone, player.deckZone.cards.length + i - 1);
					gameUI.insertCard(player.handZone, player.handZone.cards.length - i);
					await this.gameSleep(.5);
				}
				return this.gameSleep();
			}
			case "partnerRevealed": {
				gameUI.updateCard(game.players[event.playerIndex].partnerZone, 0);
				return this.gameSleep();
			}
		}
	}
	
	async gameSleep(duration = 1) {
		return new Promise(resolve => setTimeout(resolve, 500 * duration));
	}
}