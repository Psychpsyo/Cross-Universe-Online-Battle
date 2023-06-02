// This file holds definitions for the CardValue class which represents a single value on a card, with it's modifier stack.

class Value {
	get() {}
	getBase() {}
}

export class CardValue extends Value {
	constructor(baseValue) {
		super();
		this.baseValue = baseValue;
	}
	
	get() {
		return this.baseValue;
	}
	getBase() {
		return this.baseValue;
	}
}

export class SnapshotValue extends Value {
	constructor(value, baseValue) {
		super();
		this.value = value;
		this.baseValue = baseValue;
	}
	
	get() {
		return this.value;
	}
	getBase() {
		return this.baseValue;
	}
}