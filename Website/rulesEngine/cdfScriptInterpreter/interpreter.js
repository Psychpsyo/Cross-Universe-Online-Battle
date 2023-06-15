
import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";

let alreadyParsedExecs = {};
let alreadyParsedCosts = {};

export function buildExecAST(effectId, cdfScript) {
	if (!alreadyParsedExecs[effectId]) {
		alreadyParsedExecs[effectId] = parseScript(tokenize(cdfScript));
	}
	return alreadyParsedExecs[effectId];
}

export function buildCostAST(effectId, cdfScript) {
	if (!alreadyParsedCosts[effectId]) {
		alreadyParsedCosts[effectId] = parseScript(tokenize(cdfScript));
	}
	return alreadyParsedCosts[effectId];
}

export class ScriptParserError extends Error {
	constructor(message) {
		super(message);
		this.name = "ScriptParserError";
	}
}