// This module exports the GameState class which serves as the base class for any distinct state/mode the game can be in.

export class GameState {
	constructor() {
		gameState = this;
	}
	receiveMessage(command, message, player) {
		return false;
	}
	hotkeyPressed(name) {
		return false;
	}
	hotkeyReleased(name) {
		return false;
	}
	syncToSpectator(spectator) {}
}