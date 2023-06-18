
import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";

let alreadyParsedExecs = {};
let alreadyParsedCosts = {};
let alreadyParsedConditions = {};

export function buildExecAST(effectId, cdfScript) {
	if (!alreadyParsedExecs[effectId]) {
		alreadyParsedExecs[effectId] = parseScript(tokenize(cdfScript), effectId);
	}
	return alreadyParsedExecs[effectId];
}

export function buildCostAST(effectId, cdfScript) {
	if (!alreadyParsedCosts[effectId]) {
		alreadyParsedCosts[effectId] = parseScript(tokenize(cdfScript), effectId);
	}
	return alreadyParsedCosts[effectId];
}

export function buildConditionAST(effectId, cdfScript) {
	if (!alreadyParsedConditions[effectId]) {
		alreadyParsedConditions[effectId] = parseScript(tokenize(cdfScript), effectId, true);
	}
	return alreadyParsedConditions[effectId];
}