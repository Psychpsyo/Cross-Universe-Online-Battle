// This module defines the Player class which holds all data relevant to one player in a game.
// TODO: migrate missing data from global variables into this file.

export class Player {
	constructor(index) {
		this.index = index;
		this.mana = 0;
		this.life = 1000;
		
		this.lastCustomCard = index + 1;
	}
}