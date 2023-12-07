// This module exports the Card class which represents a specific card in a Game.

import {CardValues, ObjectValues} from "./objectValues.js";
import {ScriptContext} from "./cdfScriptInterpreter/structs.js";
import * as abilities from "./abilities.js";
import * as interpreter from "./cdfScriptInterpreter/interpreter.js";
import * as blocks from "./blocks.js";
import * as actions from "./actions.js";
import * as timingGenerators from "./timingGenerators.js";

export class BaseCard {
	constructor(player, cardId, isToken, initialValues, deckLimit, equipableTo, turnLimit, condition) {
		this.owner = player;
		this.cardId = cardId;
		this.isToken = isToken;
		this.isRemovedToken = false;
		this.deckLimit = deckLimit;
		this.equipableTo = equipableTo;
		this.turnLimit = turnLimit;
		this.condition = condition;

		this.values = new ObjectValues(initialValues);
		this.cdfScriptType = "card";

		this.zone = null;
		this.placedTo = null;
		this.index = -1;
		this.lastFieldSidePlayer = null;

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
		let ownTypes = this.values.current.types;
		for (let type of card.values.current.types) {
			if (ownTypes.includes(type)) {
				return true;
			}
		}
		return false;
	}

	currentOwner() {
		return this.zone?.player ?? this.placedTo?.player ?? this.owner;
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
			[new actions.ChangeMana(player, -this.values.current.level)]
		]);
	}
	getCastingCost(player) {
		let generators = [
			timingGenerators.arrayTimingGenerator([
				[new actions.ChangeMana(player, -this.values.current.level)]
			])
		];
		for (let ability of this.values.current.abilities) {
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
				[new actions.ChangeMana(player, -this.values.current.level)]
			])
		];
		for (let ability of this.values.current.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				if (ability.cost) {
					generators.push(timingGenerators.abilityCostTimingGenerator(ability, this, player));
				}
				break;
			}
		}
		return timingGenerators.combinedTimingGenerator(generators);
	}

	async canSummon(checkPlacement, player) {
		if (!this.values.current.cardTypes.includes("unit")) {
			return false;
		}
		let timingRunner = new timingGenerators.TimingRunner(() => this.getSummoningCost(player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, () => !checkPlacement || player.unitZone.cards.includes(null));
		return costOptionTree.valid;
	}
	async canCast(checkPlacement, player, evaluatingPlayer = player) {
		if (!this.values.current.cardTypes.includes("spell")) {
			return false;
		}
		let cardCtx = new ScriptContext(this, player, null, evaluatingPlayer);
		if ((player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.CastSpell && block.card.cardId === this.cardId && block.player === player).length >= this.turnLimit.evalFull(cardCtx)[0].getJsNum(player)) ||
			(this.condition !== null && !this.condition.evalFull(cardCtx)[0].get(player)) ||
			(this.values.current.cardTypes.includes("enchantSpell") && this.equipableTo.evalFull(cardCtx)[0].get(player).length == 0)
		) {
			return false;
		}
		// find cast ability
		let endOfTreeCheck = () => !checkPlacement || player.spellItemZone.cards.includes(null);
		for (const ability of this.values.current.abilities) {
			if (ability instanceof abilities.CastAbility) {
				if (!ability.canActivate(this, player, evaluatingPlayer)) {
					return false;
				}
				let currentZone = this.zone; // Can't discard a spell for its own cost
				endOfTreeCheck = () => ability.exec.hasAllTargets(new ScriptContext(this, player, ability, evaluatingPlayer)) && this.zone === currentZone && (!checkPlacement || player.spellItemZone.cards.includes(null));
			}
		}

		let timingRunner = new timingGenerators.TimingRunner(() => this.getCastingCost(player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, endOfTreeCheck);
		return costOptionTree.valid;
	}
	// If checkPlacement is false, only teh deployment conditions that the rules care about will be evaluated, not if the card can actually sucessfully be placed on the field
	async canDeploy(checkPlacement, player, evaluatingPlayer = player) {
		if (!this.values.current.cardTypes.includes("item")) {
			return false;
		}
		let cardCtx = new ScriptContext(this, player, null, evaluatingPlayer);
		if ((player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.DeployItem && block.card.cardId === this.cardId && block.player === player).length >= this.turnLimit.evalFull(cardCtx)[0].getJsNum(player)) ||
			(this.condition !== null && !this.condition.evalFull(cardCtx)[0].get(player)) ||
			(this.values.current.cardTypes.includes("equipableItem") && this.equipableTo.evalFull(cardCtx)[0].get(player).length == 0)
		) {
			return false;
		}
		// find deploy ability
		let endOfTreeCheck = () => !checkPlacement || player.spellItemZone.cards.includes(null);
		for (const ability of this.values.current.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				if (!ability.canActivate(this, player, evaluatingPlayer)) {
					return false;
				}
				let currentZone = this.zone; // Can't discard an item for its own cost
				endOfTreeCheck = () => ability.exec.hasAllTargets(new ScriptContext(this, player, ability, evaluatingPlayer)) && this.zone === currentZone && (!checkPlacement || player.spellItemZone.cards.includes(null));
			}
		}

		let timingRunner = new timingGenerators.TimingRunner(() => this.getDeploymentCost(player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, endOfTreeCheck);
		return costOptionTree.valid;
	}

	// Does not check if the card can be declared to attack, only if it is allowed to be/stay in an attack declaration.
	canAttack() {
		if (this.isRemovedToken) return false;
		if (!this.values.current.cardTypes.includes("unit")) return false;
		if (!this.values.current.canAttack) return false;
		return this.attackCount < this.values.current.attackRights || this.canAttackAgain;
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
			baseCardTypes = ["unit"];
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
			baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
			baseCardTypes.push("item");
		}
		super(player, data.id,
			data.cardType === "token",
			new CardValues(
				baseCardTypes,
				[data.name ?? data.id],
				data.level ?? 0,
				data.types ?? [],
				data.attack ?? null,
				data.defense ?? null,
				data.abilities.map(ability => interpreter.makeAbility(ability.id, player.game)),
				baseCardTypes.includes("unit")? 1 : null,
				baseCardTypes.includes("unit")? true : null,
				baseCardTypes.includes("unit")? true : null
			),
			data.deckLimit,
			interpreter.buildAST("equipableTo", data.id, data.equipableTo, player.game),
			interpreter.buildAST("turnLimit", data.id, data.turnLimit, player.game),
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
		for (let ability of this.values.current.abilities) {
			if (ability instanceof abilities.OptionalAbility || ability instanceof abilities.FastAbility || ability instanceof abilities.TriggerAbility) {
				ability.turnActivationCount = 0;
			}
		}
	}
}

