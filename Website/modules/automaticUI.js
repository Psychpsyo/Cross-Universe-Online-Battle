// this file holds all the code needed for UI that is required during automatic games.

import {locale} from "/modules/locale.js";
import {previewCard, closeCardPreview} from "/modules/generalUI.js";
import {FieldZone} from "/rulesEngine/zones.js";
import * as gameUI from "/modules/gameUI.js";
import * as cardLoader from "/modules/cardLoader.js";
import * as blocks from "/rulesEngine/blocks.js";

let currentActivePhaseElem = null;

export function init() {
	Array.from(document.querySelectorAll(".manualOnly")).forEach(elem => elem.remove());

	for (const [key, value] of Object.entries(locale.game.automatic.phases)) {
		document.getElementById(key + "Indicator").textContent = value;
	}
	yourTurnDisplayLabel.textContent = locale.game.automatic.turns.you;
	opponentTurnDisplayLabel.textContent = locale.game.automatic.turns.opponent;

	retireCancelBtn.textContent = locale.game.automatic.retire.dropCancel;
	passBtn.textContent = locale.game.automatic.actions.pass;
	attackBtn.textContent = locale.game.automatic.actions.attack;

	typePopupConfirm.textContent = locale.game.automatic.typeSelect.select;
	abilityOrderConfirm.textContent = locale.game.automatic.abilityOrderSelect.confirm;

	passBtn.addEventListener("click", function() {
		this.disabled = true;
	});

	retireBtn.addEventListener("click", clearRetire);
	retireCancelBtn.addEventListener("click", function() {
		gameState.controller.cancelRetire(localPlayer);
		clearRetire();
		indicatePass();
	});

	controlPanel.hidden = false;
}

export function startPhase(type) {
	currentActivePhaseElem?.classList.remove("current");
	switch(type) {
		case "manaSupplyPhase": {
			currentActivePhaseElem = manaSupplyPhaseIndicator;
			stackTitle.textContent = locale.game.automatic.stacks.manaSupplyPhase;
			stackTitle.classList.add("invalid");
			stackDisplayHolder.dataset.block = "";
			break;
		}
		case "drawPhase": {
			currentActivePhaseElem = drawPhaseIndicator;
			break;
		}
		case "mainPhase": {
			currentActivePhaseElem = currentActivePhaseElem == drawPhaseIndicator? firstMainPhaseIndicator : secondMainPhaseIndicator;
			break;
		}
		case "battlePhase": {
			currentActivePhaseElem = battlePhaseIndicator;
			break;
		}
		case "endPhase": {
			currentActivePhaseElem = endPhaseIndicator;
			break;
		}
	}
	currentActivePhaseElem.classList.add("current");
}

export function startTurn(speed) {
	phaseDisplay.hidden = false;
	currentActivePhaseElem?.classList.remove("current");
	currentActivePhaseElem = null;

	let currentTurn = game.currentTurn();
	if (currentTurn.player == localPlayer) {
		opponentTurnDisplayLabel.classList.add("hidden");
		window.setTimeout(() => {
			yourTurnDisplayLabel.classList.remove("hidden");
		}, speed * 1.5);
	} else {
		yourTurnDisplayLabel.classList.add("hidden");
		window.setTimeout(() => {
			opponentTurnDisplayLabel.classList.remove("hidden");
		}, speed * 1.5);
	}

	if (currentTurn.index == 1) {
		battlePhaseIndicator.classList.remove("invalid");
		secondMainPhaseIndicator.classList.remove("invalid");
	}
}

export function indicatePass() {
	passBtn.disabled = false;
}
export function clearPass() {
	passBtn.disabled = true;
}

export function indicateYourMove() {
	stackDisplayHolder.classList.add("yourMove");
}
export function clearYourMove() {
	stackDisplayHolder.classList.remove("yourMove");
}

