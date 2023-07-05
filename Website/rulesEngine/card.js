// This module exports the Card class which represents a specific card in a Game.

import {CardValues} from "./cardValues.js";
import * as abilities from "./abilities.js";

class BaseCard {
	constructor(player, cardId, hidden, initialValues) {
		this.owner = player;
		this.cardId = cardId;
		this.hidden = hidden;

		this.initialValues = initialValues;
		this.values = initialValues;
		this.baseValues = initialValues;
		this.modifierStack = [];

		this.zone = null;
		this.index = -1;
		this.attackCount = 0;
		this.isAttacking = false;
		this.isAttackTarget = false;
		this.inRetire = null;
		this.cardRef = this;
	}

	sharesTypeWith(card) {
		let ownTypes = this.values.types;
		for (let type of card.values.types) {
			if (ownTypes.includes(type)) {
				return true;
			}
		}
		return false;
	}

	async recalculateModifiedValues() {
		this.baseValues = this.initialValues.clone();
		for (let modifier of this.modifierStack) {
			this.baseValues = await modifier.modify(this.baseValues, true);
		}
		this.values = this.baseValues.clone();
		for (let modifier of this.modifierStack) {
			this.values = await modifier.modify(this.values, false);
		}
	}

	static sort(a, b) {
		if (a.cardId < b.cardId) {
			return -1;
		}
		if (a.cardId > b.cardId) {
			return 1;
		}
		return 0;
	}
}

export class Card extends BaseCard {
	constructor(player, cdf, hidden) {
		let data = parseCdfValues(cdf);
		let baseCardTypes = [data.cardType];
		if (data.cardType == "token") {
			baseCardTypes.push("unit");
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
			baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
			baseCardTypes.push("item");
		}
		super(player, data.id, hidden,
			new CardValues(
				baseCardTypes,
				[data.name ?? data.id],
				data.level ?? 0,
				data.types ?? [],
				data.attack ?? 0,
				data.defense ?? 0,
				data.abilities.map(makeAbility)
			)
		);
	}

	snapshot() {
		return new SnapshotCard(this);
	}

	endOfTurnReset() {
		this.attackCount = 0;
		for (let ability of this.values.abilities) {
			if (ability instanceof abilities.OptionalAbility || ability instanceof abilities.FastAbility || ability instanceof abilities.TriggerAbility) {
				ability.activationCount = 0;
			}
		}
	}
}

// a card with all its values frozen so it can be held in internal logs of what Actions happened in a Timing.
class SnapshotCard extends BaseCard {
	constructor(card) {
		super(card.owner, card.cardId, card.hidden, card.initialValues.clone());

		this.values = card.values.clone();
		this.baseValues = card.baseValues.clone();
		this.modifierStack = [...card.modifierStack];

		let abilities = this.initialValues.abilities;
		for (let ability of this.baseValues.abilities.concat(this.values.abilities)) {
			if (!abilities.includes(ability)) {
				abilities.push(ability);
			}
		}
		let abilitySnapshots = abilities.map(ability => ability.snapshot());
		this.initialValues.abilities = this.initialValues.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
		this.baseValues.abilities = this.baseValues.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
		this.values.abilities = this.values.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);

		this.zone = card.zone;
		this.index = card.index;
		this.attackCount = card.attackCount;
		this.isAttacking = card.isAttacking;
		this.isAttackTarget = card.isAttackTarget;
		this.inRetire = card.inRetire;
		this.cardRef = card;
	}

	restore() {
		// tokens might need to be restored back to non-existance
		if (this.zone === null) {
			this.cardRef.zone.remove(this.cardRef);
			return;
		}
		this.zone.add(this.cardRef, this.index);

		this.cardRef.initialValues = this.initialValues;
		this.cardRef.values = this.values;
		this.cardRef.baseValues = this.baseValues;
		this.cardRef.modifierStack = this.modifierStack;

		this.cardRef.hidden = this.hidden;
		this.cardRef.attackCount = this.attackCount;
		this.cardRef.isAttackTarget = this.isAttackTarget;
		this.cardRef.isAttacking = this.isAttacking;
		if (this.isAttackTarget) {
			this.owner.game.currentAttackDeclaration.target = this.cardRef;
		}
		if (this.isAttacking) {
			if (this.owner.game.currentAttackDeclaration.attackers.indexOf(this.cardRef) == -1) {
				this.owner.game.currentAttackDeclaration.attackers.push(this.cardRef);
			}
		}
		this.cardRef.inRetire = this.inRetire;
		if (this.inRetire) {
			this.inRetire.units.push(this.cardRef);
		}
	}
}

