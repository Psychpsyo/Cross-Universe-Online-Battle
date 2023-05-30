// This module exports the base class for any interaction controller, sitting between the UI and the game object.
// This is to allow switching between a manual simulator and an automatic one.

export class InteractionController {
	constructor() {}
	
	receiveMessage(command, message) {
		return false;
	}
	
	grabCard(player, zone, index) {}
	dropCard(player, zone, index) {}
	
	hotkeyPressed(name) {}
}