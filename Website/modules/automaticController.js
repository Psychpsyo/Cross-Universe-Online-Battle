// This module exports the controller for the automatic simulator which verifies the cross universe game rules

import {locale} from "/modules/locale.js";
import {InteractionController} from "/modules/interactionController.js";
import {putChatMessage} from "/modules/generalUI.js";
import {socket} from "/modules/netcode.js";
import {DistRandom} from "/modules/distributedRandom.js";
import * as gameUI from "/modules/gameUI.js";
import * as autoUI from "/modules/automaticUI.js";

export class AutomaticController extends InteractionController {
	constructor() {
		super();
		
		autoUI.init();
		game.rng = new DistRandom();
		
		
		this.opponentMoveEventTarget = new EventTarget();
		this.opponentMoves = [];
		this.waitingForOpponentInput = false;
		this.playerInfos = [];
		for (const player of game.players) {
			this.playerInfos.push(new AutomaticPlayerInfo(player));
		}
		this.madeMoveTarget = new EventTarget();
		
		this.gameSpeed = 500;
		
		this.canStandardSummon = false;
		this.standardSummonEventTarget = new EventTarget();
		this.canRetire = false;
		this.retireEventTarget = new EventTarget();
	}
	
	async startGame() {
		let updateGenerator = game.begin();
		let updates = await updateGenerator.next();
		
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
					
					this.canStandardSummon = false;
					this.canRetire = false;
					break;
				}
			}
			updates = await updateGenerator.next(returnValues);
		}
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "inputRequestResponse": {
				this.opponentMoves.push(JSON.parse(message));
				this.opponentMoveEventTarget.dispatchEvent(new CustomEvent("input"));
				return true;
			}
			case "distRandValue": {
				game.rng.importCyphertext(message);
				return true;
			}
			case "distRandKey": {
				game.rng.importCypherKey(message);
				return true;
			}
		}
		return false;
	}
	
	grabCard(player, zone, index) {
		if (this.canStandardSummon && zone === player.handZone && zone.cards[index].cardTypes.get().includes("unit")) {
			this.playerInfos[player.index].setHeld(zone.cards[index]);
			gameUI.makeDragSource(zone, index, player);
			return true;
		}
		return false;
	}
	dropCard(player, zone, index) {
		let card = this.playerInfos[player.index].heldCard;
		this.playerInfos[player.index].clearHeld();
		
		let source = card.location;
		let sourceIndex = source? source.cards.indexOf(card) : -1;
		if (source) {
			gameUI.clearDragSource(source, sourceIndex, player);
		}
		
		if (this.canStandardSummon && source == player.handZone && zone == player.unitZone && !player.unitZone.get(index) && card.cardTypes.get().includes("unit")) {
			this.standardSummonEventTarget.dispatchEvent(new CustomEvent("summon", {detail: {handIndex: sourceIndex, fieldIndex: index}}));
			
			return;
		}
	}
	
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
			case "cardPlaced": {
				gameUI.insertCard(event.toZone, event.toIndex);
				gameUI.removeCard(event.player.handZone, event.fromIndex);
				return this.gameSleep();
			}
			case "cardSummoned": {
				gameUI.insertCard(event.player.unitZone, event.toIndex);
				if (event.fromZone) {
					gameUI.removeCard(event.fromZone, event.fromIndex);
				}
				return this.gameSleep();
			}
			case "cardDiscarded": {
				gameUI.removeCard(event.fromZone, event.fromIndex);
				gameUI.insertCard(event.toZone, event.toZone.cards.length - 1);
				return this.gameSleep(.5);
			}
			case "cardDestroyed": {
				gameUI.removeCard(event.fromZone, event.fromIndex);
				gameUI.insertCard(event.toZone, event.toZone.cards.length - 1);
				return this.gameSleep(.5);
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
					return;
				}
				this.opponentMoveEventTarget.addEventListener("input", function() {
					resolve(this.opponentMoves.shift());
				}.bind(this), {once: true});
			});
		}
		
		let response = {
			"type": request.type
		}
		switch (request.type) {
			case "chooseCards": {
				response.value = await gameUI.presentCardChoice(request.from, "Select Card(s)", undefined, request.validAmounts);
				break;
			}
			case "pass": {
				autoUI.indicatePass();
				let passed = await new Promise((resolve, reject) => {
					passBtn.addEventListener("click", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						passBtn.removeEventListener("click", resolve);
						autoUI.removePass();
						reject();
					}, {once: true});
				}).then(
					() => {return true},
					() => {return false}
				);
				if (!passed) {
					return;
				}
				break;
			}
			case "doStandardDraw": {
				break;
			}
			case "doStandardSummon": {
				this.canStandardSummon = true;
				let summonDetails = await new Promise((resolve, reject) => {
					this.standardSummonEventTarget.addEventListener("summon", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						this.standardSummonEventTarget.removeEventListener("summon", resolve);
						reject();
					}.bind(this), {once: true});
				}).then(
					(e) => {return e.detail},
					() => {return null}
				);
				if (summonDetails == null) {
					return;
				}
				response.value = summonDetails;
				break;
			}
			case "enterBattlePhase": {
				response.value = await gameUI.askQuestion(locale.game.automatic.battlePhase.question, locale.game.automatic.battlePhase.enter, locale.game.automatic.battlePhase.skip);
				break;
			}
		}
		this.madeMoveTarget.dispatchEvent(new CustomEvent("move"));
		socket.send("[inputRequestResponse]" + JSON.stringify(response));
		return response;
	}
	async removeInputRequest(request) {
		switch (request.type) {
			
		}
	}
	
	async gameSleep(duration = 1) {
		return new Promise(resolve => setTimeout(resolve, this.gameSpeed * duration));
	}
}

class AutomaticPlayerInfo {
	constructor(player) {
		this.player = player;
		this.heldCard = null;
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