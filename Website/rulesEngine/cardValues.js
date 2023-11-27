// This file holds definitions for the CardValues class and modifiers for the card's modifier stacks.
import * as ast from "./cdfScriptInterpreter/astNodes.js";
import * as abilities from "./abilities.js";
import {makeAbility} from "./cdfScriptInterpreter/interpreter.js";
import {ScriptContext} from "./cdfScriptInterpreter/structs.js";

export class CardValues {
	constructor(cardTypes, names, level, types, attack, defense, abilities, attackRights, doLifeDamage = true) {
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		this.abilities = abilities;
		this.attackRights = attackRights;
		this.doLifeDamage = doLifeDamage;
	}

	// Clones these values WITHOUT cloning contained abilities by design.
	// This is because usually initial, base and final values are cloned together
	// and shouldn't all get different copies of an ability.
	clone() {
		return new CardValues(
			[...this.cardTypes],
			[...this.names],
			this.level,
			[...this.types],
			this.attack,
			this.defense,
			[...this.abilities],
			this.attackRights,
			this.doLifeDamage
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
					if (
						(property !== "abilities" && this[property][i] !== other[property][i]) ||
						(property === "abilities" && (this[property][i].isCancelled !== other[property][i].isCancelled || this[property][i].id !== other[property][i].id))) {
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
	constructor(modifications, ctx) {
		this.modifications = modifications;
		this.ctx = ctx;
	}

	modify(card, toBaseValues, toUnaffections) {
		let values = toBaseValues? card.baseValues : card.values;
		if (this.ctx.ability instanceof abilities.StaticAbility && this.ctx.ability.isCancelled) {
			return values;
		}
		for (let modification of this.modifications) {
			let worksOnCard = true;
			// only static abilities are influenced by unaffections/cancelling when already on a card
			if (this.ctx.ability instanceof abilities.StaticAbility) {
				ast.setImplicitCard(this.ctx.card);
				for (const unaffection of card.unaffectedBy) {
					if (unaffection.value === modification.value && unaffection.by.evalFull(new ScriptContext(unaffection.sourceCard, this.ctx.player, unaffection.sourceAbility))[0].get(this.ctx.player)) {
						worksOnCard = false;
						break;
					}
				}
				ast.clearImplicitCard();
			}
			ast.setImplicitCard(card);
			if (worksOnCard &&
				(modification instanceof ValueUnaffectedModification || modification instanceof AbilityCancelModification) === toUnaffections &&
				(modification.condition === null || modification.condition.evalFull(this.ctx)[0].get(this.ctx.player))
			) {
				if (modification instanceof ValueUnaffectedModification) {
					card.unaffectedBy.push({
						value: modification.value,
						by: modification.unaffectedBy,
						sourceCard: this.ctx.card,
						sourceAbility: this.ctx.ability
					});
				} else {
					values = modification.modify(values, this.ctx, toBaseValues);
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
	bake(forCard) {
		ast.setImplicitCard(forCard);
		let bakedModifications = this.modifications.map(modification => modification.bake(this.ctx)).filter(modification => modification !== null);
		ast.clearImplicitCard();
		return new CardModifier(bakedModifications, this.ctx);
	}
}

export class ValueModification {
	constructor(value, toBase, condition) {
		this.value = value;
		this.toBase = toBase;
		this.condition = condition;
	}
	modify(values, ctx, toBaseValues) {
		return values;
	}

	bake(ctx) {
		return this;
	}

	isUnitSpecific() {
		return ["attack", "defense", "attackRights"].includes(this.value);
	}

	canApplyTo(target, ctx) {
		// certain stat-changes can only be applied to units
		if (this.isUnitSpecific() && !target.values.cardTypes.includes("unit")) {
			return false;
		}
		// cards that are unaffected can't have modifications applied
		for (const unaffection of target.unaffectedBy) {
			if (unaffection.value === this.value && unaffection.by.evalFull(new ScriptContext(unaffection.sourceCard, ctx.player, unaffection.sourceAbility))[0].get(ctx.player)) {
				return false;
			}
		}
		return true;
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

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let newValue = this.newValue.evalFull(ctx)[0].get(ctx.player);
			if (["level", "attack", "defense"].includes(this.value)) {
				values[this.value] = newValue[0];
			} else {
				values[this.value] = newValue;
			}
		}
		return values;
	}

	bake(ctx) {
		let valueArray = this.newValue.evalFull(ctx)[0].get(ctx.player);
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

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let newValues = this.newValues.evalFull(ctx)[0].get(ctx.player);
			for (let newValue of newValues) {
				// abilities are always put onto cards in an un-cancelled state
				if (this.value === "abilities") {
					newValue.isCancelled = false;
				}
				if (!values[this.value].includes(newValue)) {
					values[this.value].push(newValue);
				}
			}
		}
		return values;
	}

	bake(ctx) {
		let valueArray = this.newValues.evalFull(ctx)[0].get(ctx.player);
		if (valueArray.length == 0) {
			return null;
		}
		// construct ability instances now
		if (this.value === "abilities") {
			valueArray = valueArray.map(val => makeAbility(val.id));
		}
		return new ValueAppendModification(this.value, new ast.ValueArrayNode(valueArray), this.toBase, this.condition);
	}
}

export class NumericChangeModification extends ValueModification {
	constructor(value, amount, toBase, condition) {
		super(value, toBase, condition);
		this.amount = amount;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let amount = this.amount.evalFull(ctx)[0].get(ctx.player)[0];
			values[this.value] = Math.max(0, values[this.value] + amount);
		}
		return values;
	}

	bake(ctx) {
		let valueArray = this.amount.evalFull(ctx)[0].get(ctx.player);
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

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let byAmount = this.byAmount.evalFull(ctx)[0].get(ctx.player)[0];
			values[this.value] = Math.ceil(values[this.value] / byAmount);
		}
		return values;
	}

	bake(ctx) {
		let valueArray = this.byAmount.evalFull(ctx)[0].get(ctx.player);
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

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let temp = values[this.value];
			values[this.value] = values[this.other];
			values[this.other] = temp;
		}
		return values;
	}
}

export class AbilityCancelModification extends ValueModification {
	constructor(value, abilities, toBase, condition) {
		super(value, toBase, condition);
		this.abilities = abilities;
	}

	modify(values, ctx, toBaseValues) {
		for (const toCancel of this.abilities.evalFull(ctx)[0].get(ctx.player)) {
			toCancel.isCancelled = true;
		}
		return values;
	}

	bake(ctx) {
		let abilities = this.abilities.evalFull(ctx)[0].get(ctx.player);
		return new AbilityCancelModification(this.value, new ast.ValueArrayNode(abilities), this.toBase, this.condition);
	}

	canApplyTo(target, ctx) {
		if (!super.canApplyTo(target, ctx)) {
			return false;
		}

		let validAbilities = 0;
		for (const iterAbility of this.abilities.evalFull(ctx)[0].get(ctx.player)) {
			if (iterAbility.cancellable && !iterAbility.isCancelled) {
				validAbilities++;
			}
		}

		return validAbilities > 0;
	}
}