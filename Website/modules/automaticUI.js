// this file holds all the code needed for UI that is required during automatic games.

let currentActivePhase = null;
let currentTurn = 0;

export function init() {
	Array.from(document.querySelectorAll(".manualOnly")).forEach(elem => elem.remove());
	
	passBtn.addEventListener("click", function() {
		this.disabled = true;
	});
	
	controlPanel.removeAttribute("hidden");
}

export function startPhase(type) {
	phaseDisplay.removeAttribute("hidden");
	currentActivePhase?.classList.remove("current");
	switch(type) {
		case "manaSupplyPhase": {
			currentActivePhase = ManaSupplyPhaseIndicator;
			break;
		}
		case "drawPhase": {
			currentActivePhase = DrawPhaseIndicator;
			break;
		}
		case "mainPhase": {
			currentActivePhase = currentActivePhase == DrawPhaseIndicator? FirstMainPhaseIndicator : SecondMainPhaseIndicator;
			break;
		}
		case "battlePhase": {
			currentActivePhase = BattlePhaseIndicator;
			break;
		}
		case "endPhase": {
			currentActivePhase = EndPhaseIndicator;
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
		BattlePhaseIndicator.classList.remove("invalid");
		SecondMainPhaseIndicator.classList.remove("invalid");
	}
}

export function indicatePass() {
	passBtn.disabled = false;
}