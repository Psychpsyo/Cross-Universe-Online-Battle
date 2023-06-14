// This module exports the controller for the automatic simulator which verifies the cross universe game rules

import {locale} from "/modules/locale.js";
import {InteractionController} from "/modules/interactionController.js";
import {putChatMessage} from "/modules/generalUI.js";
import {socket} from "/modules/netcode.js";
import {DistRandom} from "/modules/distributedRandom.js";
import {getAutoResponse} from "/modules/autopass.js";
import * as gameUI from "/modules/gameUI.js";
import * as autoUI from "/modules/automaticUI.js";
import * as actions from "/rulesEngine/actions.js";
import * as blocks from "/rulesEngine/blocks.js";

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
		
		this.gameSpeed = 1;
		document.documentElement.style.setProperty("--game-speed", this.gameSpeed);
		
		this.standardSummonEventTarget = new EventTarget();
		this.deployEventTarget = new EventTarget();
		this.castEventTarget = new EventTarget();
		this.canDeclareToAttack = [];
		this.unitAttackButtons = [];
		this.declaredAttackers = [];
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
					let localRequests = [];
					let playerPromises = [];
					for (let i = 0; i < game.players.length; i++) {
						playerPromises.push([]);
					}
					for (let request of updates.value) {
						if (request.player === localPlayer) {
							localRequests.push(request);
						} else {
							playerPromises[request.player.index].push(this.presentInputRequest(request));
						}
					}

					let autoResponse = getAutoResponse(localRequests);
					if (autoResponse) {
						socket.send("[inputRequestResponse]" + JSON.stringify(autoResponse));
						playerPromises[localPlayer.index].push(new Promise(resolve => {resolve(autoResponse)}));
					} else {
						playerPromises[localPlayer.index] = localRequests.map(request => this.presentInputRequest(request));
					}

					let responsePromises = await Promise.allSettled(playerPromises.map(promises => Promise.any(promises)));
					
					returnValues = responsePromises.map(promise => promise.value).filter(value => value !== undefined);

					this.waitingForOpponentInput = false;
					for (let playerInfo of this.playerInfos) {
						playerInfo.canStandardSummon = false;
						playerInfo.canDeploy = false;
						playerInfo.canCast = false;
						playerInfo.canRetire = [];
					}
					for (let button of this.unitAttackButtons) {
						button.parentElement.classList.remove("visible");
						button.remove();
					}
					this.canDeclareToAttack = [];
					this.unitAttackButtons = [];
					this.declaredAttackers = [];
					attackBtn.disabled = true;
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
			case "cancelRetire": {
				this.cancelRetire(game.players[0]);
				return true;
			}
		}
		return false;
	}

	grabCard(player, zone, index) {
		retireOptions.classList.add("noClick");

		let card = zone.cards[index];
		let playerInfo = this.playerInfos[player.index];

		// for retires
		if (playerInfo.canRetire.includes(card) && !playerInfo.retiring.includes(card)) {
			playerInfo.setHeld(zone, index);
			return true;
		}
		if (playerInfo.retiring.length > 0) {
			return false;
		}

		// for summoning/casting/deploying
		if (zone === player.handZone && (
			(playerInfo.canStandardSummon && card.cardTypes.get().includes("unit")) ||
			(playerInfo.canDeploy && card.cardTypes.get().includes("item")) ||
			(playerInfo.canCast && card.cardTypes.get().includes("spell"))
		)) {
			playerInfo.setHeld(zone, index);
			return true;
		}

		return false;
	}
	dropCard(player, zone, index) {
		retireOptions.classList.remove("noClick");
		
		let card = this.playerInfos[player.index].heldCard;
		let playerInfo = this.playerInfos[player.index];
		playerInfo.clearHeld();
		
		// summoning
		if (playerInfo.canStandardSummon && card.zone == player.handZone && zone == player.unitZone && !player.unitZone.get(index) && card.cardTypes.get().includes("unit")) {
			if (player === localPlayer) {
				this.standardSummonEventTarget.dispatchEvent(new CustomEvent("summon", {detail: {handIndex: card.index, fieldIndex: index}}));
			}
			return;
		}
		// deploying
		if (playerInfo.canDeploy && card.zone == player.handZone && zone == player.spellItemZone && !player.spellItemZone.get(index) && card.cardTypes.get().includes("item")) {
			if (player === localPlayer) {
				this.deployEventTarget.dispatchEvent(new CustomEvent("deploy", {detail: {handIndex: card.index, fieldIndex: index}}));
			}
			return;
		}
		// casting
		if (playerInfo.canCast && card.zone == player.handZone && zone == player.spellItemZone && !player.spellItemZone.get(index) && card.cardTypes.get().includes("spell")) {
			if (player === localPlayer) {
				this.castEventTarget.dispatchEvent(new CustomEvent("cast", {detail: {handIndex: card.index, fieldIndex: index}}));
			}
			return;
		}

		// retiring
		if (playerInfo.canRetire.includes(card) && zone === player.discardPile) {
			playerInfo.retiring.push(card);
			if (player === localPlayer) {
				autoUI.indicateRetire(playerInfo.retiring.length);
			}
			return;
		}
		
		gameUI.clearDragSource(card.zone, card.index, player);
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
				autoUI.startPhase(event.phase.type);
				return this.gameSleep();
			}
			case "blockCreationAborted": {
				if (event.block instanceof blocks.StandardSummon ||
					event.block instanceof blocks.DeployItem ||
					event.block instanceof blocks.CastSpell
				) {
					gameUI.clearDragSource(event.block.card.zone, event.block.card.index, event.block.player);
					return;
				}
				return;
			}
			case "playerLost": {
				await autoUI.playerLost(event.player);
				return;
			}
			case "playerWon": {
				await autoUI.playerWon(event.player);
				return;
			}
			case "gameDrawn": {
				await autoUI.gameDrawn();
				return;
			}
			case "damageDealt": {
				if (event.amount == 0) {
					return;
				}
				await gameUI.uiPlayers[event.player.index].life.set(event.player.life, false);
				return this.gameSleep();
			}
			case "lifeChanged": {
				await gameUI.uiPlayers[event.player.index].life.set(event.player.life, false);
				return this.gameSleep();
			}
			case "manaChanged": {
				await gameUI.uiPlayers[event.player.index].mana.set(event.player.mana, false);
				return this.gameSleep();
			}
			case "cardPlaced": {
				gameUI.insertCard(event.toZone, event.toIndex);
				if (event.fromZone) {
					gameUI.removeCard(event.fromZone, event.fromIndex);
				}
				return this.gameSleep();
			}
			case "cardCast":
			case "cardDeployed":
			case "cardSummoned": {
				gameUI.insertCard(event.toZone, event.toIndex);
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
			case "actionCancelled": {
				// units that got excluded from retires
				if (event.action instanceof actions.Discard && event.action.timing?.block instanceof blocks.Retire) {
					gameUI.clearDragSource(
						event.action.card.zone,
						event.action.card.index,
						event.action.timing.block.player
					);
				}
				return;
			}
			case "cardsAttacked": {
				autoUI.setAttackTarget(event.target);
				return autoUI.attack(event.attackers);
			}
			case "blockCreated": {
				if (event.block instanceof blocks.AbilityActivation) {
					return autoUI.activate(event.block.card);
				}
				return;
			}
		}
	}

	async presentInputRequest(request) {
		switch (request.type) {
			case "doStandardSummon": {
				this.playerInfos[request.player.index].canStandardSummon = true;
				break;
			}
			case "deployItem": {
				this.playerInfos[request.player.index].canDeploy = true;
				break;
			}
			case "castSpell": {
				this.playerInfos[request.player.index].canCast = true;
				break;
			}
			case "doRetire": {
				this.playerInfos[request.player.index].canRetire = request.eligibleUnits;
				break;
			}
		}

		if (request.player != localPlayer) {
			// If this is not directed at the local player, we might need to wait for an opponent input.
			// Only the first input request is allowed to take this, all others can and must reject since the engine wants only one action per player per request.
			return new Promise((resolve, reject) => {
				if (this.waitingForOpponentInput) {
					reject("Already looking for an opponent input at this time.");
					return;
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
			type: request.type
		}
		switch (request.type) {
			case "chooseCards": {
				let title = locale.game.cardChoice.genericTitle;
				switch (request.reason) {
					case "handTooFull": {
						title = locale.game.cardChoice.handDiscard;
						break;
					}
					case "selectAttackTarget": {
						title = locale.game.cardChoice.attackTarget;
						break;
					}
				}
				response.value = await gameUI.presentCardChoice(request.from, title, undefined, request.validAmounts);
				break;
			}
			case "pass": {
				autoUI.indicatePass();
				let passed = await new Promise((resolve, reject) => {
					passBtn.addEventListener("click", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						passBtn.removeEventListener("click", resolve);
						autoUI.clearPass();
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
			case "deployItem": {
				let deployDetails = await new Promise((resolve, reject) => {
					this.deployEventTarget.addEventListener("deploy", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						this.deployEventTarget.removeEventListener("deploy", resolve);
						reject();
					}.bind(this), {once: true});
				}).then(
					(e) => {return e.detail},
					() => {return null}
				);
				if (deployDetails == null) {
					return;
				}
				response.value = deployDetails;
				break;
			}
			case "castSpell": {
				let castDetails = await new Promise((resolve, reject) => {
					this.castEventTarget.addEventListener("cast", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						this.castEventTarget.removeEventListener("cast", resolve);
						reject();
					}.bind(this), {once: true});
				}).then(
					(e) => {return e.detail},
					() => {return null}
				);
				if (castDetails == null) {
					return;
				}
				response.value = castDetails;
				break;
			}
			case "doAttackDeclaration": {
				this.canDeclareToAttack = request.eligibleUnits;

				for (let i = 0; i < request.eligibleUnits.length; i++) {
					this.unitAttackButtons.push(gameUI.addFieldButton(
						request.eligibleUnits[i].zone,
						request.eligibleUnits[i].index,
						locale.game.automatic.cardOptions.attack,
						"attackDeclaration",
						function() {
							this.toggleAttacker(i);
						}.bind(this)
					));
				}

				let didAttack = await new Promise((resolve, reject) => {
					attackBtn.addEventListener("click", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						attackBtn.disabled = true;
						attackBtn.removeEventListener("click", resolve);
						reject();
					}, {once: true});
				}).then(
					() => {return true},
					() => {return false}
				);

				if (!didAttack) {
					return;
				}
				response.value = this.declaredAttackers.map(card => this.canDeclareToAttack.indexOf(card));
				break;
			}
			case "doFight": {
				break;
			}
			case "doRetire": {
				let didRetire = await new Promise((resolve, reject) => {
					retireBtn.addEventListener("click", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						retireBtn.removeEventListener("retire", resolve);
						reject();
					}, {once: true});
				}).then(
					() => {return true},
					() => {return false}
				);
				if (!didRetire) {
					return;
				}
				response.value = this.playerInfos[localPlayer.index].retiring.map(card => this.playerInfos[localPlayer.index].canRetire.indexOf(card));
				this.playerInfos[localPlayer.index].retiring = [];
				break;
			}
			case "enterBattlePhase": {
				response.value = await gameUI.askQuestion(locale.game.automatic.battlePhase.question, locale.game.automatic.battlePhase.enter, locale.game.automatic.battlePhase.skip);
				break;
			}
			case "activateOptionalAbility": {
				let activated = await new Promise((resolve, reject) => {
					for (let i = 0; i < request.eligibleAbilities.length; i++) {
						gameUI.addFieldButton(
							request.eligibleAbilities[i].card.zone,
							request.eligibleAbilities[i].card.index,
							locale.game.automatic.cardOptions.activateMultiple.replace("{#ABILITY}", request.eligibleAbilities[i].index + 1),
							"activateOptional",
							function() {
								resolve(i);
							}
						)
					}
					this.madeMoveTarget.addEventListener("move", function() {
						for (let ability of request.eligibleAbilities) {
							gameUI.clearFieldButtons(ability.card.zone, ability.card.index, "activateOptional");
						}
						reject();
					}, {once: true});
				}).then(
					index => {return index},
					() => {return null}
				);
				if (activated === null) {
					return;
				}
				response.value = activated;
				break;
			}
			case "chooseZoneSlot": {
				// TODO: Let player choose one here.
				response.value = 0;
				break;
			}
		}
		this.madeMoveTarget.dispatchEvent(new CustomEvent("move"));
		socket.send("[inputRequestResponse]" + JSON.stringify(response));
		return response;
	}

	async gameSleep(duration = 1) {
		return new Promise(resolve => setTimeout(resolve, this.gameSpeed * 500 * duration));
	}

	cancelRetire(player) {
		if (player == localPlayer) {
			socket.send("[cancelRetire]");
		}
		for (let card of this.playerInfos[player.index].retiring) {
			gameUI.clearDragSource(card.zone, card.index, player);
		}
		this.playerInfos[player.index].retiring = [];
	}

	validateAttackButtons() {
		let declaredPartner = this.declaredAttackers.find(unit => unit.zone.type == "partner");
		if (declaredPartner) {
			for (let i = 0; i < this.canDeclareToAttack.length; i++) {
				if (!this.declaredAttackers.includes(this.canDeclareToAttack[i])) {
					this.unitAttackButtons[i].disabled = !this.canDeclareToAttack[i].sharesTypeWith(declaredPartner);
				}
			}
		} else {
			if (this.declaredAttackers.length == 1) {
				for (let button of this.unitAttackButtons) {
					button.disabled = true;
				}
				let partnerIndex = this.canDeclareToAttack.findIndex(unit => unit.zone.type == "partner");
				if (partnerIndex != -1) {
					this.unitAttackButtons[partnerIndex].disabled = !this.canDeclareToAttack[partnerIndex].sharesTypeWith(this.declaredAttackers[0]);
				}
				let declaredIndex = this.canDeclareToAttack.indexOf(this.declaredAttackers[0]);
				this.unitAttackButtons[declaredIndex].disabled = false;
			} else {
				this.declaredAttackers = [];
				for (let button of this.unitAttackButtons) {
					button.disabled = false;
				}
			}
		}
	}

	addAttacker(index) {
		this.declaredAttackers.push(this.canDeclareToAttack[index]);
		this.unitAttackButtons[index].classList.add("active");
		this.unitAttackButtons[index].parentElement.classList.add("visible");
		attackBtn.disabled = false;
	}
	removeAttacker(index) {
		this.declaredAttackers.splice(this.declaredAttackers.indexOf(this.canDeclareToAttack[index]), 1);
		this.unitAttackButtons[index].classList.remove("active");
		this.unitAttackButtons[index].parentElement.classList.remove("visible");
		attackBtn.disabled = this.declaredAttackers.length == 0;
	}
	toggleAttacker(index) {
		if (this.declaredAttackers.includes(this.canDeclareToAttack[index])) {
			this.removeAttacker(index);
		} else {
			this.addAttacker(index);
		}
		this.validateAttackButtons();
	}
}

class AutomaticPlayerInfo {
	constructor(player) {
		this.player = player;
		this.heldCard = null;
		this.canStandardSummon = false;
		this.canDeploy = false;
		this.canCast = false;
		this.canRetire = [];
		this.retiring = [];
	}

	setHeld(zone, index) {
		this.heldCard = zone.get(index);
		gameUI.uiPlayers[this.player.index].setDrag(this.heldCard);
		gameUI.makeDragSource(zone, index, this.player);
	}
	clearHeld() {
		this.heldCard = null;
		gameUI.uiPlayers[this.player.index].clearDrag();
	}
}