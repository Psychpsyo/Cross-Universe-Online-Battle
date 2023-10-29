import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";
import * as abilities from "../abilities.js";

let registeredAbilities = {};

let alreadyParsed = {
	exec: {},
	cost: {},
	condition: {},
	trigger: {},
	during: {},
	applyTarget: {},
	modifier: {},
	applyTarger: {},
	equipableTo: {},
	cardCondition: {}
};

// ability is the information from the .cdf file, parsed into a js object.
export function registerAbility(ability) {
	registeredAbilities[ability.id] = ability;
}

// creates a new ability object for the specified ability ID
export function makeAbility(abilityId, game) {
	if (!(registeredAbilities.hasOwnProperty(abilityId))) {
		throw new Error("Trying to create unregistered ability " + abilityId + ".\nThe ability must first be registered with registerAbility().");
	}
	let ability = registeredAbilities[abilityId];
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

export function buildAST(type, abilityId, cdfScript, game) {
	if (!alreadyParsed[type][abilityId]) {
		alreadyParsed[type][abilityId] = parseScript(tokenize(cdfScript, game), abilityId, type);
	}
	return alreadyParsed[type][abilityId];
}