// this file holds all the code needed for UI that is required during automatic games.

import localize from "../../scripts/locale.mjs";
import {previewCard} from "./generalUI.mjs";
import {cardAlignmentInfo} from "../../scripts/profilePicture.mjs";
import {FieldZone} from "../../rulesEngine/src/zones.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as blocks from "../../rulesEngine/src/blocks.mjs";

let currentActivePhaseElem = null;

export function init() {
	Array.from(document.querySelectorAll(".manualOnly")).forEach(elem => elem.remove());

	for (const phase of ["manaSupplyPhase", "drawPhase", "firstMainPhase", "battlePhase", "secondMainPhase", "endPhase"]) {
		document.getElementById(phase + "Indicator").textContent = localize(`game.automatic.phases.${phase}`);
	}
	yourTurnDisplayLabel.textContent = localize("game.automatic.turns.you");
	opponentTurnDisplayLabel.textContent = localize("game.automatic.turns.opponent");

	retireCancelBtn.textContent = localize("game.automatic.retire.dropCancel");
	passBtn.textContent = localize("game.automatic.actions.pass");
	attackBtn.textContent = localize("game.automatic.actions.attack");

	passModeLabel.textContent = localize("game.automatic.actions.passMode");
	for (const option of passModeSelect.children) {
		option.textContent = localize(`game.automatic.actions.passModes.${option.value}`);
	}

	selectPopupConfirm.textContent = localize("game.automatic.selectPopup.confirm");

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
			stackTitle.textContent = localize("game.automatic.stacks.manaSupplyPhase");
			stackTitle.classList.add("invalid");
			stackDisplayHolder.dataset.block = "";
			break;
		}
		case "drawPhase": {
			currentActivePhaseElem = drawPhaseIndicator;
			break;
		}
		case "mainPhase1": {
			currentActivePhaseElem = firstMainPhaseIndicator;
			break;
		}
		case "battlePhase": {
			currentActivePhaseElem = battlePhaseIndicator;
			break;
		}
		case "mainPhase2": {
			currentActivePhaseElem = secondMainPhaseIndicator;
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

	if (game.currentTurn().player === localPlayer) {
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

	updateBattlePhaseIndicator();
}

export function updateBattlePhaseIndicator() {
	const currentTurn = game.currentTurn();
	if (currentTurn.index > 0 && currentTurn.player.values.current.canEnterBattlePhase) {
		battlePhaseIndicator.classList.remove("invalid");
		secondMainPhaseIndicator.classList.remove("invalid");
	} else {
		battlePhaseIndicator.classList.add("invalid");
		secondMainPhaseIndicator.classList.add("invalid");
	}
}

export function indicatePass() {
	passBtn.disabled = false;
	// stack 1 block 1 uses the more descriptive 'NEXT PHASE'/'END TURN' label instead of 'PASS'
	if (game.currentStack()?.index === 1 && game.currentStack().blocks.length === 0) {
		passBtn.textContent = localize(`game.automatic.actions.${game.currentPhase().types.includes("endPhase")? "endTurn" : "nextPhase"}`);
	}
}
export function clearPass() {
	passBtn.disabled = true;
	passBtn.textContent = localize("game.automatic.actions.pass");
}

export function indicateYourMove() {
	stackDisplayHolder.classList.add("yourMove");
	mainGameArea.classList.add("yourMove");

}
export function clearYourMove() {
	stackDisplayHolder.classList.remove("yourMove");
	mainGameArea.classList.remove("yourMove");
}

export function newStack(number) {
	stackTitle.textContent = localize("game.automatic.stacks.title", number);
	stackTitle.classList.remove("invalid");
	stackDisplayHolder.innerHTML = "";
	stackDisplayHolder.dataset.block = localize("game.automatic.stacks.block", 1);
	stackDisplayHolder.style.setProperty("--block-count", 0);
}
export function newBlock(block) {
	let card = null;
	let label = "";
	switch(block.constructor) {
		case blocks.StandardDraw: {
			card = block.player.deckZone.cards.at(-1);
			label = localize("game.automatic.blocks.draw");
			break;
		}
		case blocks.Retire: {
			card = block.units[0];
			label = localize("game.automatic.blocks.retire");
			break;
		}
		case blocks.AttackDeclaration: {
			card = block.attackers[0];
			label = localize("game.automatic.blocks.declare");
			break;
		}
		case blocks.Fight: {
			card = game.currentAttackDeclaration.target;
			label = localize("game.automatic.blocks.fight");
			break;
		}
		// These ones need to use the current() version of the card since the one that was summoned/cast/deployed is hidden in the opponent's hand.
		// The snapshot needs to be taken because the card might be shuffled into a deck before the block executes, making it so that clicking on
		// it would try to bring up a hidden card.
		case blocks.StandardSummon: {
			card = block.card.current().snapshot();
			label = localize("game.automatic.blocks.summon");
			break;
		}
		case blocks.CastSpell: {
			card = block.card.current().snapshot();
			label = localize("game.automatic.blocks.cast");
			break;
		}
		case blocks.DeployItem: {
			card = block.card.current().snapshot();
			label = localize("game.automatic.blocks.deploy");
			break;
		}
		case blocks.AbilityActivation: {
			card = block.card;
			label = localize("game.automatic.blocks.activate");
			break;
		}
	}

	let visual = document.createElement("div");

	let img = document.createElement("img");
	img.src = cardLoader.getCardImage(card, "tiny");
	img.draggable = false;
	visual.appendChild(img);
	img.addEventListener("click", function(e) {
		e.stopPropagation();
		previewCard(card.current() ?? card);
	});

	let labelElem = document.createElement("span");
	labelElem.classList.add("overlayText");
	labelElem.textContent = label;
	visual.appendChild(labelElem);

	stackDisplayHolder.appendChild(visual);
	stackDisplayHolder.dataset.block = localize("game.automatic.stacks.block", block.stack.blocks.length + 1);
	stackDisplayHolder.style.setProperty("--block-count", block.stack.blocks.length);
}

export function indicateRetire(amount) {
	retireBtn.textContent = localize("game.automatic.retire.dropRetire", amount);
	retireOptions.style.display = "block";
	clearPass();
}
export function clearRetire() {
	retireOptions.style.display = "none";
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
		case game.players[1].unitZone: {
			targetOffset = target.index;
			targetDistance = 2;
			break;
		}
		case game.players[1].partnerZone: {
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
		await gameState.controller.gameSleep(.3);
	}
	return Promise.all(animPromises);
}

export async function activate(card) {
	switch (card.zone.type) {
		case "unit":
		case "spellItem":
		case "partner": {
			let slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(card.zone, card.index)).parentElement;
			slot.classList.add("activating");
			await gameState.controller.gameSleep(1);
			slot.classList.remove("activating");
			break;
		}
		case "discard":
		case "exile": {
			let img = document.getElementById(card.zone.type + card.zone.player.index);
			let slot = img.parentElement;
			let previousSrc = img.src;
			img.src = cardLoader.getCardImage(card, "tiny");
			slot.classList.add("activating");
			await gameState.controller.gameSleep(1);
			slot.classList.remove("activating");
			img.src = previousSrc;
			break;
		}
	}
}

