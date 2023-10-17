// This file holds definitions for the CardValues class and modifiers for the card's modifier stacks.
import * as ast from "./cdfScriptInterpreter/astNodes.js";

export class CardValues {
	constructor(cardTypes, names, level, types, attack, defense, abilities, attackRights) {
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		this.abilities = abilities;
		this.attackRights = attackRights;
	}

	clone() {
		return new CardValues(
			[...this.cardTypes],
			[...this.names],
			this.level,
			[...this.types],
			this.attack,
			this.defense,
			[...this.abilities],
			this.attackRights
		);
	}

	// returns a list of all properties that are different between this and other
	compareTo(other) {
		let differences = [];
		for (let property of ["level", "attack", "defense", "attackRights"]) {
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

	modify(card, toBaseValues, unaffections, toUnaffections) {
		let values = toBaseValues? card.baseValues : card.values;
		for (let modification of this.modifications) {
			let worksOnCard = true;
			ast.setImplicitCard(this.card);
			for (const unaffection of unaffections) {
				if (unaffection.value === modification.value && unaffection.by.evalFull(unaffection.sourceCard, this.player, unaffection.sourceAbility)[0].get(this.player)) {
					worksOnCard = false;
					break;
				}
			}
			ast.clearImplicitCard();
			ast.setImplicitCard(card);
			if (worksOnCard &&
				modification instanceof ValueUnaffectedModification === toUnaffections &&
				(modification.condition === null || modification.condition.evalFull(this.card, this.player, this.ability)[0].get(this.player))
			) {
				if (toUnaffections) {
					unaffections.push({
						value: modification.value,
						by: modification.unaffectedBy,
						sourceCard: this.card,
						sourceAbility: this.ability
					});
				} else {
					values = modification.modify(values, this.card, this.player, this.ability, toBaseValues);
				}
			}
			ast.clearImplicitCard();
		}
		return values;
	}

	// Removes all unit-specific modifications from this modifier and returns true if that empties the modifier entirely.
	// This is for cleaning up the modifier stack on cards that ceased being units.
	removeUnitSpecificModifications() {
		for (let i = this.modifications.length - 1; i >= 0; i--) {
			if (this.modifications[i].isUnitSpecific()) {
				this.modifications.splice(i, 1);
			}
		}
		return this.modifications.length === 0;
	}

	// converts the modifier to one that won't change when the underlying expressions that derive its values change.
	bake() {
		let bakedModifications = this.modifications.map(modification => modification.bake(this.card, this.player, this.ability)).filter(modification => modification !== null);
		return new CardModifier(bakedModifications, this.card, this.player, this.ability);
	}
}

export class ValueModification {
	constructor(value, toBase, condition) {
		this.value = value;
		this.toBase = toBase;
		this.condition = condition;
	}
	modify(values, card, player, ability, toBaseValues) {
		return values;
	}

	bake(card, player, ability) {
		return this;
	}

	isUnitSpecific() {
		return ["attack", "defense", "attackRights"].includes(this.value);
	}
}

export class ValueUnaffectedModification extends ValueModification {
	constructor(value, unaffectedBy, toBase, condition) {
		super(value, toBase, condition);
		this.unaffectedBy = unaffectedBy;
	}

	// Note: baking this currently isn't needed by any card.
	// If it becomes necessary there would need to be a rules
	// clarification on whether or not the cards something
	// is unaffected by should be baked at application time
	// or not.
}

export class ValueSetModification extends ValueModification {
	constructor(value, newValue, toBase, condition) {
		super(value, toBase, condition);
		this.newValue = newValue;
	}

	modify(values, card, player, ability, toBaseValues) {
		let newValue = this.newValue.evalFull(card, player, ability)[0].get(player);
		if (toBaseValues === this.toBase) {
			if (["level", "attack", "defense"].includes(this.value)) {
				values[this.value] = newValue[0];
			} else {
				values[this.value] = newValue;
			}
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.newValue.evalFull(card, player, ability)[0].get(player);
		if (valueArray.length == 0) {
			return null;
		}
		return new ValueSetModification(this.value, new ast.ValueArrayNode(valueArray), this.toBase, this.condition);
	}
}

export class ValueAppendModification extends ValueModification {
	constructor(value, newValues, toBase, condition) {
		super(value, toBase, condition);
		this.newValues = newValues;
	}

	modify(values, card, player, ability, toBaseValues) {
		let newValues = this.newValues.evalFull(card, player, ability)[0].get(player);
		if (toBaseValues === this.toBase) {
			for (let newValue of newValues) {
				if (!values[this.value].includes(newValue)) {
					values[this.value].push(newValue);
				}
			}
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.newValues.evalFull(card, player, ability)[0].get(player);
		if (valueArray.length == 0) {
			return null;
		}
		return new ValueAppendModification(this.value, new ast.ValueArrayNode(valueArray), this.toBase, this.condition);
	}
}

export class NumericChangeModification extends ValueModification {
	constructor(value, amount, toBase, condition) {
		super(value, toBase, condition);
		this.amount = amount;
	}

	modify(values, card, player, ability, toBaseValues) {
		let amount = this.amount.evalFull(card, player, ability)[0].get(player)[0];
		if (toBaseValues === this.toBase) {
			values[this.value] = Math.max(0, values[this.value] + amount);
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.amount.evalFull(card, player, ability)[0].get(player);
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericChangeModification(this.value, new ast.ValueArrayNode(valueArray), this.toBase, this.condition);
	}
}

export class NumericDivideModification extends ValueModification {
	constructor(value, byAmount, toBase, condition) {
		super(value, toBase, condition);
		this.byAmount = byAmount;
	}

	modify(values, card, player, ability, toBaseValues) {
		let byAmount = this.byAmount.evalFull(card, player, ability)[0].get(player)[0];
		if (toBaseValues === this.toBase) {
			values[this.value] = Math.ceil(values[this.value] / byAmount);
		}
		return values;
	}

	bake(card, player, ability) {
		let valueArray = this.byAmount.evalFull(card, player, ability)[0].get(player);
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericDivideModification(this.value, new ast.ValueArrayNode(valueArray), this.toBase, this.condition);
	}
}

export class ValueSwapModification extends ValueModification {
	constructor(value, other, toBase, condition) {
		super(value, toBase, condition);
		this.other = other;
	}

	modify(values, card, player, ability, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let temp = values[this.value];
			values[this.value] = values[this.other];
			values[this.other] = temp;
		}
		return values;
	}
}
