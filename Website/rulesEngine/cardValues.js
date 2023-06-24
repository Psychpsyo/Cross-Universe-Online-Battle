// This file holds definitions for the CardValues class and modifiers for the card's modifier stacks.

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
}

export class ValueModification {
	async modify(values, card, player, ability) {
		return values;
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
		values[this.value] = (await this.newValue.evalFull(card, player, ability))[0];
		return values;
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
}

export class ValueSwapModification extends ValueModification {
	constructor(valueA, valueB, toBaseValues) {
		super();
		this.valueA = valueA;
		this.valueB = valueB;
		this.toBaseValues = toBaseValues;
	}
	async modify(values) {
		let temp = values[valueA];
		values[this.valueA] = values[this.valueB];
		values[this.valueB] = temp;
		return values;
	}
}
