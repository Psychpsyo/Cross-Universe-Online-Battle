import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";

let alreadyParsedExecs = {};
let alreadyParsedCosts = {};
let alreadyParsedConditions = {};
let alreadyParsedTriggers = {};
let alreadyParsedDurings = {};
let alreadyParsedModifiers = {};
let alreadyParsedApplyTargets = {};

export function buildExecAST(effectId, cdfScript, game) {
	if (!alreadyParsedExecs[effectId]) {
		alreadyParsedExecs[effectId] = parseScript(tokenize(cdfScript, game), effectId, "exec");
	}
	return alreadyParsedExecs[effectId];
}

export function buildCostAST(effectId, cdfScript, game) {
	if (!alreadyParsedCosts[effectId]) {
		alreadyParsedCosts[effectId] = parseScript(tokenize(cdfScript, game), effectId, "cost");
	}
	return alreadyParsedCosts[effectId];
}

export function buildConditionAST(effectId, cdfScript, game) {
	if (!alreadyParsedConditions[effectId]) {
		alreadyParsedConditions[effectId] = parseScript(tokenize(cdfScript, game), effectId, "condition");
	}
	return alreadyParsedConditions[effectId];
}

export function buildTriggerAST(effectId, cdfScript, game) {
	if (!alreadyParsedTriggers[effectId]) {
		alreadyParsedTriggers[effectId] = parseScript(tokenize(cdfScript, game), effectId, "trigger");
	}
	return alreadyParsedTriggers[effectId];
}

export function buildDuringAST(effectId, cdfScript, game) {
	if (!alreadyParsedDurings[effectId]) {
		alreadyParsedDurings[effectId] = parseScript(tokenize(cdfScript, game), effectId, "during");
	}
	return alreadyParsedDurings[effectId];
}

export function buildMofifierAST(effectId, cdfScript, game) {
	if (!alreadyParsedModifiers[effectId]) {
		alreadyParsedModifiers[effectId] = parseScript(tokenize(cdfScript, game), effectId, "modifier");
	}
	return alreadyParsedModifiers[effectId];
}

export function buildApplyTargetAST(effectId, cdfScript, game) {
	if (!alreadyParsedApplyTargets[effectId]) {
		alreadyParsedApplyTargets[effectId] = parseScript(tokenize(cdfScript, game), effectId, "applyTarget");
	}
	return alreadyParsedApplyTargets[effectId];
}