function parseCdfValues(cdf) {
	let data = {
		abilities: []
	};
	let lines = cdf.replaceAll("\r", "").split("\n");
	let inAbility = false;
	let abilitySection = "";
	for (let line of lines) {
		let parts = line.split(/:(.*)/).map(part => part.trim());
		if (inAbility && parts[0] != "o") {
			let ability = data.abilities[data.abilities.length - 1];
			switch (parts[0]) {
				case "turnLimit": {
					ability.turnLimit = parseInt(parts[1]);
					break;
				}
				case "condition": {
					ability.condition = parts[1];
					break;
				}
				case "after": {
					if (!["trigger", "cast", "deploy"].includes(ability.type)) {
						throw new Error("CDF Parser Error: " + ability.type + " abilities can't have an 'after' clause.");
					}
					if (ability.duringPhase) {
						throw new Error("CDF Parser Error: 'after' and 'duringPhase' clauses are mutually exclusive.");
					}
					ability.after = parts[1];
					break;
				}
				case "duringPhase": {
					if (ability.type != "trigger") {
						throw new Error("CDF Parser Error: Only trigger abilities have phase restrictions.");
					}
					if (ability.after) {
						throw new Error("CDF Parser Error: 'after' and 'duringPhase' clauses are mutually exclusive.");
					}
					if (!["manaSupplyPhase", "drawPhase", "mainPhase", "mainPhase1", "battlePhase", "mainPhase2", "endPhase",
						"yourManaSupplyPhase", "yourDrawPhase", "yourMainPhase", "yourMainPhase1", "yourBattlePhase", "yourMainPhase2", "yourEndPhase",
						"opponentManaSupplyPhase", "opponentDrawPhase", "opponentMainPhase", "opponentMainPhase1", "opponentBattlePhase", "opponenetMainPhase2", "opponentEndPhase"
					].includes(parts[1])) {
						throw new Error("CDF Parser Error: 'duringPhase' must be a valid phase identifier.");
					}
					ability.duringPhase = parts[1];
					break;
				}
				case "mandatory": {
					if (ability.type != "trigger") {
						throw new Error("CDF Parser Error: Only trigger abilities can be mandatory.");
					}
					if (!["yes", "no"].includes(parts[1])) {
						throw new Error("CDF Parser Error: 'mandatory' must be either 'yes' or 'no'.");
					}
					ability.mandatory = parts[1] == "yes";
					break;
				}
				case "cost": {
					abilitySection = "cost";
					ability.cost = "";
					break;
				}
				case "exec": {
					abilitySection = "exec";
					ability.exec = "";
					break;
				}
				case "applyTo": {
					if (ability.type != "static") {
						throw new Error("CDF Parser Error: Only static abilities have a 'applyTo' clause.");
					}
					ability.applyTo = parts[1];
					break;
				}
				case "modifier": {
					if (ability.type != "static") {
						throw new Error("CDF Parser Error: Only static abilities have a 'modifier' clause.");
					}
					ability.modifier = parts[1];
					break;
				}
				default: {
					if (ability[abilitySection].length > 0) {
						ability[abilitySection] += "\n";
					}
					ability[abilitySection] += line;
				}
			}
			continue;
		}
		switch(parts[0]) {
			case "id": {
				data.id = parts[1].substring(2);
				break;
			}
			case "cardType": {
				if (!["unit", "token", "standardSpell", "continuousSpell", "enchantSpell", "standardItem", "continuousItem", "equipableItem"].includes(parts[1])) {
					throw new Error("CDF Parser Error: " + parts[0] + " is an invalid card type.");
				}
				data.cardType = parts[1];
				break;
			}
			case "name": {
				data.name = parts[1].substring(2);
				break;
			}
			case "level": {
				data.level = parseInt(parts[1]);
				break;
			}
			case "types": {
				data.types = parts[1].split(",").map(type => type.trim()).filter(type => type != "");
				break;
			}
			case "attack": {
				data.attack = parseInt(parts[1]);
				break;
			}
			case "defense": {
				data.defense = parseInt(parts[1]);
				break;
			}
			case "o": {
				if (!["cast", "deploy", "optional", "fast", "trigger", "static"].includes(parts[1])) {
					throw new Error("CDF Parser Error: " + parts[0] + " is an invalid ability type.");
				}
				data.abilities.push({
					id: data.id + ":" + data.abilities.length,
					type: parts[1],
					turnLimit: Infinity,
					duringPhase: null,
					after: null,
					condition: null,
					exec: "",
					applyTo: "",
					modifier: ""
				});
				inAbility = true;
				abilitySection = "exec";
				break;
			}
			default: {
				throw new Error("CDF Parser Error: " + parts[0] + " is not a valid card attribute.");
			}
		}
	}
	return data;
}

function makeAbility(ability) {
	switch (ability.type) {
		case "cast": {
			return new abilities.CastAbility(ability.id, ability.exec, ability.cost, ability.condition, ability.after);
		}
		case "deploy": {
			return new abilities.DeployAbility(ability.id, ability.exec, ability.cost, ability.condition, ability.after);
		}
		case "optional": {
			return new abilities.OptionalAbility(ability.id, ability.exec, ability.cost, ability.turnLimit, ability.condition);
		}
		case "fast": {
			return new abilities.FastAbility(ability.id, ability.exec, ability.cost, ability.turnLimit, ability.condition);
		}
		case "trigger": {
			return new abilities.TriggerAbility(ability.id, ability.exec, ability.cost, ability.mandatory, ability.turnLimit, ability.duringPhase, ability.after, ability.condition);
		}
		case "static": {
			return new abilities.StaticAbility(ability.id, ability.modifier, ability.applyTo, ability.condition);
		}
	}
}