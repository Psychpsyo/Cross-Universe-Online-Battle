// This holds the rng used in spectator games, which simply takes its results from an outside source of truth (= the player we are spectating)

import {CURandom} from "../../rulesEngine/src/random.mjs";

export class SpectateRandom extends CURandom {
	#promiseResolvers = [];
	#nextValues = [];
	constructor() {
		super();
	}
	async nextInt(range) {
		if (this.#nextValues.length === 0) return (await this.#waitForValue())[0];
		return this.#nextValues.shift()[0];
	}
	async nextInts(range) {
		if (this.#nextValues.length === 0) return this.#waitForValue();
		return this.#nextValues.shift();
	}

	// dictates the next value(s) this random will spit out.
	// this should always be an array, even if it has just 1 element for nextInt() in it
	insertValue(value) {
		this.#promiseResolvers.shift()(value);
	}
	async #waitForValue() {
		return new Promise(resolve => {
			this.#promiseResolvers.push(resolve);
		});
	}
}