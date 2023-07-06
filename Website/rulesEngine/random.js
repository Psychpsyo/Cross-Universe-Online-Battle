// This module exports the base class for a random number generator to be used by the game.
// This can be used to make sure multiple games can run together and receive the same random numbers.

export class CURandom {
	async nextInt(range) {
		return Math.floor(Math.random() * range);
	}

	async nextInts(ranges) {
		return ranges.map(range => this.nextInt(range));
	}

	async nextPlayer(game) {
		return await this.nextInt(game.players.length);
	}
}