export async function revealHandCard(card, duration) {
	let cardImg = document.getElementById("hand" + card.currentOwner().index).children.item(card.index);
	cardImg.classList.add("revealed");
	cardImg.src = cardLoader.getCardImage(card, "tiny");
	if (card.currentOwner().index === 0) {
		previewCard(card);
	}
	await new Promise(resolve => setTimeout(resolve, gameState.controller.gameSpeed * 1500 * duration));
	cardImg.classList.remove("revealed");
	if (card.current().hiddenFor.includes(card.currentOwner().next())) {
		cardImg.src = cardLoader.getCardImage(card.current(), "tiny");
	} else {
		cardImg.classList.add("permanentlyRevealed");
	}
}
export async function unrevealHandCard(card) {
	let cardImg = document.getElementById("hand" + card.currentOwner().index).children.item(card.index);
	cardImg.src = cardLoader.getCardImage(card.current(), "tiny");
	cardImg.classList.remove("permanentlyRevealed");
}
export function showOpponentAction(message) {
	opponentActionDisplay.textContent = message;
	opponentActionDisplay.classList.add("shown");
}

export function clearOpponentAction() {
	opponentActionDisplay.classList.remove("shown");
}

export async function promptDropdownSelection(message, options, request) {
	typeSelectPopupText.textContent = message;
	selectPopupSelect.innerHTML = "";
	for (const option of options) {
		const optionElement = document.createElement("option");
		optionElement.value = option.value;
		optionElement.textContent = option.label;
		optionElement.disabled = await request.validate({type: request.type, value: option.value}) !== "";
		selectPopupSelect.add(optionElement);
	}
	typeSelectPopup.showModal();

	return new Promise(resolve => {
		selectPopupConfirm.addEventListener("click", function() {
			typeSelectPopup.close();
			resolve(parseInt(selectPopupSelect.value));
		}, {once: true});
	});
}

