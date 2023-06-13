// This module exports the Card class which represents a specific card in a Game.

import {CardValue, SnapshotValue} from "./cardValue.js";
import * as abilities from "./abilities.js";

class BaseCard {
	constructor(player, cardId, hidden, cardTypes, names, level, types, attack, defense, abilities) {
		this.owner = player;
		this.cardId = cardId;
		this.hidden = hidden;
		
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		this.abilities = abilities;
		
		this.zone = null;
		this.index = -1;
		this.attackCount = 0;
		this.cardRef = this;
	}

	sharesTypeWith(card) {
		let ownTypes = this.types.get();
		for (let type of card.types.get()) {
			if (ownTypes.includes(type)) {
				return true;
			}
		}
		return false;
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
			new CardValue(baseCardTypes),
			new CardValue([data.name ?? data.id]),
			new CardValue(data.level ?? 0),
			new CardValue(data.types ?? []),
			new CardValue(data.attack ?? 0),
			new CardValue(data.defense ?? 0),
			new CardValue(data.abilities.map(makeAbility))
		);
	}

	snapshot() {
		return new SnapshotCard(this);
	}

	endOfTurnReset() {
		this.attackCount = 0;
		for (ability of this.abilities) {
			if (ability instanceof abilities.OptionalAbility || ability instanceof abilities.FastAbility || ability instanceof abilities.TriggerAbility) {
				ability.activationCount = 0;
			}
		}
	}
}

// a card with all its values frozen so it can be held in internal logs of what Actions happened in a Timing.
class SnapshotCard extends BaseCard {
	constructor(card) {
		super(card.owner, card.cardId, card.hidden,
			new SnapshotValue(card.cardTypes.get(), card.cardTypes.getBase()),
			new SnapshotValue(card.names.get(), card.names.getBase()),
			new SnapshotValue(card.level.get(), card.level.getBase()),
			new SnapshotValue(card.types.get(), card.types.getBase()),
			new SnapshotValue(card.attack.get(), card.attack.getBase()),
			new SnapshotValue(card.defense.get(), card.defense.getBase()),
			new SnapshotValue(card.abilities.get(), card.abilities.getBase())
		);

		this.zone = card.zone;
		this.index = card.index;
		this.attackCount = card.attackCount;
		this.cardRef = card;
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
				if (!["unit", "standardSpell", "continuousSpell", "enchantSpell", "standardItem", "continuousItem", "equipableItem"].includes(parts[1])) {
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
				data.types = parts[1].split(",").map(type => type);
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
					exec: ""
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
			return new abilities.CastAbility(ability.id, ability.exec, ability.cost);
		}
		case "deploy": {
			return new abilities.DeployAbility(ability.id, ability.exec, ability.cost);
		}
		case "optional": {
			return new abilities.OptionalAbility(ability.id, ability.exec, ability.cost, ability.turnLimit);
		}
		case "fast": {
			return new abilities.FastAbility(ability.id, ability.exec, ability.cost, ability.turnLimit);
		}
		case "trigger": {
			return new abilities.TriggerAbility(ability.id, ability.exec, ability.cost, ability.mandatory, ability.turnLimit);
		}
		case "static": {
			return new abilities.StaticAbility(ability.id, ability.exec);
		}
	}
}