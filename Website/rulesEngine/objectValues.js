
export class ObjectValues {
	constructor(initial) {
		this.initial = initial;
		this.base = initial;
		this.current = initial;

		this.modifierStack = [];
		this.unaffectedBy = [];
	}
}

export class CardValues {
	constructor(cardTypes, names, level, types, attack, defense, abilities, attackRights, canAttack, canCounterattack) {
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		this.abilities = abilities;
		this.attackRights = attackRights;
		this.canAttack = canAttack;
		this.canCounterattack = canCounterattack;
	}

	// Clones these values WITHOUT cloning contained abilities by design.
	// This is because initial, base and final values are cloned together
	// by snapshotting and shouldn't get different values and because
	// creating new values from base values also uses cloning
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
			this.canAttack,
			this.canCounterattack
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

export class PlayerValues {
	constructor(manaGainAmount = 5, standardDrawAmount = 1, needsToPayForPartner = true) {
		this.manaGainAmount = manaGainAmount;
		this.standardDrawAmount = standardDrawAmount;
		this.needsToPayForPartner = needsToPayForPartner;
	}

	clone() {
		return new PlayerValues(
			this.manaGainAmount,
			this.standardDrawAmount
		);
	}

	// returns a list of all properties that are different between this and other
	compareTo(other) {
		let differences = [];
		for (let property of ["manaGainAmount", "standardDrawAmount"]) {
			if (this[property] != other[property]) {
				differences.push(property);
			}
		}
		return differences;
	}
};