export async function promptOrderSelection(title, labelFragments, confirmLabel) {
	itemOrderPopupText.textContent = title;
	itemOrderConfirm.textContent = confirmLabel;
	itemOrderConfirm.disabled = true;

	for (const label of labelFragments) {
		let orderItem = document.createElement("div");
		orderItem.classList.add("bigButton");
		orderItem.classList.add("itemOrderDiv");
		orderItem.appendChild(label);
		orderItem.addEventListener("click", function() {
			// either add or remove the index from this element.
			if (this.dataset.index) {
				// when removing all higher indices must be adjusted.
				for (const item of Array.from(itemOrderList.children)) {
					if (item.dataset.index > this.dataset.index) {
						item.dataset.index -= 1;
					}
				}
				this.removeAttribute("data-index");
				itemOrderConfirm.disabled = true;
			} else {
				let indexCount = 0;
				for (const item of Array.from(itemOrderList.children)) {
					if (item.dataset.index !== undefined) {
						indexCount += 1;
					}
				}
				this.dataset.index = indexCount + 1;
				if (indexCount + 1 === itemOrderList.children.length) {
					itemOrderConfirm.disabled = false;
				}
			}
		});
		itemOrderList.appendChild(orderItem);
	}
	itemOrderPopup.showModal();

	return new Promise(resolve => {
		itemOrderConfirm.addEventListener("click", function() {
			itemOrderPopup.close();
			let order = [];
			for (const ability of Array.from(itemOrderList.children)) {
				order.push(ability.dataset.index - 1);
			}
			itemOrderList.innerHTML = "";
			resolve(order);
		}, {once: true});
	});
}

// cool attack animation
export async function showCoolAttackAnim(defender, attackers) {
	coolAttackVisual.style.setProperty("--attacker-count", attackers.length);
	coolAttackVisual.classList.add("visible");
	document.querySelectorAll(".coolAttackSlot").forEach((slot, i) => {
		slot.style.display = i > attackers.length? "none" : "block";
	});

	const imgs = document.querySelectorAll(".coolAttackImgHolder > img");
	// first display the tiny image which we likely already have, then start overriding it with the big one
	imgs[0].src = cardLoader.getCardImage(defender,"tiny");
	setTimeout(() => {imgs[0].src = cardLoader.getCardImage(defender)}, 0);
	if (cardAlignmentInfo[defender.cardId]?.flip) {
		imgs[0].style.setProperty("--left", -100 + (cardAlignmentInfo[defender.cardId]?.left ?? 50) + "%");
		imgs[0].style.transform = "skew(5deg) scaleX(-1)";
	} else {
		imgs[0].style.setProperty("--left", -(cardAlignmentInfo[defender.cardId]?.left ?? 50) + "%");
		imgs[0].style.transform = "skew(5deg)";
	}

	for (let i = 0; i < attackers.length; i++) {
		// first display the tiny image which we likely already have, then start overriding it with the big one
		imgs[i+1].src = cardLoader.getCardImage(attackers[i], "tiny");
		setTimeout(() => {imgs[i+1].src = cardLoader.getCardImage(attackers[i])}, 0);
		if (!cardAlignmentInfo[attackers[i].cardId]?.flip && !cardAlignmentInfo[attackers[i].cardId]?.neverFlip) {
			imgs[i+1].style.setProperty("--left", -100 + (cardAlignmentInfo[attackers[i].cardId]?.left ?? 50) + "%");
			imgs[i+1].style.transform = "skew(5deg) scaleX(-1)";
		} else {
			imgs[i+1].style.setProperty("--left", -(cardAlignmentInfo[attackers[i].cardId]?.left ?? 50) + "%");
			imgs[i+1].style.transform = "skew(5deg)";
		}
	}

	const slots = document.getElementsByClassName("coolAttackSlot");
	for (let i = 0; i < slots.length; i++) {
		slots[i].classList.remove("coolAttackAnimEnd"); // still there from last time
		slots[i].classList.add("coolAttackAnimBegin");
		await gameState.controller.gameSleep(i == 0? .4 : .15);
	}
	await gameState.controller.gameSleep(.4 + attackers.length * .05);

	for (const slot of slots) {
		slot.classList.remove("coolAttackAnimBegin");
		slot.classList.add("coolAttackAnimEnd");
	}

	coolAttackVisual.classList.remove("visible");
}

// card movements
export async function showCardSwap(cardA, cardB) {
	for (const card of [cardA.current(), cardB.current()]) {
		gameUI.updateCard(card.zone, card.index);
		// handle counters
		if (card.zone instanceof FieldZone) {
			const slotIndex = gameUI.fieldSlotIndexFromZone(card.zone, card.index);
			gameUI.clearCounters(slotIndex);
			for (const counter in card.counters) {
				if ((card.counters[counter] ?? 0) === 0) continue;

				const counterElem = gameUI.addCounter(slotIndex, localize(`counters.${counter}`));
				counterElem.classList.add("counterType" + counter);
				gameUI.setCounter(counterElem, card.counters[counter]);
			}
		}
	}
	return Promise.all([
		updateCardAttackDefenseOverlay(cardA.current()),
		updateCardAttackDefenseOverlay(cardB.current())
	]);
}