export function newStack(number) {
	stackTitle.textContent = locale.game.automatic.stacks.title.replaceAll("{#NUM}", number);
	stackTitle.classList.remove("invalid");
	stackDisplayHolder.innerHTML = "";
	stackDisplayHolder.dataset.block = locale.game.automatic.stacks.block.replaceAll("{#NUM}", 1);
}
export function newBlock(block) {
	let card = null;
	let label = "";
	switch(block.constructor) {
		case blocks.StandardDraw: {
			card = block.player.deckZone.cards[block.player.deckZone.cards.length - 1];
			label = locale.game.automatic.blocks.draw;
			break;
		}
		case blocks.Retire: {
			card = block.units[0];
			label = locale.game.automatic.blocks.retire;
			break;
		}
		case blocks.AttackDeclaration: {
			card = block.attackers[0];
			label = locale.game.automatic.blocks.declare;
			break;
		}
		case blocks.Fight: {
			card = game.currentAttackDeclaration.target;
			label = locale.game.automatic.blocks.fight;
			break;
		}
		case blocks.StandardSummon: {
			card = block.card;
			label = locale.game.automatic.blocks.summon;
			break;
		}
		case blocks.CastSpell: {
			card = block.card;
			label = locale.game.automatic.blocks.cast;
			break;
		}
		case blocks.DeployItem: {
			card = block.card;
			label = locale.game.automatic.blocks.deploy;
			break;
		}
		case blocks.AbilityActivation: {
			card = block.card;
			label = locale.game.automatic.blocks.activate;
			break;
		}
	}

	let visual = document.createElement("div");

	let img = document.createElement("img");
	img.src = cardLoader.getCardImage(card);
	img.draggable = false;
	visual.appendChild(img);
	img.addEventListener("click", function(e) {
		e.stopPropagation();
		previewCard(card.current());
	});

	let labelElem = document.createElement("span");
	labelElem.classList.add("overlayText");
	labelElem.textContent = label;
	visual.appendChild(labelElem);

	stackDisplayHolder.appendChild(visual);
	stackDisplayHolder.dataset.block = locale.game.automatic.stacks.block.replaceAll("{#NUM}", block.stack.blocks.length + 1);
}

export function indicateRetire(amount) {
	retireBtn.textContent = locale.game.automatic.retire.dropRetire.replaceAll("{#AMOUNT}", amount);
	retireOptions.style.display = "block";
	clearPass();
}
export function clearRetire() {
	retireOptions.style.display = "none";
}

export function playerWon(player) {
	closeCardPreview();
	let displayText = player == localPlayer? locale.game.automatic.gameOver.youWon : locale.game.automatic.gameOver.youLost;
	displayText += "\n\n";
	displayText += locale.game.automatic.gameOver[player == localPlayer? "winReasons" : "loseReasons"][player.victoryConditions[0]];
	mainGameBlackoutContent.textContent = displayText;
	mainGameBlackout.classList.remove("hidden");
}
export function gameDrawn() {
	closeCardPreview();
	mainGameBlackoutContent.textContent = locale.game.automatic.gameOver.draw + "\n\n" + locale.game.automatic.gameOver.bothWon;
	mainGameBlackout.classList.remove("hidden");
}

export function setAttackTarget(target) {
	let targetOffset;
	let targetDistance;
	switch (target.zone) {
		case game.players[0].partnerZone: {
			targetOffset = 2;
			targetDistance = 0;
			break;
		}
		case game.players[0].unitZone: {
			targetOffset = target.index * -1 + 4;
			targetDistance = 1;
			break;
		}
		case localPlayer.unitZone: {
			targetOffset = target.index;
			targetDistance = 2;
			break;
		}
		case localPlayer.partnerZone: {
			targetOffset = 2;
			targetDistance = 3;
			break;
		}
	}

	for (let y = 0; y < 4; y++) {
		for (let x = 0; x < 5; x++) {
			let holder = document.getElementById("field" + (y * 5 + x)).parentElement;
			let offset = targetOffset - x;
			offset = offset - Math.sign(offset) * .5;
			holder.style.setProperty("--atk-offset", offset);
			let distance = Math.abs(targetDistance - y);
			distance = distance - Math.sign(distance) * .5;
			holder.style.setProperty("--atk-distance", distance);
		}
	}
}

