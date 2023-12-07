// This module exports the controller for the automatic simulator which verifies the cross universe game rules

import {locale} from "/modules/locale.js";
import {InteractionController} from "/modules/interactionController.js";
import {socket} from "/modules/netcode.js";
import {getAutoResponse} from "/modules/autopass.js";
import {BaseCard} from "/rulesEngine/card.js";
import {Player} from "/rulesEngine/player.js";
import * as gameUI from "/modules/gameUI.js";
import * as autoUI from "/modules/automaticUI.js";
import * as generalUI from "/modules/generalUI.js";
import * as actions from "/rulesEngine/actions.js";
import * as blocks from "/rulesEngine/blocks.js";
import * as cardLoader from "/modules/cardLoader.js";
import * as zones from "/rulesEngine/zones.js";

export class AutomaticController extends InteractionController {
	constructor() {
		super();

		autoUI.init();

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
		this.fieldPlaceIndex = null;
	}

	async startGame() {
		let updateGenerator = game.begin();
		let updates = await updateGenerator.next();

		while (!updates.done) {
			let returnValue;
			switch (updates.value[0].nature) {
				case "event": {
					let groupedEvents = Object.groupBy(updates.value, event => event.type);
					await Promise.all(Object.entries(groupedEvents).map(keyValue => this.handleEvents(keyValue[0], keyValue[1])));
					break;
				}
				case "request": {
					// This code is way more general than it needs to be since there is never cases where both players need to act at the same time.
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

					returnValue = responsePromises.map(promise => promise.value).filter(value => value !== undefined)[0];

					autoUI.clearYourMove();
					autoUI.clearOpponentAction();
					this.waitingForOpponentInput = false;
					for (let playerInfo of this.playerInfos) {
						playerInfo.canStandardSummon = [];
						playerInfo.canDeploy = [];
						playerInfo.canCast = [];
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
			updates = await updateGenerator.next(returnValue);
		}
	}

	receiveMessage(command, message) {
		switch (command) {
			case "inputRequestResponse": {
				let move = JSON.parse(message);
				if (move.type == "choosePlayer") {
					move.value = game.players[move.value].next().index;
					generalUI.putChatMessage(game.players[move.value] == localPlayer? locale.game.notices.opponentChoseYou : locale.game.notices.opponentChoseSelf, "notice");
				}
				this.opponentMoves.push(move);
				this.opponentMoveEventTarget.dispatchEvent(new CustomEvent("input"));
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
		if (!zone.cards[index] || this.playerInfos[player.index].heldCard !== null) {
			return false;
		}
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
			(playerInfo.canStandardSummon.includes(card)) ||
			(playerInfo.canDeploy.includes(card)) ||
			(playerInfo.canCast.includes(card))
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
		if (playerInfo.canStandardSummon.includes(card) && zone == player.unitZone && !player.unitZone.get(index)) {
			if (player === localPlayer) {
				this.fieldPlaceIndex = index;
				this.standardSummonEventTarget.dispatchEvent(new CustomEvent("summon", {detail: card.index}));
			}
			gameUI.makeDragSource(player.unitZone, index, player);
			return;
		}
		// deploying
		if (playerInfo.canDeploy.includes(card) && zone == player.spellItemZone && !player.spellItemZone.get(index)) {
			if (player === localPlayer) {
				this.fieldPlaceIndex = index;
				this.deployEventTarget.dispatchEvent(new CustomEvent("deploy", {detail: card.index}));
			}
			gameUI.makeDragSource(player.spellItemZone, index, player);
			return;
		}
		// casting
		if (playerInfo.canCast.includes(card) && zone == player.spellItemZone && !player.spellItemZone.get(index)) {
			if (player === localPlayer) {
				this.fieldPlaceIndex = index;
				this.castEventTarget.dispatchEvent(new CustomEvent("cast", {detail: card.index}));
			}
			gameUI.makeDragSource(player.spellItemZone, index, player);
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

	async handleEvents(type, events) {
		switch (type) {
			case "deckShuffled": {
				for (const event of events) {
					generalUI.putChatMessage(event.player == localPlayer? locale.game.notices.yourDeckShuffled : locale.game.notices.opponentDeckShuffled, "notice");
				}
				return this.gameSleep();
			}
			case "startingPlayerSelected": {
				generalUI.putChatMessage(events[0].player == localPlayer? locale.game.notices.youStart : locale.game.notices.opponentStarts, "notice");
				return this.gameSleep();
			}
			case "cardsDrawn": {
				for (const [playerIndex, cards] of Object.entries(Object.groupBy(events.map(event => event.cards).flat(), card => card.owner.index))) {
					generalUI.putChatMessage(locale.game.notices[playerIndex == localPlayer.index? "youDrew" : "opponentDrew"], "notice", cards);
				}
				await Promise.all(events.map(async event => {
					for (let i = event.cards.length; i > 0; i--) {
						gameUI.removeCard(event.player.deckZone, event.player.deckZone.cards.length + i - 1);
						gameUI.insertCard(event.player.handZone, event.player.handZone.cards.length - i);
						await this.gameSleep(.25);
					}
				}));
				return this.gameSleep(.25);
			}
			case "partnerRevealed": {
				for (const event of events) {
					gameUI.updateCard(event.player.partnerZone, 0);
					autoUI.addCardAttackDefenseOverlay(event.player.partnerZone.cards[0]);
				}
				return this.gameSleep();
			}
			case "cardRevealed": {
				for (const [playerIndex, events] of Object.entries(Object.groupBy(events, event => event.player.index))) {
					generalUI.putChatMessage(locale.game.notices[playerIndex == localPlayer.index? "youRevealed" : "opponentRevealed"], "notice", events.map(event => event.card));
				}
				await Promise.all(events.map(async event => {
					switch (event.card.zone.type) {
						case "hand": {
							return autoUI.revealHandCard(event.card);
						}
					}
				}));
				return this.gameSleep(events.length / 2);
			}
			case "cardViewed": {
				let localPlayerViewed = events.filter(event => event.player === localPlayer);
				if (localPlayerViewed.length > 0) {
					generalUI.putChatMessage(locale.game.notices.viewed, "notice", localPlayerViewed.map(event => event.card));
				}
				await Promise.all(events.map(async event => {
					switch (event.card.zone.type) {
						case "hand": {
							return autoUI.revealHandCard(event.card);
						}
					}
				}));
				return this.gameSleep(events.length / 2);
			}
			case "turnStarted": {
				autoUI.startTurn();
				return this.gameSleep();
			}
			case "phaseStarted": {
				autoUI.startPhase(events[0].phase.types[0]);
				return this.gameSleep();
			}
			case "blockCreationAborted": {
				if (events[0].block instanceof blocks.StandardSummon ||
					events[0].block instanceof blocks.DeployItem ||
					events[0].block instanceof blocks.CastSpell
				) {
					gameUI.clearDragSource(events[0].block.card.zone, events[0].block.card.index, events[0].block.player);
					return;
				}
				return;
			}
			case "playerWon": {
				await autoUI.playerWon(events[0].player);
				return;
			}
			case "gameDrawn": {
				await autoUI.gameDrawn();
				return;
			}
			case "damageDealt": {
				for (const event of events) {
					if (event.amount == 0) {
						return;
					}
					await gameUI.uiPlayers[event.player.index].life.set(event.player.life, false);
				}
				return this.gameSleep();
			}
			case "lifeChanged": {
				for (const event of events) {
					await gameUI.uiPlayers[event.player.index].life.set(event.player.life, false);
				}
				return this.gameSleep();
			}
			case "manaChanged": {
				for (const event of events) {
					await gameUI.uiPlayers[event.player.index].mana.set(event.player.mana, false);
				}
				return this.gameSleep();
			}
			case "valueChanged": {
				const changeAnimPromises = [];
				const objects = [];
				for (const event of events) {
					if (event.object instanceof BaseCard) {
						generalUI.updateCardPreview(event.object);
						if (["attack", "defense"].includes(event.valueName) && !objects.includes(event.object)) {
							changeAnimPromises.push(autoUI.updateCardAttackDefenseOverlay(event.card, false));
							objects.push(event.object);
						}
					} else if (event.object instanceof Player) {
						if (event.valueName === "canEnterBattlePhase") {
							autoUI.updateBattlePhaseIndicator();
						}
					}
				}
				return await Promise.all(changeAnimPromises);
			}
			case "cardPlaced": {
				for (const event of events) {
					gameUI.insertCard(event.toZone, event.toIndex);
					if (event.card.zone) {
						gameUI.removeCard(event.card.zone, event.card.index);
					}
				}
				return this.gameSleep();
			}
			case "cardCast":
			case "cardDeployed":
			case "cardSummoned": {
				for (const [playerIndex, eventList] of Object.entries(Object.groupBy(events, event => event.player.index))) {
					generalUI.putChatMessage(locale.game.notices[(playerIndex == localPlayer.index? "you" : "opponent") + type.substring(4)], "notice", eventList.map(event => event.card));
				}
				for (const event of events) {
					gameUI.insertCard(event.toZone, event.toIndex);
					gameUI.clearDragSource(event.toZone, event.toIndex, event.player);
					if (event.card.zone) {
						gameUI.removeCard(event.card.zone, event.card.index);
					}
					autoUI.removeCardAttackDefenseOverlay(event.card);
					autoUI.addCardAttackDefenseOverlay(event.card.current());
				}
				return this.gameSleep();
			}
			case "cardDiscarded":
			case "cardExiled":
			case "cardReturned":
			case "cardMoved": {
				generalUI.putChatMessage(locale.game.notices[type[4].toLowerCase() + type.substring(5)], "notice", events.map(event => event.card));
				for (const event of events) {
					gameUI.removeCard(event.card.zone, event.card.index);
					autoUI.removeCardAttackDefenseOverlay(event.card);
					if (!event.card.isToken || event.toZone instanceof zones.FieldZone) {
						gameUI.insertCard(event.toZone, event.toIndex);
					}
				}
				return this.gameSleep(.25);
			}
			case "undoCardsMoved": {
				for (const event of events) {
					for (let card of event.movedCards) {
						gameUI.removeCard(card.fromZone, card.fromIndex);
						if (card.toZone) {
							gameUI.insertCard(card.toZone, card.toIndex);
						}
					}
				}
				return;
			}
			case "cardsSwapped":
			case "undoCardsSwapped": {
				for (const event of events) {
					gameUI.updateCard(event.cardA.zone, event.cardA.index);
					gameUI.updateCard(event.cardB.zone, event.cardB.index);
					await Promise.all([
						autoUI.updateCardAttackDefenseOverlay(event.cardA, true),
						autoUI.updateCardAttackDefenseOverlay(event.cardB, true)
					]);
				}
				return;
			}
			case "actionCancelled": {
				for (const event of events) {
					// units that got excluded from retires
					if (event.action instanceof actions.Discard && event.action.timing?.block instanceof blocks.Retire) {
						gameUI.clearDragSource(
							event.action.card.zone,
							event.action.card.index,
							event.action.timing.block.player
						);
					}
				}
				return;
			}
			case "attackDeclarationEstablished": {
				return autoUI.showCoolAttackAnim(events[0].target, events[0].attackers);
			}
			case "cardsAttacked": {
				autoUI.setAttackTarget(events[0].target);
				return autoUI.attack(events[0].attackers);
			}
			case "blockCreated": {
				if (events[0].block instanceof blocks.AbilityActivation) {
					await autoUI.activate(events[0].block.card);
				}
				autoUI.newBlock(events[0].block);
				return;
			}
			case "stackCreated": {
				autoUI.newStack(events[0].stack.index);
				return;
			}
			case "playerSelected": {
				if (events[0].player !== localPlayer) {
					generalUI.putChatMessage(game.players[events[0].chosenPlayer] == localPlayer? locale.game.notices.opponentChoseYou : locale.game.notices.opponentChoseSelf, "notice");
				}
				break;
			}
			case "typeSelected": {
				if (events[0].player !== localPlayer) {
					generalUI.putChatMessage(locale.game.notices.opponentChoseType.replaceAll("{#TYPE}", locale.types[events[0].chosenType]), "notice");
				}
				break;
			}
			case "deckSideSelected": {
				if (events[0].player !== localPlayer) {
					generalUI.putChatMessage(locale.game.notices.opponentChoseDeckSide[events[0].chosenSide], "notice");
				}
				break;
			}
		}
	}

	async presentInputRequest(request) {
		switch (request.type) {
			case "doStandardSummon": {
				this.playerInfos[request.player.index].canStandardSummon = request.eligibleUnits;
				break;
			}
			case "deployItem": {
				this.playerInfos[request.player.index].canDeploy = request.eligibleItems;
				break;
			}
			case "castSpell": {
				this.playerInfos[request.player.index].canCast = request.eligibleSpells;
				break;
			}
			case "doRetire": {
				this.playerInfos[request.player.index].canRetire = request.eligibleUnits;
				break;
			}
		}

		if (request.player != localPlayer) {
			// show opponent action indicator
			switch (request.type) {
				case "chooseCards": {
					let message = locale.game.automatic.opponentActions.selectingCards;
					switch (request.reason) {
						case "handTooFull": {
							message = locale.game.automatic.opponentActions.selectingHandDiscard;
							break;
						}
						case "selectAttackTarget": {
							message = locale.game.automatic.opponentActions.selectingAttackTarget;
							break;
						}
						default: {
							if (request.reason.startsWith("cardEffect:")) {
								message = locale.game.automatic.opponentActions.effectSelectingCards.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
							} else if (request.reason.startsWith("equipTarget:")) {
								message = locale.game.automatic.opponentActions.selectingEquipTarget.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
							} else if (request.reason.startsWith("cardEffectMove:")) {
								message = locale.game.automatic.opponentActions.effectMoveSelectingCards.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
							}
						}
					}
					autoUI.showOpponentAction(message);
					break;
				}
				case "choosePlayer": {
					let message = locale.game.automatic.opponentActions.selectingPlayer;
					if (request.reason == "chooseStartingPlayer") {
						message = locale.game.automatic.opponentActions.selectingStartingPlayer;
					} else if (request.reason.startsWith("cardEffect:")) {
						message = locale.game.automatic.opponentActions.effectSelectingPlayer.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
					}
					autoUI.showOpponentAction(message);
					break;
				}
				case "chooseType": {
					autoUI.showOpponentAction(locale.game.automatic.opponentActions.selectingType.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name));
					break;
				}
				case "chooseDeckSide": {
					autoUI.showOpponentAction(locale.game.automatic.opponentActions.selectingDeckSide.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name));
					break;
				}
			}

			// If this is not directed at the local player, we might need to wait for an opponent input.
			// 'Might' because only the first input request is allowed to take this, all others can and
			// must reject since the engine wants only one action per player per request.
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
		} else {
			if (["pass", "doStandardSummon", "deployItem", "castSpell", "doStandardDraw", "doAttackDeclaration",
				"doFight", "doRetire", "activateTriggerAbility", "activateOptionalAbility", "activateFastAbility"].includes(request.type)
			) {
				autoUI.indicateYourMove();
			}
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
					default: {
						if (request.reason.startsWith("cardEffect:")) {
							title = locale.game.cardChoice.cardEffect.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
						} else if (request.reason.startsWith("equipTarget:")) {
							title = locale.game.cardChoice.equipTarget.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
						} else if (request.reason.startsWith("cardEffectMove:")) {
							title = locale.game.cardChoice.cardEffectMove.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
						}
					}
				}
				response.value = await gameUI.presentCardChoice(request.from, title, undefined, request.validAmounts);
				break;
			}
			case "choosePlayer": {
				let question = locale.game.automatic.playerSelect.question;
				if (request.reason == "chooseStartingPlayer") {
					question = locale.game.automatic.playerSelect.startingPlayerQuestion;
				} else if (request.reason.startsWith("cardEffect:")) {
					question = locale.game.automatic.playerSelect.cardEffectQuestion.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name);
				}
				response.value = (await gameUI.askQuestion(question, locale.game.automatic.playerSelect.you, locale.game.automatic.playerSelect.opponent))? 1 : 0;
				break;
			}
			case "chooseType": {
				response.value = await autoUI.promptTypeSelection(locale.game.automatic.typeSelect.prompt.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name), request.from);
				break;
			}
			case "chooseDeckSide": {
				response.value = (await gameUI.askQuestion(locale.game.automatic.deckSideSelect.prompt.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name), locale.game.automatic.deckSideSelect.top, locale.game.automatic.deckSideSelect.bottom))? "top" : "bottom";
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
				let handIndex = await new Promise((resolve, reject) => {
					this.standardSummonEventTarget.addEventListener("summon", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						this.standardSummonEventTarget.removeEventListener("summon", resolve);
						reject();
					}.bind(this), {once: true});
				}).then(
					(e) => {return e.detail},
					() => {return null}
				);
				if (handIndex === null) {
					return;
				}
				response.value = handIndex;
				break;
			}
			case "deployItem": {
				let handIndex = await new Promise((resolve, reject) => {
					this.deployEventTarget.addEventListener("deploy", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						this.deployEventTarget.removeEventListener("deploy", resolve);
						reject();
					}.bind(this), {once: true});
				}).then(
					(e) => {return e.detail},
					() => {return null}
				);
				if (handIndex === null) {
					return;
				}
				response.value = handIndex;
				break;
			}
			case "castSpell": {
				let handIndex = await new Promise((resolve, reject) => {
					this.castEventTarget.addEventListener("cast", resolve, {once: true});
					this.madeMoveTarget.addEventListener("move", function() {
						this.castEventTarget.removeEventListener("cast", resolve);
						reject();
					}.bind(this), {once: true});
				}).then(
					(e) => {return e.detail},
					() => {return null}
				);
				if (handIndex === null) {
					return;
				}
				response.value = handIndex;
				break;
			}
			case "doAttackDeclaration": {
				this.canDeclareToAttack = request.eligibleUnits;

				for (let i = 0; i < request.eligibleUnits.length; i++) {
					this.unitAttackButtons.push(gameUI.addCardButton(
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
			case "activateTriggerAbility":
			case "activateFastAbility":
			case "activateOptionalAbility": {
				let activated = await new Promise((resolve, reject) => {
					for (let i = 0; i < request.eligibleAbilities.length; i++) {
						gameUI.addCardButton(
							request.eligibleAbilities[i].card.zone,
							request.eligibleAbilities[i].card.index,
							locale.game.automatic.cardOptions.activateMultiple.replace("{#ABILITY}", request.eligibleAbilities[i].index + 1),
							"activateAbility",
							function() {
								resolve(i);
							}
						)
					}
					this.madeMoveTarget.addEventListener("move", function() {
						for (let ability of request.eligibleAbilities) {
							gameUI.clearCardButtons(ability.card.zone, ability.card.index, "activateAbility");
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
				if (this.fieldPlaceIndex !== null) {
					response.value = request.eligibleSlots.indexOf(this.fieldPlaceIndex);
					this.fieldPlaceIndex = null;
					break;
				}
				// TODO: Let player choose one here.
				response.value = 0;
				for (let i = 0; i < request.eligibleSlots.length; i++) {
					if (Math.abs(request.eligibleSlots[i] - 2) < Math.abs(request.eligibleSlots[response.value] - 2)) {
						response.value = i;
					}
				}
				break;
			}
			case "chooseAbilityOrder": {
				response.value = await autoUI.promptOrderSelection(
					locale.game.automatic.orderSelect.abilityPrompt.replaceAll("{#CARDNAME}", (await Promise.all(request.applyTo.values.current.names.map(idName => cardLoader.getCardInfo(idName)))).map(info => info.name).join("/")),
					(await Promise.allSettled(request.abilities.map(ability => cardLoader.getAbilityText(ability.id)))).map(promise => generalUI.createAbilityFragment(promise.value)),
					locale.game.automatic.orderSelect.confirm
				);
				break;
			}
			case "orderCards": {
				response.value = await autoUI.promptOrderSelection(
					locale.game.automatic.orderSelect.cardPrompt.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name),
					(await Promise.allSettled(request.cards.map(card => cardLoader.getCardInfo(card.values.current.names[0])))).map(promise => document.createTextNode(promise.value.name)),
					locale.game.automatic.orderSelect.confirm
				);
				break;
			}
		}
		this.madeMoveTarget.dispatchEvent(new CustomEvent("move"));
		socket.send("[inputRequestResponse]" + JSON.stringify(response));
		return response;
	}

	async gameSleep(duration = .5) {
		return new Promise(resolve => setTimeout(resolve, this.gameSpeed * 1000 * duration));
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
		this.canStandardSummon = [];
		this.canDeploy = [];
		this.canCast = [];
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