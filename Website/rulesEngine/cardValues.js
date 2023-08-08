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

	modify(card, toBaseValues) {
		let values = toBaseValues? card.baseValues : card.values;
		ast.setImplicitCard(card);
		for (let modification of this.modifications) {
			if (modification.condition === null || modification.condition.evalFull(this.card, this.player, this.ability)[0]) {
				values = modification.modify(values, this.card, this.player, this.ability, toBaseValues);
			}
		}
		ast.clearImplicitCard();
		return values;
	}

	// converts the modifier to one that won't change when the underlying expressions that derive its values change.
	bake() {
		let bakedModifications = this.modifications.map(modification => modification.bake(this.card, this.player, this.ability)).filter(modification => modification !== null);
		return new CardModifier(bakedModifications, this.card, this.player, this.ability);
	}

	hasAllTargets(card, player, ability) {
		for (let childNode of this.modifications) {
			if (!childNode.hasAllTargets(card, player, ability)) {
				return false;
			}
		}
		return true;
	}
}

export class ValueModification {
	constructor(condition) {
		this.condition = condition;
	}
	modify(values, card, player, ability, toBaseValues) {
		return values;
	}

	bake(card, player, ability) {
		return this;
	}

	hasAllTargets(card, player, ability) {
		return true;
	}
}

export class ValueSetModification extends ValueModification {
	constructor(values, newValue, toBaseValues, condition) {
		super(condition);
		this.values = values;
		this.newValue = newValue;
		this.toBaseValues = toBaseValues;
	}

	modify(values, card, player, ability, toBaseValues) {
		let newValue = this.newValue.evalFull(card, player, ability)[0];
		for (let i = 0; i < this.values.length; i++) {
			if (toBaseValues === this.toBaseValues[i]) {
				if (["level", "attack", "defense"].includes(this.values[i])) {
					values[this.values[i]] = newValue[0];
				} else {
					values[this.values[i]] = newValue;
				}
			}
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.newValue.evalFull(card, player, ability)[0];
		if (valueArray.length == 0) {
			return null;
		}
		return new ValueSetModification(this.values, new ast.ValueArrayNode(valueArray), this.toBaseValues, this.condition);
	}

	hasAllTargets(card, player, ability) {
		return this.newValue.evalFull(card, player, ability)[0].length > 0;
	}
}

export class ValueAppendModification extends ValueModification {
	constructor(values, newValues, toBaseValues, condition) {
		super(condition);
		this.values = values;
		this.newValues = newValues;
		this.toBaseValues = toBaseValues;
	}

	modify(values, card, player, ability, toBaseValues) {
		let newValues = this.newValues.evalFull(card, player, ability)[0];
		for (let i = 0; i < this.values.length; i++) {
			if (toBaseValues === this.toBaseValues[i]) {
				for (let newValue of newValues) {
					if (!values[this.values[i]].includes(newValue)) {
						values[this.values[i]].push(newValue);
					}
				}

			}
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.newValues.evalFull(card, player, ability)[0];
		if (valueArray.length == 0) {
			return null;
		}
		return new ValueAppendModification(this.values, new ast.ValueArrayNode(valueArray), this.toBaseValues, this.condition);
	}

	hasAllTargets(card, player, ability) {
		return this.newValues.evalFull(card, player, ability)[0].length > 0;
	}
}

export class NumericChangeModification extends ValueModification {
	constructor(values, amount, toBaseValues, condition) {
		super(condition);
		this.values = values;
		this.amount = amount;
		this.toBaseValues = toBaseValues;
	}

	modify(values, card, player, ability, toBaseValues) {
		let amount = this.amount.evalFull(card, player, ability)[0][0];
		for (let i = 0; i < this.values.length; i++) {
			if (toBaseValues === this.toBaseValues[i]) {
				values[this.values[i]] = Math.max(0, values[this.values[i]] + amount);
			}
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.amount.evalFull(card, player, ability)[0];
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericChangeModification(this.values, new ast.ValueArrayNode(valueArray), this.toBaseValues, this.condition);
	}

	hasAllTargets(card, player, ability) {
		return this.amount.evalFull(card, player, ability)[0].length > 0;
	}
}

export class NumericDivideModification extends ValueModification {
	constructor(values, byAmount, toBaseValues, condition) {
		super(condition);
		this.values = values;
		this.byAmount = byAmount;
		this.toBaseValues = toBaseValues;
	}

	modify(values, card, player, ability, toBaseValues) {
		let byAmount = this.byAmount.evalFull(card, player, ability)[0][0];
		for (let i = 0; i < this.values.length; i++) {
			if (toBaseValues === this.toBaseValues[i]) {
				values[this.values[i]] = Math.ceil(values[this.values[i]] / byAmount);
			}
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.byAmount.evalFull(card, player, ability)[0];
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericDivideModification(this.values, new ast.ValueArrayNode(valueArray), this.toBaseValues, this.condition);
	}

	hasAllTargets(card, player, ability) {
		return this.byAmount.evalFull(card, player, ability)[0].length > 0;
	}
}

export class ValueSwapModification extends ValueModification {
	constructor(leftValues, rightValues, toBaseValues, condition) {
		super(condition);
		this.leftValues = leftValues;
		this.rightValues = rightValues;
		this.toBaseValues = toBaseValues;
	}

	modify(values, card, player, ability, toBaseValues) {
		for (let i = 0; i < this.leftValues.length; i++) {
			if (toBaseValues === this.toBaseValues[i]) {
				let temp = values[this.leftValues[i]];
				values[this.leftValues[i]] = values[this.rightValues[i]];
				values[this.rightValues[i]] = temp;
			}
		}
		return values;
	}
}
