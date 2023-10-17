export class ScriptValue {
	constructor(type, value) {
		this.type = type;
		this.isSplit = value instanceof Map;
		this.value = value;
	}

	get(player) {
		return this.isSplit? this.value.get(player) : this.value;
	}

	// TODO: make comparison nodes use this and write functions for other operators
	equals(other, player) {
		if (this.type !== other.type) {
			return false;
		}
		let a = this.get(player);
		let b = other.get(player);
		if (a instanceof BaseCard && b instanceof BaseCard) {
			return a.globalId === b.globalId;
		}
		return a === b;
	}
}