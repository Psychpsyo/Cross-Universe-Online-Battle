// This module exports the base class for a random number generator to be used by the game.
// To instantiate a game, subclass this class to provide a random number generator that can
// ensure every instance of the game can receive the same random numbers.

export class CURandom {
	nextInt(range) {
		return Math.floor(Math.random() * range);
	}
}