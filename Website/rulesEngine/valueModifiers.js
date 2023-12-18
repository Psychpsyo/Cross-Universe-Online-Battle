// This file holds definitions for the CardValues class and modifiers for the card's modifier stacks.
import * as ast from "./cdfScriptInterpreter/astNodes.js";
import * as abilities from "./abilities.js";
import {BaseCard} from "./card.js";
import {makeAbility} from "./cdfScriptInterpreter/interpreter.js";
import {ScriptContext} from "./cdfScriptInterpreter/structs.js";

export function recalculateModifiedValuesFor(object) {
	// for cards, all abilities need to be un-cancelled as a baseline
	if (object instanceof BaseCard) {
		for (const ability of object.values.initial.abilities) {
			ability.isCancelled = false;
		}
	}

	// handle values being unaffected by cards
	object.values.unaffectedBy = [];
	for (const modifier of object.values.modifierStack) {
		modifier.modify(object, false, true);
	}

	// handle base value changes
	object.values.base = object.values.initial.clone();
	for (const modifier of object.values.modifierStack) {
		object.values.base = modifier.modify(object, true, false);
	}

	// non-unit cards need to loose unit-specific base values
	if (object instanceof BaseCard) {
		if (!object.values.base.cardTypes.includes("unit")) {
			object.values.base.attack = null;
			object.values.base.defense = null;
			object.values.base.attackRights = null;
			object.values.base.canAttack = null;
			object.values.base.canCounterAttack = null;
		}
	}

	// handle main value changes
	object.values.current = object.values.base.clone();
	for (const modifier of object.values.modifierStack) {
		object.values.current = modifier.modify(object, false, false);
	}

	// non-unit cards also need to loose unit-specific regular values
	if (object instanceof BaseCard) {
		if (!object.values.current.cardTypes.includes("unit")) {
			object.values.current.attack = null;
			object.values.current.defense = null;
			object.values.current.attackRights = null;
			object.values.current.canAttack = null;
			object.values.current.canCounterAttack = null;
		}
	}
}

export class Modifier {
	constructor(modifications, ctx) {
		this.modifications = modifications;
		this.ctx = ctx;
	}

