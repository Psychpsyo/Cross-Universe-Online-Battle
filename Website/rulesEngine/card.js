// This module exports the Card class which represents a specific card in a Game.

import {CardValues} from "./cardValues.js";
import * as abilities from "./abilities.js";
import * as interpreter from "./cdfScriptInterpreter/interpreter.js";
import * as blocks from "./blocks.js";
import * as actions from "./actions.js";
import * as timingGenerators from "./timingGenerators.js";

export class BaseCard {
	constructor(player, cardId, initialValues, deckLimit, equipableTo, turnLimit, condition) {
		this.owner = player;
		this.cardId = cardId;
		this.deckLimit = deckLimit;
		this.equipableTo = equipableTo;
		this.turnLimit = turnLimit;
		this.condition = condition;

		this.initialValues = initialValues;
		this.baseValues = initialValues;
		this.values = initialValues;
		this.modifierStack = [];

		this.zone = null;
		this.index = -1;
		this.lastMoveTimingIndex = 0;

		this.counters = {};
		this.equippedTo = null;
		this.equipments = [];
		this.attackCount = 0;
		this.canAttackAgain = false;
		this.isAttacking = false;
		this.isAttackTarget = false;
		this.inRetire = null;

		this.hiddenFor = [];
		this.globalId = 0;
	}

	// always returns the current, non-snapshot version of a card or null if that doesn't exist.
	current() {
		return this.owner.game.currentCards.get(this.globalId) ?? null;
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

	// Whenever a card's values change, this function re-evaluates the modifier stack to figure out what the new value should be.
	// In doing so, it also takes care of spells & items losing their unit-specific modifications
	recalculateModifiedValues() {
		let unaffectedBy = [];
		// values being unaffected by cards
		for (const modifier of this.modifierStack) {
			modifier.modify(this, false, unaffectedBy, true);
		}
		// handle base value changes
		this.baseValues = this.initialValues.clone();
		for (const modifier of this.modifierStack) {
			this.baseValues = modifier.modify(this, true, unaffectedBy, false);
		}
		if (!this.baseValues.cardTypes.includes("unit")) {
			this.baseValues.attack = null;
			this.baseValues.defense = null;
			this.baseValues.attackRights = null;
		}
		// handle main value changes
		this.values = this.baseValues.clone();
		for (const modifier of this.modifierStack) {
			this.values = modifier.modify(this, false, unaffectedBy, false);
		}
		// non-units only have base attack/defense
		if (!this.values.cardTypes.includes("unit")) {
			this.values.attack = null;
			this.values.defense = null;
			this.values.attackRights = null;
		}
	}

	hideFrom(player) {
		if (!this.hiddenFor.includes(player)) {
			this.hiddenFor.push(player);
		}
	}
	showTo(player) {
		let index = this.hiddenFor.indexOf(player);
		if (index >= 0) {
			this.hiddenFor.splice(index, 1);
		}
	}

	getSummoningCost(player) {
		return timingGenerators.arrayTimingGenerator([
			[new actions.ChangeMana(player, -this.values.level)]
		]);
	}
	getCastingCost(player) {
		let generators = [
			timingGenerators.arrayTimingGenerator([
				[new actions.ChangeMana(player, -this.values.level)]
			])
		];
		for (let ability of this.values.abilities) {
			if (ability instanceof abilities.CastAbility) {
				if (ability.cost) {
					generators.push(timingGenerators.abilityCostTimingGenerator(ability, this, player));
				}
				break;
			}
		}
		return timingGenerators.combinedTimingGenerator(generators);
	}
	getDeploymentCost(player) {
		let generators = [
			timingGenerators.arrayTimingGenerator([
				[new actions.ChangeMana(player, -this.values.level)]
			])
		];
		for (let ability of this.values.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				if (ability.cost) {
					generators.push(timingGenerators.abilityCostTimingGenerator(ability, this, player));
				}
				break;
			}
		}
		return timingGenerators.combinedTimingGenerator(generators);
	}

