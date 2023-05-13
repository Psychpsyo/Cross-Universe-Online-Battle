// This module exports the Gamestate class which serves as the base class for any distinct state/mode the game can be in.

export class Gamestate {
	receiveMessage(command, message) {
		return false;
	}
}