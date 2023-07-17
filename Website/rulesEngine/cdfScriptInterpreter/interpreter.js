import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";

let alreadyParsed = {
	exec: {},
	cost: {},
	condition: {},
	trigger: {},
	during: {},
	applyTarget: {},
	modifier: {},
	applyTarger: {},
	equipableTo: {}
};

export function buildAST(type, effectId, cdfScript, game) {
	if (!alreadyParsed[type][effectId]) {
		alreadyParsed[type][effectId] = parseScript(tokenize(cdfScript, game), effectId, type);
	}
	return alreadyParsed[type][effectId];
}