	modify(object, toBaseValues, toUnaffections) {
		let values = toBaseValues? object.values.base : object.values.current;
		if (this.ctx.ability instanceof abilities.StaticAbility && this.ctx.ability.isCancelled) {
			return values;
		}
		for (let modification of this.modifications) {
			if (!(modification instanceof ValueModification)) {
				continue;
			}
			let worksOnObject = true;
			// only static abilities are influenced by unaffections/cancelling when already on a card
			if (this.ctx.ability instanceof abilities.StaticAbility) {
				ast.setImplicit([this.ctx.card], "card");
				for (const unaffection of object.values.unaffectedBy) {
					if (unaffection.value === modification.value && unaffection.by.evalFull(new ScriptContext(unaffection.sourceCard, this.ctx.player, unaffection.sourceAbility))[0].get(this.ctx.player)) {
						worksOnObject = false;
						break;
					}
				}
				ast.clearImplicit("card");
			}
			// set implicit card / player
			ast.setImplicit([object], object.cdfScriptType);
			if (worksOnObject &&
				(modification instanceof ValueUnaffectedModification || modification instanceof AbilityCancelModification) === toUnaffections &&
				(modification.condition === null || modification.condition.evalFull(this.ctx)[0].get(this.ctx.player))
			) {
				if (modification instanceof ValueUnaffectedModification) {
					object.values.unaffectedBy.push({
						value: modification.value,
						by: modification.unaffectedBy,
						sourceCard: this.ctx.card,
						sourceAbility: this.ctx.ability
					});
				} else {
					values = modification.modify(values, this.ctx, toBaseValues);
				}
			}
			// clear implicit card / player
			ast.clearImplicit(object.cdfScriptType);
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
	bake(target) {
		ast.setImplicit([target], target.cdfScriptType);
		const bakedModifications = this.modifications.map(modification => modification.bake(this.ctx)).filter(modification => modification !== null);
		ast.clearImplicit(target.cdfScriptType);
		return new Modifier(bakedModifications, this.ctx);
	}

	bakeStatic(target) {
		ast.setImplicit([target], target.cdfScriptType);
		const bakedModifications = this.modifications.map(modification => modification.bakeStatic(this.ctx)).filter(modification => modification !== null);
		ast.clearImplicit(target.cdfScriptType);
		return new Modifier(bakedModifications, this.ctx);
	}
}

export class Modification {
	constructor(condition) {
		this.condition = condition;
	}

	bake(ctx) {
		return this;
	}

	// bakes a modifier for a static ability. (i.e. does not pre-compute expressions, only creates things like ability objects from their IDs)
	bakeStatic(ctx) {
		return this;
	}

	isUnitSpecific() {
		return false;
	}

	canApplyTo(target, ctx) {
		return true;
	}
	canFullyApplyTo(target, ctx) {
		return this.canApplyTo(target, ctx);
	}
}

export class ValueModification extends Modification {
	constructor(value, toBase, condition) {
		super(condition);
		this.value = value;
		this.toBase = toBase;
	}
	modify(values, ctx, toBaseValues) {
		return values;
	}

	isUnitSpecific() {
		return ["attack", "defense", "attackRights", "canAttack", "canCounterattack"].includes(this.value);
	}

	canApplyTo(target, ctx) {
		// this function is only really concerned with applying non-unit values to units.
		if (!target instanceof BaseCard) return true;
		// certain stat-changes can only be applied to units
		if (this.isUnitSpecific() && !target.values.current.cardTypes.includes("unit")) {
			return false;
		}
		// cards that are unaffected can't have modifications applied
		for (const unaffection of target.values.unaffectedBy) {
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
			const newValues = this.newValues.evalFull(ctx)[0].get(ctx.player);
			for (const newValue of newValues) {
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
		let valueArray = this.newValues.evalFull(ctx)[0];
		const type = valueArray.type;
		valueArray = valueArray.get(ctx.player);
		if (valueArray.length == 0) {
			return null;
		}
		// construct ability instances now
		if (this.value === "abilities") {
			valueArray = valueArray.map(val => makeAbility(type === "abilityId"? val : val.id));
		}
		return new ValueAppendModification(this.value, new ast.ValueArrayNode(valueArray, type), this.toBase, this.condition);
	}

	bakeStatic(ctx) {
		let valueArray = this.newValues.evalFull(ctx)[0];
		if (valueArray.type != "abilityId") return this;
		const type = valueArray.type;
		valueArray = valueArray.get(ctx.player).map(val => makeAbility(type === "abilityId"? val : val.id));
		return new ValueAppendModification(this.value, new ast.ValueArrayNode(valueArray, type), this.toBase, this.condition);
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
	canFullyApplyTo(target, ctx) {
		if (!this.canApplyTo(target, ctx)) return false;
		if (target.values.current[this.value] + this.amount.evalFull(ctx)[0].get(ctx.player)[0] < 0) return false;
		return true;
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
		if (!super.canApplyTo(target, ctx)) return false;

		let validAbilities = 0;
		for (const iterAbility of this.abilities.evalFull(ctx)[0].get(ctx.player)) {
			if (iterAbility.cancellable && !iterAbility.isCancelled) {
				validAbilities++;
			}
		}
		return validAbilities > 0;
	}
	canFullyApplyTo(target, ctx) {
		if (!this.canApplyTo(target, ctx)) return false;

		for (const iterAbility of this.abilities.evalFull(ctx)[0].get(ctx.player)) {
			if (!iterAbility.cancellable || iterAbility.isCancelled) {
				return false;
			}
		}
		return true;
	}
}

export class ActionReplaceModification extends Modification {
	constructor(toReplace, replacement, condition) {
		super(condition);
		this.toReplace = toReplace;
		this.replacement = replacement;
	}
}