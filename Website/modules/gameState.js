// This module exports the GameState class which serves as the base class for any distinct state/mode the game can be in.

export class GameState {
	receiveMessage(command, message) {
		return false;
	}
	hotkeyPressed(name) {}
}