export async function attack(units) {
	let animPromises = [];
	for (let unit of units) {
		let slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(unit.zone, unit.index)).parentElement;
		slot.classList.add("attacking");
		window.setTimeout(function() {
			slot.classList.remove("attacking");
		}, gameState.controller.gameSpeed * 400);
		animPromises.push(new Promise(resolve => setTimeout(resolve, gameState.controller.gameSpeed * 400)));
		await gameState.controller.gameSleep(.6);
	}
	return Promise.all(animPromises);
}

export async function activate(card) {
	if (!(card.zone instanceof FieldZone)) {
		return;
	}
	let slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(card.zone, card.index)).parentElement;
	slot.classList.add("activating");
	window.setTimeout(function() {
		slot.classList.remove("activating");
	}, gameState.controller.gameSpeed * 1000);
	return new Promise(resolve => setTimeout(resolve, gameState.controller.gameSpeed * 1000));
}

export async function revealHandCard(card) {
	let cardImg = document.getElementById("hand" + card.zone.player.index).children.item(card.index);
	cardImg.classList.add("revealed");
	cardImg.src = cardLoader.getCardImage(card);
	if (card.zone.player.index === 0) {
		previewCard(card);
	}
	await new Promise(resolve => setTimeout(resolve, gameState.controller.gameSpeed * 1500));
	cardImg.src = cardLoader.getCardImage(card.current());
	cardImg.classList.remove("revealed");
}
export function showOpponentAction(message) {
	opponentActionDisplay.textContent = message;
	opponentActionDisplay.classList.add("shown");
}

export function clearOpponentAction() {
	opponentActionDisplay.classList.remove("shown");
}

export async function promptTypeSelection(message, types) {
	typeSelectPopupText.textContent = message;
	typePopupSelection.innerHTML = "";
	for (let i = 0; i < types.length; i++) {
		let option = document.createElement("option");
		option.value = i;
		option.textContent = locale.types[types[i]];
		typePopupSelection.add(option);
	}
	typeSelectPopup.showModal();

	return new Promise(resolve => {
		typePopupConfirm.addEventListener("click", function() {
			typeSelectPopup.close();
			resolve(typePopupSelection.value);
		}, {once: true});
	});
}

export async function promptAbilityOrderSelection(applyTo, abilities) {
	abilityOrderPopupText.textContent = locale.game.automatic.abilityOrderSelect.prompt.replaceAll("{#CARDNAME}", (await Promise.all(applyTo.values.names.map(name => cardLoader.getCardInfo(applyTo.values.names[0])))).map(info => info.name).join("/"));
	abilityOrderConfirm.disabled = true;

	for (const ability of abilities) {
		let abilityOption = document.createElement("div");
		abilityOption.classList.add("bigButton");
		abilityOption.classList.add("abilityOrderItem");
		abilityOption.textContent = await cardLoader.getAbilityText(ability.id);
		abilityOption.addEventListener("click", function() {
			// either add or remove the index from this element.
			if (this.dataset.index) {
				// when removing all higher indices must be adjusted.
				for (const ability of Array.from(abilityOrderList.children)) {
					if (ability.dataset.index > this.dataset.index) {
						ability.dataset.index -= 1;
					}
				}
				this.removeAttribute("data-index");
				abilityOrderConfirm.disabled = true;
			} else {
				let indexCount = 0;
				for (const ability of Array.from(abilityOrderList.children)) {
					if (ability.dataset.index !== undefined) {
						indexCount += 1;
					}
				}
				this.dataset.index = indexCount + 1;
				if (indexCount + 1 === abilityOrderList.children.length) {
					abilityOrderConfirm.disabled = false;
				}
			}
		});
		abilityOrderList.appendChild(abilityOption);
	}
	abilityOrderPopup.showModal();

	return new Promise(resolve => {
		abilityOrderConfirm.addEventListener("click", function() {
			abilityOrderPopup.close();
			let order = [];
			for (const ability of Array.from(abilityOrderList.children)) {
				order.push(ability.dataset.index - 1);
			}
			abilityOrderList.innerHTML = "";
			resolve(order);
		}, {once: true});
	});
}