import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";

let alreadyParsedExecs = {};
let alreadyParsedCosts = {};
let alreadyParsedConditions = {};
let alreadyParsedTriggers = {};
let alreadyParsedModifiers = {};
let alreadyParsedApplyTargets = {};

export function buildExecAST(effectId, cdfScript) {
	if (!alreadyParsedExecs[effectId]) {
		alreadyParsedExecs[effectId] = parseScript(tokenize(cdfScript), effectId, "exec");
	}
	return alreadyParsedExecs[effectId];
}

export function buildCostAST(effectId, cdfScript) {
	if (!alreadyParsedCosts[effectId]) {
		alreadyParsedCosts[effectId] = parseScript(tokenize(cdfScript), effectId, "cost");
	}
	return alreadyParsedCosts[effectId];
}

export function buildConditionAST(effectId, cdfScript) {
	if (!alreadyParsedConditions[effectId]) {
		alreadyParsedConditions[effectId] = parseScript(tokenize(cdfScript), effectId, "condition");
	}
	return alreadyParsedConditions[effectId];
}

export function buildTriggerAST(effectId, cdfScript) {
	if (!alreadyParsedTriggers[effectId]) {
		alreadyParsedTriggers[effectId] = parseScript(tokenize(cdfScript), effectId, "trigger");
	}
	return alreadyParsedTriggers[effectId];
}

export function buildMofifierAST(effectId, cdfScript) {
	if (!alreadyParsedModifiers[effectId]) {
		alreadyParsedModifiers[effectId] = parseScript(tokenize(cdfScript), effectId, "modifier");
	}
	return alreadyParsedModifiers[effectId];
}

export function buildApplyTargetAST(effectId, cdfScript) {
	if (!alreadyParsedApplyTargets[effectId]) {
		alreadyParsedApplyTargets[effectId] = parseScript(tokenize(cdfScript), effectId, "applyTarget");
	}
	return alreadyParsedApplyTargets[effectId];
}