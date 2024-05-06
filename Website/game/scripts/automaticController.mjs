// This module exports the controller for the automatic simulator which verifies the cross universe game rules

import {locale} from "../../scripts/locale.mjs";
import {InteractionController} from "./interactionController.mjs";
import {netSend} from "./netcode.mjs";
import * as autopass from "./autopass.mjs";
import {BaseCard} from "../../rulesEngine/src/card.mjs";
import {Player} from "../../rulesEngine/src/player.mjs";
import * as gameUI from "./gameUI.mjs";
import * as autoUI from "./automaticUI.mjs";
import * as generalUI from "./generalUI.mjs";
import * as actions from "../../rulesEngine/src/actions.mjs";
import * as blocks from "../../rulesEngine/src/blocks.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as zones from "../../rulesEngine/src/zones.mjs";

// for ability activation buttons
const circledDigits = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

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

		// track ctrl to disable the autopass when it's held
		this.ctrlHeld = false;
		this.oldPassMode;
		window.addEventListener("keydown", e => {
			if (e.key === "Control" && !this.ctrlHeld) {
				this.ctrlHeld = true;
				this.oldPassMode = passModeSelect.value;
				passModeSelect.value = "never";
			}
		});
		window.addEventListener("keyup", e => {
			if (e.key === "Control") {
				this.ctrlReleased();
			}
		});
		window.addEventListener("blur", this.ctrlReleased.bind(this));
	}

	async startGame() {
		const updateGenerator = game.begin();
		let updates;
		try {
			updates = await updateGenerator.next();
		} catch(e) {
			autoUI.rulesEngineCrash();
			console.error(e);
		}

		while (!updates.done) {
			let returnValue;
			switch (updates.value[0].nature) {
				case "event": {
					const groupedEvents = Object.groupBy(updates.value, event => event.type);
					await Promise.all(Object.entries(groupedEvents).map(keyValue => this.handleEvents(keyValue[0], keyValue[1])));
					break;
				}
				case "request": {
					// This code is way more general than it needs to be since there is never cases where both players need to act at the same time.
					const localRequests = [];
					const playerPromises = [];
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

					const autoResponse = passModeSelect.value === "never"? null : autopass.getAutoResponse(
						game,
						localRequests,
						passModeSelect.value.startsWith("until"),
						localStorage.getItem("usePrivateInfoForAutopass")
					);
					if (autoResponse) {
						netSend("[inputRequestResponse]" + JSON.stringify(autoResponse));
						playerPromises[localPlayer.index].push(new Promise(resolve => {resolve(autoResponse)}));
					} else {
						playerPromises[localPlayer.index] = localRequests.map(request => this.presentInputRequest(request));
					}

					const responsePromises = await Promise.allSettled(playerPromises.map(promises => Promise.any(promises)));

					returnValue = responsePromises.map(promise => promise.value).filter(value => value !== undefined)[0];

					autoUI.clearYourMove();
					autoUI.clearOpponentAction();
					this.waitingForOpponentInput = false;
					for (const playerInfo of this.playerInfos) {
						playerInfo.canStandardSummon = [];
						playerInfo.canDeploy = [];
						playerInfo.canCast = [];
						playerInfo.canRetire = [];
					}
					for (const button of this.unitAttackButtons) {
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

			try {
				updates = await updateGenerator.next(returnValue);
			} catch(e) {
				autoUI.rulesEngineCrash(e);
				console.error(e);
				break;
			}
		}
	}

	receiveMessage(command, message) {
		switch (command) {
			case "inputRequestResponse": {
				let move = JSON.parse(message);
				if (move.type == "choosePlayer") {
					move.value = game.players[move.value].next().index;
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
					chat.putMessage(event.player == localPlayer? locale.game.notices.yourDeckShuffled : locale.game.notices.opponentDeckShuffled, "notice");
				}
				return this.gameSleep();
			}
			case "startingPlayerSelected": {
				chat.putMessage(events[0].player == localPlayer? locale.game.notices.youStart : locale.game.notices.opponentStarts, "notice");
				return this.gameSleep();
			}
			case "cardsDrawn": {
				for (const [playerIndex, cards] of Object.entries(Object.groupBy(events.map(event => event.cards).flat(), card => card.owner.index))) {
					chat.putMessage(locale.game.notices[playerIndex == localPlayer.index? "youDrew" : "opponentDrew"], "notice", autoUI.chatCards(cards));
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
					chat.putMessage(locale.game.notices[playerIndex == localPlayer.index? "youRevealed" : "opponentRevealed"], "notice", autoUI.chatCards(events.map(event => event.card)));
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
					chat.putMessage(locale.game.notices.viewed, "notice", autoUI.chatCards(localPlayerViewed.map(event => event.card)));
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
				if (passModeSelect.value === "untilNextTurn" ||
					passModeSelect.value === "untilMyNextTurn" && game.currentTurn().player === localPlayer
				) {
					this.setPassMode("auto");
				}
				return this.gameSleep();
			}
			case "phaseStarted": {
				autoUI.startPhase(events[0].phase.types[0]);
				if (passModeSelect.value === "untilNextPhase") {
					this.setPassMode("auto");
				}
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
				gameUI.playerWon(events[0].player);
				window.parent.postMessage({type: "playerWon", players: [events[0].player.index]});
				return;
			}
			case "gameDrawn": {
				gameUI.gameDrawn();
				window.parent.postMessage({type: "gameDrawn"});
				return;
			}
			case "damageDealt": {
				await Promise.all(events.map(async event => {
					return gameUI.uiPlayers[event.player.index].life.set(event.player.life, false);
				}));
				return this.gameSleep();
			}
			case "lifeChanged": {
				await Promise.all(events.map(async event => {
					return gameUI.uiPlayers[event.player.index].life.set(event.player.life, false);
				}));
				return this.gameSleep();
			}
			case "manaChanged": {
				await Promise.all(events.map(async event => {
					return gameUI.uiPlayers[event.player.index].mana.set(event.player.mana, false);
				}));
				return this.gameSleep();
			}
			case "valueChanged": {
				const changeAnimPromises = [];
				const objects = [];
				for (const event of events) {
					if (event.object instanceof BaseCard) {
						generalUI.updateCardPreview(event.object);
						if (["attack", "defense"].includes(event.valueName) && !objects.includes(event.object)) {
							changeAnimPromises.push(autoUI.updateCardAttackDefenseOverlay(event.object, false));
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
					// construct chat message locale identifier
					const player = playerIndex == localPlayer.index? "you" : "opponent";
					let action = type.substring(4);
					if (type === "cardSummoned" && game.currentBlock() instanceof blocks.StandardSummon) {
						action = "StandardSummoned";
					}
					chat.putMessage(
						locale.game.notices[player + action],
						"notice",
						autoUI.chatCards(eventList.map(event => event.card))
					);
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
			case "cardMoved": {
				chat.putMessage(locale.game.notices[type[4].toLowerCase() + type.substring(5)], "notice", autoUI.chatCards(events.map(event => event.card)));
				for (const event of events) {
					gameUI.removeCard(event.card.zone, event.card.index);
					autoUI.removeCardAttackDefenseOverlay(event.card);
					if (!event.card.isToken || event.toZone instanceof zones.FieldZone) {
						gameUI.insertCard(event.toZone, event.toIndex);
						autoUI.addCardAttackDefenseOverlay(event.card.current());
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
				return Promise.all(events.map(event => autoUI.showCardSwap(event.cardA, event.cardB)));
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
			case "actionModificationAbilityApplied": {
				return autoUI.activate(events[0].ability.card);
			}
			case "countersChanged": {
				return Promise.all(events.map(event => autoUI.updateCounters(event.card.current(), event.counterType)));
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
					chat.putMessage(locale.game.notices[events[0].block.player === localPlayer? "youActivated" : "opponentActivated"], "notice", autoUI.chatCards([events[0].block.card]));
				}
				if (passModeSelect.value === "untilBattle" && events[0].block instanceof blocks.AttackDeclaration) {
					this.setPassMode("auto");
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
					chat.putMessage(game.players[events[0].chosenPlayer] === localPlayer? locale.game.notices.opponentChoseYou : locale.game.notices.opponentChoseSelf, "notice");
				}
				break;
			}
			case "typeSelected": {
				if (events[0].player !== localPlayer) {
					chat.putMessage(locale.game.notices.opponentChoseType.replaceAll("{#TYPE}", locale.types[events[0].chosenType]), "notice");
				}
				break;
			}
			case "abilitySelected": {
				if (events[0].player !== localPlayer) {
					chat.putMessage(locale.game.notices.opponentChoseAbility.replaceAll("{#ABILITY}", await cardLoader.getAbilityText(events[0].chosenAbility)), "notice");
				}
				break;
			}
			case "deckSideSelected": {
				if (events[0].player !== localPlayer) {
					chat.putMessage(locale.game.notices.opponentChoseDeckSide[events[0].chosenSide], "notice");
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
						case "nextCardToApplyStaticAbilityTo": {
							message = locale.game.automatic.opponentActions.selectingNextCardToApplyStaticAbilityTo;
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
				case "chooseAbility": {
					autoUI.showOpponentAction(locale.game.automatic.opponentActions.selectingEffect.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name));
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
					case "nextCardToApplyStaticAbilityTo": {
						title = locale.game.cardChoice.nextCardToApplyStaticAbilityTo;
						break;
					}
					default: {
						title = locale.game.cardChoice[request.reason.substring(0, request.reason.indexOf(":"))]?.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.reason.split(":")[1])).name) ?? locale.game.cardChoice.genericTitle;
					}
				}
				response.value = await gameUI.presentCardChoice(request.from, title, undefined, request.validAmounts, request.validate);
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
			case "chooseAbility": {
				response.value = await autoUI.promptDropdownSelection(
					locale.game.automatic.effectSelect.prompt.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name),
					(await Promise.allSettled(request.from.map(abilityId => cardLoader.getAbilityText(abilityId)))).map(promise => promise.value)
				);
				break;
			}
			case "chooseType": {
				response.value = await autoUI.promptDropdownSelection(
					locale.game.automatic.typeSelect.prompt.replaceAll("{#CARDNAME}", (await cardLoader.getCardInfo(request.effect.split(":")[0])).name),
					request.from.map(type => locale.types[type])
				);
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
				response.value = await gameUI.askQuestion(
					locale.game.automatic.battlePhase.question,
					locale.game.automatic.battlePhase.enter,
					locale.game.automatic.battlePhase.skip
				);
				break;
			}
			case "applyActionModificationAbility": {
				response.value = await gameUI.askQuestion(
					locale.game.automatic.modificationAbilityPrompt.question
						.replaceAll("{#CARD}", (await Promise.all(request.ability.card.values.current.names.map(idName => cardLoader.getCardInfo(idName)))).map(info => info.name).join("/"))
						.replaceAll("{#TARGET}", (await Promise.all(request.target.values.current.names.map(idName => cardLoader.getCardInfo(idName)))).map(info => info.name).join("/")),
					locale.game.automatic.modificationAbilityPrompt.yes,
					locale.game.automatic.modificationAbilityPrompt.no
				);
				break;
			}
			case "activateTriggerAbility":
			case "activateFastAbility":
			case "activateOptionalAbility": {
				let activated = await new Promise((resolve, reject) => {
					for (let i = 0; i < request.eligibleAbilities.length; i++) {
						const abilityIndex = request.eligibleAbilities[i].card.values.current.abilities.indexOf(request.eligibleAbilities[i].current());
						gameUI.addCardButton(
							request.eligibleAbilities[i].card.zone,
							request.eligibleAbilities[i].card.index,
							request.eligibleAbilities[i].card.values.current.abilities.length === 1?
								locale.game.automatic.cardOptions.activate :
								locale.game.automatic.cardOptions.activateMultiple.replace("{#ABILITY}", circledDigits[abilityIndex] ?? (abilityIndex + 1)),
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
		netSend("[inputRequestResponse]" + JSON.stringify(response));
		return response;
	}

	async gameSleep(duration = .5) {
		return new Promise(resolve => setTimeout(resolve, this.gameSpeed * 1000 * duration));
	}

	cancelRetire(player) {
		if (player == localPlayer) {
			netSend("[cancelRetire]");
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

	// pass mode related stuff
	ctrlReleased() {
		if (this.ctrlHeld) {
			this.ctrlHeld = false;
			if (passModeSelect.value === "never") {
				passModeSelect.value = this.oldPassMode;
			}
		}
	}
	setPassMode(newValue) {
		if (this.ctrlHeld) {
			this.oldPassMode = newValue;
		} else {
			passModeSelect.value = newValue;
		}
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
		retireOptions.classList.add("noClick");
	}
	clearHeld() {
		this.heldCard = null;
		gameUI.uiPlayers[this.player.index].clearDrag();
		retireOptions.classList.remove("noClick");
	}
}