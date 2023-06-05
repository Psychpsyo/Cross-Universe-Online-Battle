// this file holds all the code needed for UI that is required during automatic games.

import {locale} from "/modules/locale.js";

let currentActivePhase = null;
let currentTurn = 0;

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
	
	controlPanel.removeAttribute("hidden");
}

export function startPhase(type) {
	phaseDisplay.removeAttribute("hidden");
	currentActivePhase?.classList.remove("current");
	switch(type) {
		case "manaSupplyPhase": {
			currentActivePhase = manaSupplyPhaseIndicator;
			break;
		}
		case "drawPhase": {
			currentActivePhase = drawPhaseIndicator;
			break;
		}
		case "mainPhase": {
			currentActivePhase = currentActivePhase == drawPhaseIndicator? firstMainPhaseIndicator : secondMainPhaseIndicator;
			break;
		}
		case "battlePhase": {
			currentActivePhase = battlePhaseIndicator;
			break;
		}
		case "endPhase": {
			currentActivePhase = endPhaseIndicator;
			break;
		}
	}
	currentActivePhase.classList.add("current");
}

export function startTurn() {
	currentTurn++;
	currentActivePhase?.classList.remove("current");
	currentActivePhase = null;
	if (currentTurn == 2) {
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