	async canSummon(player) {
		if (!this.values.cardTypes.includes("unit")) {
			return false;
		}
		let timingRunner = new timingGenerators.TimingRunner(() => this.getSummoningCost(player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, () => true);
		return costOptionTree.valid;
	}
	async canCast(player, evaluatingPlayer = player) {
		if (!this.values.cardTypes.includes("spell")) {
			return false;
		}
		if ((player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.CastSpell && block.card.cardId === this.cardId && block.player === player).length >= this.turnLimit) ||
			(this.condition !== null && !this.condition.evalFull(this, player, null)[0]) ||
			(this.values.cardTypes.includes("enchantSpell") && this.equipableTo.evalFull(this, player, null)[0].length == 0)
		) {
			return false;
		}
		// find cast ability
		let endOfTreeCheck = () => true;
		for (const ability of this.values.abilities) {
			if (ability instanceof abilities.CastAbility) {
				if (!ability.canActivate(this, player, evaluatingPlayer)) {
					return false;
				}
				endOfTreeCheck = () => ability.exec.hasAllTargets(this, player, ability, evaluatingPlayer);
			}
		}

		let timingRunner = new timingGenerators.TimingRunner(() => this.getCastingCost(player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, endOfTreeCheck);
		return costOptionTree.valid;
	}
	async canDeploy(player, evaluatingPlayer = player) {
		if (!this.values.cardTypes.includes("item")) {
			return false;
		}
		if ((player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.DeployItem && block.card.cardId === this.cardId && block.player === player).length >= this.turnLimit) ||
			(this.condition !== null && !this.condition.evalFull(this, player, null)[0]) ||
			(this.values.cardTypes.includes("equipableItem") && this.equipableTo.evalFull(this, player, null)[0].length == 0)
		) {
			return false;
		}
		// find deploy ability
		let endOfTreeCheck = () => true;
		for (const ability of this.values.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				if (!ability.canActivate(this, player, evaluatingPlayer)) {
					return false;
				}
				endOfTreeCheck = () => ability.exec.hasAllTargets(this, player, ability, evaluatingPlayer);
			}
		}

		let timingRunner = new timingGenerators.TimingRunner(() => this.getDeploymentCost(player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, endOfTreeCheck);
		return costOptionTree.valid;
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
	constructor(player, cdf) {
		let data = parseCdfValues(cdf);
		let baseCardTypes = [data.cardType];
		if (data.cardType == "token") {
			baseCardTypes.push("unit");
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
			baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
			baseCardTypes.push("item");
		}
		super(player, data.id,
			new CardValues(
				baseCardTypes,
				[data.name ?? data.id],
				data.level ?? 0,
				data.types ?? [],
				data.attack ?? null,
				data.defense ?? null,
				data.abilities.map(ability => makeAbility(ability, player.game)),
				baseCardTypes.includes("unit")? 1 : null
			),
			data.deckLimit,
			interpreter.buildAST("equipableTo", data.id, data.equipableTo, player.game),
			data.turnLimit,
			data.condition? interpreter.buildAST("cardCondition", data.id, data.condition, player.game) : null
		);
		this.globalId = ++player.game.lastGlobalCardId;
		player.game.currentCards.set(this.globalId, this);
		this.globalIdHistory = [];
	}

	invalidateSnapshots() {
		this.globalIdHistory.push(this.globalId);
		this.owner.game.currentCards.delete(this.globalId);
		this.globalId = ++this.owner.game.lastGlobalCardId;
		this.owner.game.currentCards.set(this.globalId, this);
	}
	undoInvalidateSnapshots() {
		this.owner.game.currentCards.delete(this.globalId);
		this.globalId = this.globalIdHistory.pop();
		this.owner.game.currentCards.set(this.globalId, this);
		this.owner.game.lastGlobalCardId--;
	}

	endOfTurnReset() {
		this.attackCount = 0;
		this.canAttackAgain = false;
		for (let ability of this.values.abilities) {
			if (ability instanceof abilities.OptionalAbility || ability instanceof abilities.FastAbility || ability instanceof abilities.TriggerAbility) {
				ability.turnActivationCount = 0;
			}
		}
	}
}

// a card with all its values frozen so it can be held in internal logs of what Actions happened in a Timing.
export class SnapshotCard extends BaseCard {
	constructor(card, equippedToSnapshot, equipmentSnapshot) {
		super(card.owner, card.cardId, card.initialValues.clone(), card.deckLimit, card.equipableTo, card.turnLimit, card.condition);
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

		if (equippedToSnapshot) {
			this.equippedTo = equippedToSnapshot;
		} else if (card.equippedTo) {
			this.equippedTo = new SnapshotCard(card.equippedTo, undefined, this);
		}
		this.equipments = card.equipments.map((equipment => {
			if (equipmentSnapshot === equipment) {
				return equipmentSnapshot;
			}
			return new SnapshotCard(equipment, this);
		}).bind(this));
		this.zone = card.zone;
		this.index = card.index;
		this.lastMoveTimingIndex = card.lastMoveTimingIndex;

		this.attackCount = card.attackCount;
		this.canAttackAgain = card.canAttackAgain;
		this.isAttacking = card.isAttacking;
		this.isAttackTarget = card.isAttackTarget;
		this.inRetire = card.inRetire;

		this.hiddenFor = [...card.hiddenFor];
		this.globalId = card.globalId;
		this._actualCard = card; // will not be cleared by card moving and is only for restoring a card on undo
	}

