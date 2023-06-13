// this file holds all the code needed for UI that is required during automatic games.

import {locale} from "/modules/locale.js";
import * as gameUI from "/modules/gameUI.js";

let currentActivePhaseElem = null;

export function init() {
	Array.from(document.querySelectorAll(".manualOnly")).forEach(elem => elem.remove());
	
	for (const [key, value] of Object.entries(locale.game.automatic.phases)) {
		document.getElementById(key + "Indicator").textContent = value;
	}
	
	retireCancelBtn.textContent = locale.game.automatic.retire.dropCancel;
	
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

export function indicateRetire(amount) {
	retireBtn.textContent = locale.game.automatic.retire.dropRetire.replaceAll("{#AMOUNT}", amount);
	retireOptions.style.display = "block";
	clearPass();
}
export function clearRetire() {
	retireOptions.style.display = "none";
}

export function playerLost(player) {
	let displayText = player == localPlayer? locale.game.automatic.gameOver.youLost : locale.game.automatic.gameOver.youWon;
	displayText += "\n\n";
	displayText += locale.game.automatic.gameOver[player == localPlayer? "loseReasons" : "winReasons"][player.loseReason];
	mainGameBlackoutContent.textContent = displayText;
	mainGameBlackout.classList.remove("hidden");
}
export function playerWon(player) {
	let displayText = player == localPlayer? locale.game.automatic.gameOver.youWon : locale.game.automatic.gameOver.youLost;
	displayText += "\n\n";
	displayText += locale.game.automatic.gameOver[player == localPlayer? "winReasons" : "loseReasons"][player.winReason];
	mainGameBlackoutContent.textContent = displayText;
	mainGameBlackout.classList.remove("hidden");
}
export function gameDrawn() {
	let displayText = locale.game.automatic.gameOver.draw;
	displayText += "\n\n";
	let drawReason = "";
	if (game.players[0].lost && game.players[1].lost) {
		drawReason = "bothLost";
	} else if (game.players[0].won && game.players[1].won) {
		drawReason = "bothWon";
	} else if (localPlayer.won && localPlayer.lost) {
		drawReason = "youWonAndLost";
	} else if (game.players[0].won && game.players[0].lost) {
		drawReason = "opponentWonAndLost";
	}
	displayText += locale.game.automatic.gameOver.drawReasons[drawReason];
	mainGameBlackoutContent.textContent = displayText;
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
		await gameState.controller.gameSleep(.3);
	}
	return Promise.all(animPromises);
}

export async function activate(card) {
	let slot = document.getElementById("field" + gameUI.fieldSlotIndexFromZone(card.zone, card.index)).parentElement;
	slot.classList.add("activating");
	window.setTimeout(function() {
		slot.classList.remove("activating");
	}, gameState.controller.gameSpeed * 1000);
	return new Promise(resolve => setTimeout(resolve, gameState.controller.gameSpeed * 1000));
}