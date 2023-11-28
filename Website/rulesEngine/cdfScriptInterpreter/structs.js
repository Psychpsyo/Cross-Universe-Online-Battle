import {BaseCard} from "../card.js";

export class ScriptValue {
	constructor(type, value) {
		this.type = type;
		this.isSplit = value instanceof Map;
		this.value = value;
	}

	// Returns the given player's version of this value.
	get(player) {
		return this.isSplit? this.value.get(player) : this.value;
	}

	// Returns this value as a single number.
	// The 'any' value is represented by infinity, non-number values by NaN.
	getJsNum(player) {
		let val = this.get(player);
		if (val === "any") return Infinity;
		if (typeof val[0] === "number") return val[0];
		return NaN;
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

// This is an execution context for cdfScript
// Ability may be null but card and player are guaranteed to always exist
export class ScriptContext {
	constructor(card, player, ability = null, evaluatingPlayer = null) {
		this.game = player.game; // just for convenience
		this.card = card; // The card that the portion of script currently resides on
		this.player = player; // The player executing the script
		this.evaluatingPlayer = evaluatingPlayer; // The player evaluating the script (cards may be hidden from the script like this)
		this.ability = ability; // The ability that the script belongs to
	}
}

export class DeckPosition {
	constructor(deck, isTop) {
		this.deck = deck;
		this.isTop = isTop;
	}
}