// a card with all its values frozen so it can be held in internal logs of what Actions happened in a Timing.
export class SnapshotCard extends BaseCard {
	constructor(card, equippedToSnapshot, equipmentSnapshot) {
		super(card.owner, card.cardId, card.isToken, card.values.initial.clone(), card.deckLimit, card.equipableTo, card.turnLimit, card.condition);
		this.isRemovedToken = card.isRemovedToken;

		this.values.current = card.values.current.clone();
		this.values.base = card.values.base.clone();
		this.values.modifierStack = [...card.values.modifierStack];

		let abilities = this.values.initial.abilities;
		for (let ability of this.values.base.abilities.concat(this.values.current.abilities)) {
			if (!abilities.includes(ability)) {
				abilities.push(ability);
			}
		}
		let abilitySnapshots = abilities.map(ability => ability.snapshot());
		this.values.initial.abilities = this.values.initial.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
		this.values.base.abilities = this.values.base.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
		this.values.current.abilities = this.values.current.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);

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
		this.placedTo = card.placedTo;
		this.index = card.index;
		this.lastFieldSidePlayer = card.lastFieldSidePlayer;

		for (const [counter, amount] of Object.entries(card.counters)) {
			this.counters[counter] = amount;
		}
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
		this._actualCard.isRemovedToken = this.isRemovedToken;

		// tokens might need to be restored back to non-existance
		if (this.zone === null && this.placedTo === null) {
			this._actualCard.zone.remove(this._actualCard);
			return;
		}
		this.zone?.add(this._actualCard, this.index, false);
		this.placedTo?.place(this._actualCard, this.index);
		if (this._actualCard.globalId != this.globalId) {
			this._actualCard.undoInvalidateSnapshots();
		}
		this._actualCard.lastFieldSidePlayer = this.lastFieldSidePlayer;

		this._actualCard.hiddenFor = [...this.hiddenFor];

		// also ends up restoring snapshotted abilities
		this._actualCard.values = this.values;

		this._actualCard.equippedTo = this.equippedTo?._actualCard ?? null;
		if (this.equippedTo && !this._actualCard.equippedTo.equipments.includes(this._actualCard)) {
			this._actualCard.equippedTo.equipments.push(this._actualCard);
		}
		this._actualCard.equipments = this.equipments.map(equipment => equipment._actualCard);
		for (const equipment of this._actualCard.equipments) {
			equipment.equippedTo = this._actualCard;
		}

		for (const [counter, amount] of Object.entries(this.counters)) {
			this._actualCard.counters[counter] = amount;
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
		turnLimit: "any",
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
				case "cancellable": {
					if (!["yes", "no"].includes(parts[1])) {
						throw new Error("CDF Parser Error: 'cancellable' must be either 'yes' or 'no'.");
					}
					ability.cancellable = parts[1] === "yes";
					break;
				}
				case "turnLimit": {
					ability.turnLimit = parts[1];
					break;
				}
				case "globalTurnLimit": {
					ability.globalTurnLimit = parts[1];
					break;
				}
				case "gameLimit": {
					ability.gameLimit = parts[1];
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
					ability.mandatory = parts[1] === "yes";
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
				data.deckLimit = parts[1] === "any"? Infinity : parseInt(parts[1]);
				break;
			}
			case "equipableTo": {
				data.equipableTo = "[from field where cardType = unit & " + parts[1] + "]";
				break;
			}
			case "turnLimit": {
				data.turnLimit = parts[1];
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
				if (parts[1] === "cast" && !["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
					throw new Error("CDF Parser Error: Only spells can have cast abilities.");
				}
				if (parts[1] === "deploy" && !["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
					throw new Error("CDF Parser Error: Only items can have deploy abilities.");
				}
				data.abilities.push({
					id: data.id + ":" + data.abilities.length,
					type: parts[1],
					cancellable: true,
					turnLimit: "any",
					globalTurnLimit: "any",
					gameLimit: "any",
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
	for (const ability of data.abilities) {
		interpreter.registerAbility(ability);
	}
	return data;
}