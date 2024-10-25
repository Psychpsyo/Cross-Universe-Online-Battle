// This module exports the base class for any interaction controller, sitting between the UI and the game object.
// This is to allow switching between a manual simulator and an automatic one.

export class InteractionController {
	receiveMessage(command, message, player) {
		return false;
	}

	// fromTheBeginning should be false in cases like spectation, where the game has already advanced.
	async startGame(fromTheBeginning) {}

	// returns whether or not the card was fully grabbed from the zone
	grabCard(player, zone, index) {
		return false;
	}

	dropCard(player, zone, index) {}

	hotkeyPressed(name) {
		return false;
	}
	hotkeyReleased(name) {
		return false;
	}

	syncToSpectator(spectator) {}
}