// card attack/defense overlays
const attackUiValues = new Map();
const defenseUiValues = new Map();
export function addCardAttackDefenseOverlay(card) {
	if (!card) return;
	if (!(card.zone instanceof FieldZone)) return;
	if (!card.values.current.cardTypes.includes("unit")) return;

	const slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(card.zone, card.index)).parentElement;

	const overlay = document.createElement("div");
	overlay.classList.add("overlayText", "cardValueOverlay");
	const attackSpan = document.createElement("span");
	attackSpan.textContent = card.values.current.attack;
	const defenseSpan = document.createElement("span");
	defenseSpan.textContent = card.values.current.defense;
	overlay.appendChild(attackSpan);
	overlay.appendChild(document.createTextNode(" / "));
	overlay.appendChild(defenseSpan);

	attackUiValues.set(slot, new gameUI.UiValue(card.values.current.attack, 5, attackSpan));
	defenseUiValues.set(slot, new gameUI.UiValue(card.values.current.defense, 5, defenseSpan));

	slot.appendChild(overlay);
}
export function removeCardAttackDefenseOverlay(card) {
	if (!(card.zone instanceof FieldZone)) {
		return;
	}
	const slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(card.zone, card.index)).parentElement;

	const overlay = slot.querySelector(".cardValueOverlay");
	if (!overlay) return;

	overlay.remove();
	attackUiValues.get(slot).remove();
	defenseUiValues.get(slot).remove();
	attackUiValues.delete(slot);
	defenseUiValues.delete(slot);
}
export async function updateCardAttackDefenseOverlay(card, speed = Infinity) {
	if (!(card.zone instanceof FieldZone)) {
		return;
	}
	const slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(card.zone, card.index)).parentElement;
	return Promise.all([
		attackUiValues.get(slot).set(card.values.current.attack, speed),
		defenseUiValues.get(slot).set(card.values.current.defense, speed)
	]);
}

// counter visuals
export async function updateCounters(card, type) {
	const slotIndex = gameUI.fieldSlotIndexFromZone(card.zone, card.index);
	const counterHolder = document.getElementById("field" + slotIndex).parentElement.querySelector(".counterHolder");
	let counterElem = counterHolder.querySelector(".counterType" + type);
	if (counterElem === null) {
		counterElem = gameUI.addCounter(slotIndex, localize(`counters.${type}`));
		counterElem.classList.add("counterType" + type);
	}
	const counterCount = card.counters[type] ?? 0;
	if (counterCount === 0) {
		counterElem.remove();
		return gameState.controller.gameSleep(.2);
	}
	gameUI.setCounter(counterElem, counterCount);
	return gameState.controller.gameSleep(.2);
}

// generates a card list to insert in chat
export function chatCards(cards, effectHighlights = new Array(cards.length).fill(null)) {
	const cardHolder = document.createElement("div");
	cardHolder.classList.add("chatCardHolder");
	for (let i = 0; i < cards.length; i++) {
		let card = cards[i];
		if (card.hiddenFor.includes(localPlayer) && card.current()) {
			card = card.current().snapshot();
		}
		const cardImg = document.createElement("img");
		cardImg.src = cardLoader.getCardImage(card, "tiny");
		cardImg.addEventListener("click", function () {
			previewCard(card, true, effectHighlights[i]);
		});
		cardImg.addEventListener("dragstart", e => e.preventDefault());
		cardHolder.appendChild(cardImg);
	}
	return cardHolder;
}

export function rulesEngineCrash() {
	const holder = document.createElement("div");
	holder.style.setProperty("display", "flex");
	holder.style.setProperty("justify-content", "space-evenly");
	holder.style.setProperty("padding-bottom", ".35em");

	// download button
	const downloadReplayBtn = document.createElement("button");
	downloadReplayBtn.textContent = localize("game.notices.downloadReplay");
	downloadReplayBtn.addEventListener("click", () => {
		const downloadElement = document.createElement("a");
		downloadElement.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(game.replay));
		downloadElement.download = "crashReplay.json";
		downloadElement.click();
	});
	holder.appendChild(downloadReplayBtn);

	// email button
	const sendBugReportBtn = document.createElement("button");
	sendBugReportBtn.textContent = localize("game.notices.submitBugReport");
	sendBugReportBtn.addEventListener("click", () => {
		const issueTitle = "My Rules Engine Crashed";
		const issueBody = `# Replay\n<!-- Please drop your replay file here to upload it. -->`;
		window.open(`https://github.com/Psychpsyo/Galaxy-Engine/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`, "_blank").focus();
	});
	holder.appendChild(sendBugReportBtn);

	chat.putMessage(localize("game.notices.rulesEngineCrashed"), "error", holder);
}