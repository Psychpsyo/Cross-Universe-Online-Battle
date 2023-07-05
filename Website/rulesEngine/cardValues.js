// This file holds definitions for the CardValues class and modifiers for the card's modifier stacks.
import * as ast from "./cdfScriptInterpreter/astNodes.js";

export class CardValues {
	constructor(cardTypes, names, level, types, attack, defense, abilities) {
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		this.abilities = abilities;
	}

	clone() {
		return new CardValues(
			[...this.cardTypes],
			[...this.names],
			this.level,
			[...this.types],
			this.attack,
			this.defense,
			[...this.abilities]
		);
	}

	// returns a list of all properties that are different between this and other
	compareTo(other) {
		let differences = [];
		for (let property of ["level", "attack", "defense"]) {
			if (this[property] != other[property]) {
				differences.push(property);
			}
		}

		for (let property of ["cardTypes", "names", "types", "abilities"]) {
			if (this[property].length != other[property].length) {
				differences.push(property);
			} else {
				for (let i = 0; i < this[property].length; i++) {
					if (this[property][i] != other[property][i]) {
						differences.push(property);
						break;
					}
				}
			}
		}
		return differences;
	}
}

export class CardModifier {
	constructor(modifications, card, player, ability) {
		this.modifications = modifications;
		this.card = card;
		this.player = player;
		this.ability = ability;
	}

	async modify(values, isBaseValues) {
		for (let modification of this.modifications) {
			if (isBaseValues == modification.toBaseValues) {
				values = await modification.modify(values, this.card, this.player, this.ability);
			}
		}
		return values;
	}

	// converts the modifier to one that won't change when the underlying expressions that derive its values change.
	async bake() {
		let bakedModifications = (await Promise.allSettled(this.modifications.map(async modification => modification.bake(this.card, this.player, this.ability)))).map(fulfillment => fulfillment.value).filter(modification => modification !== null);
		return new CardModifier(bakedModifications, this.card, this.player, this.ability);
	}

	async hasAllTargets(card, player, ability) {
		for (let childNode of this.modifications) {
			if (!(await childNode.hasAllTargets(card, player, ability))) {
				return false;
			}
		}
		return true;
	}
}

export class ValueModification {
	async modify(values, card, player, ability) {
		return values;
	}

	async bake(card, player, ability) {
		return this;
	}

	async hasAllTargets(card, player, ability) {
		return true;
	}
}

export class ValueSetModification extends ValueModification {
	constructor(value, newValue, toBaseValues) {
		super();
		this.value = value;
		this.newValue = newValue;
		this.toBaseValues = toBaseValues;
	}

	async modify(values, card, player, ability) {
		if (["level", "attack", "defense"].includes(this.value)) {
			values[this.value] = (await this.newValue.evalFull(card, player, ability))[0];
		} else {
			values[this.value] = (await this.newValue.evalFull(card, player, ability));
		}
		return values;
	}

	async bake(card, player, ability) {
		let valueArray = await this.newValue.evalFull(card, player, ability);
		if (valueArray.length == 0) {
			return null;
		}
		return new ValueSetModification(this.value, new ast.ValueArrayNode(valueArray), this.toBaseValues);
	}

	async hasAllTargets(card, player, ability) {
		return (await this.newValue.evalFull(card, player, ability)).length > 0;
	}
}

export class ValueAppendModification extends ValueModification {
	constructor(value, newValues, toBaseValues) {
		super();
		this.value = value;
		this.newValues = newValues;
		this.toBaseValues = toBaseValues;
	}

	async modify(values, card, player, ability) {
		for (let newValue of await this.newValues.evalFull(card, player, ability)) {
			if (!values[this.value].includes(newValue)) {
				values[this.value].push(newValue);
			}
		}
		return values;
	}

	async bake(card, player, ability) {
		let valueArray = await this.newValues.evalFull(card, player, ability);
		if (valueArray.length == 0) {
			return null;
		}
		return new ValueAppendModification(this.value, new ast.ValueArrayNode(valueArray), this.toBaseValues);
	}

	async hasAllTargets(card, player, ability) {
		return (await this.newValues.evalFull(card, player, ability)).length > 0;
	}
}

export class NumericChangeModification extends ValueModification {
	constructor(value, amount, toBaseValues) {
		super();
		this.value = value;
		this.amount = amount;
		this.toBaseValues = toBaseValues;
	}

	async modify(values, card, player, ability) {
		values[this.value] = Math.max(0, values[this.value] + (await this.amount.evalFull(card, player, ability))[0]);
		return values;
	}

	async bake(card, player, ability) {
		let valueArray = await this.amount.evalFull(card, player, ability);
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericChangeModification(this.value, new ast.ValueArrayNode(valueArray), this.toBaseValues);
	}

	async hasAllTargets(card, player, ability) {
		return (await this.amount.evalFull(card, player, ability)).length > 0;
	}
}

export class NumericDivideModification extends ValueModification {
	constructor(value, byAmount, toBaseValues) {
		super();
		this.value = value;
		this.byAmount = byAmount;
		this.toBaseValues = toBaseValues;
	}

	async modify(values, card, player, ability) {
		values[this.value] = Math.ceil(values[this.value] / (await this.byAmount.evalFull(card, player, ability))[0]);
		return values;
	}

	async bake(card, player, ability) {
		let valueArray = await this.byAmount.evalFull(card, player, ability);
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericDivideModification(this.value, new ast.ValueArrayNode(valueArray), this.toBaseValues);
	}

	async hasAllTargets(card, player, ability) {
		return (await this.byAmount.evalFull(card, player, ability)).length > 0;
	}
}

export class ValueSwapModification extends ValueModification {
	constructor(valueA, valueB, toBaseValues) {
		super();
		this.valueA = valueA;
		this.valueB = valueB;
		this.toBaseValues = toBaseValues;
	}

	async modify(values) {
		let temp = values[this.valueA];
		values[this.valueA] = values[this.valueB];
		values[this.valueB] = temp;
		return values;
	}
}