	restore() {
		// tokens might need to be restored back to non-existance
		if (this.zone === null) {
			this._actualCard.zone.remove(this._actualCard);
			return;
		}
		this.zone.add(this._actualCard, this.index, false);
		if (this._actualCard.globalId != this.globalId) {
			this._actualCard.undoInvalidateSnapshots();
		}

		this._actualCard.hiddenFor = [...this.hiddenFor];

		this._actualCard.initialValues = this.initialValues;
		this._actualCard.values = this.values;
		this._actualCard.baseValues = this.baseValues;
		this._actualCard.modifierStack = this.modifierStack;

		this._actualCard.equippedTo = this.equippedTo?._actualCard ?? null;
		if (this.equippedTo && !this._actualCard.equippedTo.equipments.includes(this._actualCard)) {
			this._actualCard.equippedTo.equipments.push(this._actualCard);
		}
		this._actualCard.equipments = this.equipments.map(equipment => equipment._actualCard);
		for (const equipment of this._actualCard.equipments) {
			equipment.equippedTo = this._actualCard;
		}
		this._actualCard.attackCount = this.attackCount;
		this._actualCard.canAttackAgain = this.canAttackAgain;
		this._actualCard.isAttackTarget = this.isAttackTarget;
		this._actualCard.isAttacking = this.isAttacking;
		if (this.isAttackTarget) {
			this.owner.game.currentAttackDeclaration.target = this._actualCard;
		}
		if (this.isAttacking) {
			if (this.owner.game.currentAttackDeclaration.attackers.indexOf(this._actualCard) == -1) {
				this.owner.game.currentAttackDeclaration.attackers.push(this._actualCard);
			}
		}
		this._actualCard.inRetire = this.inRetire;
		if (this.inRetire) {
			this.inRetire.units.push(this._actualCard);
		}
	}
}

function parseCdfValues(cdf) {
	let data = {
		abilities: [],
		deckLimit: 3,
		equipableTo: "[from field where cardType = unit]",
		turnLimit: Infinity,
		condition: null
	};
	let lines = cdf.replaceAll("\r", "").split("\n");
	let inAbility = false;
	let abilitySection = "";
	for (let line of lines) {
		if (line === "") {
			continue;
		}
		let parts = line.split(/:(.*)/).map(part => part.trim());
		if (inAbility && parts[0] != "o") {
			let ability = data.abilities[data.abilities.length - 1];
			switch (parts[0]) {
				case "turnLimit": {
					ability.turnLimit = parseInt(parts[1]);
					break;
				}
				case "globalTurnLimit": {
					ability.globalTurnLimit = parseInt(parts[1]);
					break;
				}
				case "gameLimit": {
					ability.gameLimit = parseInt(parts[1]);
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
					if (ability.during) {
						throw new Error("CDF Parser Error: 'after' and 'during' clauses are mutually exclusive. Use a condition instead of the during.");
					}
					ability.after = parts[1];
					break;
				}
				case "during": {
					if (ability.type != "trigger") {
						throw new Error("CDF Parser Error: Only trigger abilities have phase restrictions.");
					}
					if (ability.after) {
						throw new Error("CDF Parser Error: 'after' and 'during' clauses are mutually exclusive. Use a condition instead of the during.");
					}
					ability.during = parts[1];
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
			case "deckLimit": {
				data.deckLimit = parts[1] == "any"? Infinity : parseInt(parts[1]);
				break;
			}
			case "equipableTo": {
				data.equipableTo = "[from field where cardType = unit & " + parts[1] + "]";
				break;
			}
			case "turnLimit": {
				data.turnLimit = parseInt(parts[1]);
				break;
			}
			case "condition": {
				data.condition = parts[1];
				break;
			}
			case "o": {
				if (!["cast", "deploy", "optional", "fast", "trigger", "static"].includes(parts[1])) {
					throw new Error("CDF Parser Error: " + parts[1] + " is an invalid ability type.");
				}
				if (parts[1] == "cast" && !["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
					throw new Error("CDF Parser Error: Only spells can have cast abilities.");
				}
				if (parts[1] == "deploy" && !["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
					throw new Error("CDF Parser Error: Only items can have deploy abilities.");
				}
				data.abilities.push({
					id: data.id + ":" + data.abilities.length,
					type: parts[1],
					turnLimit: Infinity,
					globalTurnLimit: Infinity,
					gameLimit: Infinity,
					during: null,
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

function makeAbility(ability, game) {
	switch (ability.type) {
		case "cast": {
			return new abilities.CastAbility(ability.id, game, ability.exec, ability.cost, ability.condition, ability.after);
		}
		case "deploy": {
			return new abilities.DeployAbility(ability.id, game, ability.exec, ability.cost, ability.condition, ability.after);
		}
		case "optional": {
			return new abilities.OptionalAbility(ability.id, game, ability.exec, ability.cost, ability.turnLimit, ability.globalTurnLimit, ability.gameLimit, ability.condition);
		}
		case "fast": {
			return new abilities.FastAbility(ability.id, game, ability.exec, ability.cost, ability.turnLimit, ability.globalTurnLimit, ability.gameLimit, ability.condition);
		}
		case "trigger": {
			return new abilities.TriggerAbility(ability.id, game, ability.exec, ability.cost, ability.mandatory, ability.turnLimit, ability.globalTurnLimit, ability.gameLimit, ability.during, ability.after, ability.condition);
		}
		case "static": {
			return new abilities.StaticAbility(ability.id, game, ability.modifier, ability.applyTo, ability.condition);
		}
	}
}