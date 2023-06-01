// This file holds definitions for the CardValue class which represents a single value on a card, with it's modifier stack.

export class CardValue {
	constructor(baseValue) {
		this.baseValue = baseValue;
	}
	
	get() {
		return this.baseValue;
	}
	
	getBase() {
		return this.baseValue;
	}
}