// This module exports the controller for the automatic simulator which verifies the cross universe game rules

import {InteractionController} from "/modules/interactionController.js";
import {putChatMessage} from "/modules/generalUI.js";
import {socket} from "/modules/netcode.js";
import * as gameUI from "/modules/gameUI.js";
import * as autoUI from "/modules/automaticUI.js";

export class AutomaticController extends InteractionController {
	constructor() {
		super();
		
		autoUI.init();
		
		this.opponentEngineInputs = new EventTarget();
		this.opponentMoves = [];
		this.waitingForOpponentInput = false;
	}
	
	async startGame() {
		let updateGenerator = game.begin();
		let updates = updateGenerator.next();
		
		while (updates.value.length != 0) {
			let returnValues;
			switch (updates.value[0].nature) {
				case "event": {
					await Promise.all(updates.value.map(event => this.handleEvent(event)));
					break;
				}
				case "request": {
					let playerPromises = [];
					for (let i = 0; i < game.players.length; i++) {
						playerPromises.push([]);
					}
					for (let request of updates.value) {
						playerPromises[request.player.index].push(this.presentInputRequest(request));
					}
					let responsePromises = await Promise.allSettled(playerPromises.map(promises => Promise.any(promises)));
					this.waitingForOpponentInput = false;
					
					returnValues = responsePromises.map(promise => promise.value).filter(value => value !== undefined);
					break;
				}
			}
			updates = updateGenerator.next(returnValues);
		}
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "inputRequestResponse": {
				this.opponentMoves.push(JSON.parse(message));
				this.opponentEngineInputs.dispatchEvent(new CustomEvent("input"));
				return true;
			}
		}
		return false;
	}
	
	grabCard(player, zone, index) {
		return false;
	}
	dropCard(player, zone, index) {}
	
	async handleEvent(event) {
		switch (event.type) {
			case "deckShuffled": {
				putChatMessage(event.player == localPlayer? locale.game.yourDeckShuffled : locale.game.opponentDeckShuffled, "notice");
				return this.gameSleep();
			}
			case "startingPlayerSelected": {
				putChatMessage(event.player == localPlayer? locale.game.youStart : locale.game.opponentStarts, "notice");
				return this.gameSleep();
			}
			case "cardsDrawn": {
				for (let i = event.amount; i > 0; i--) {
					gameUI.removeCard(event.player.deckZone, event.player.deckZone.cards.length + i - 1);
					gameUI.insertCard(event.player.handZone, event.player.handZone.cards.length - i);
					await this.gameSleep(.5);
				}
				return this.gameSleep(.5);
			}
			case "partnerRevealed": {
				gameUI.updateCard(event.player.partnerZone, 0);
				return this.gameSleep();
			}
			case "turnStarted": {
				autoUI.startTurn();
				return this.gameSleep();
			}
			case "phaseStarted": {
				autoUI.startPhase(event.phaseType);
				return this.gameSleep();
			}
			case "manaChanged": {
				await gameUI.uiPlayers[event.player.index].mana.set(event.newValue, false);
				return this.gameSleep();
			}
			case "stackCreated": {
				putChatMessage("Opened stack #" + event.index, "notice");
				return;
			}
			default: {
				console.log(event.type);
				return this.gameSleep();
			}
		}
	}
	
	async presentInputRequest(request) {
		if (request.player != localPlayer) {
			// If this is directed at not the local player, we might need to wait for an opponent input.
			// Only the first input request is allowed to take this, all others can and must reject since the engine wants only one action per player per request.
			return new Promise((resolve, reject) => {
				if (this.waitingForOpponentInput) {
					reject("Already looking for an opponent input at this time.");
				}
				this.waitingForOpponentInput = true;
				if (this.opponentMoves.length > 0) {
					resolve(this.opponentMoves.shift());
				}
				this.opponentEngineInputs.addEventListener("input", function(e) {
					resolve(this.opponentMoves.shift());
				}.bind(this), {once: true});
			});
		}
		
		let response = {
			"type": request.type
		}
		switch (request.type) {
			case "chooseCards": {
				response.value = await gameUI.presentCardChoice(request.from, "Select Card(s)", validAmounts = request.validAmounts);
				break;
			}
			case "pass": {
				autoUI.indicatePass();
				await new Promise(resolve => {
					passBtn.addEventListener("click", function() {
						resolve();
					}, {once: true});
				});
				break;
			}
			case "doStandardDraw": {
				break;
			}
			case "enterBattlePhase": {
				response.value = await gameUI.askQuestion(locale.game.automatic.battlePhase.question, locale.game.automatic.battlePhase.enter, locale.game.automatic.battlePhase.skip);
				break;
			}
		}
		socket.send("[inputRequestResponse]" + JSON.stringify(response));
		return response;
	}
	async removeInputRequest(request) {
		switch (request.type) {
			
		}
	}
	
	async gameSleep(duration = 1) {
		return new Promise(resolve => setTimeout(resolve, 500 * duration));
	}
}