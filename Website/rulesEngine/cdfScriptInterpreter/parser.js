import * as ast from "./astNodes.js";

let pos;
let tokens;

export function parseScript(tokenList) {
	tokens = tokenList;
	pos = 0;

	let steps = [];

	while(pos < tokens.length) {
		steps.push(parseLine());
	}
	return new ast.ScriptNode(steps);
}

function parseLine() {
	switch (tokens[pos].type) {
		case "function": {
			return parseFuction();
		}
		default: {
			throw new Error("CDF Script Parser Error: '" + tokens[pos].type + "' is not a valid token at the start of a line.");
		}
	}
}

function parseFuction() {
	let functionName = tokens[pos].value;
	pos++;
	if (tokens[pos].type != "leftParen") {
		throw new Error("CDF Script Parser Error: Function '" + functionName + "' must be followed by a '('.");
	}
	pos++;
	let parameters = [];
	while (tokens[pos].type != "rightParen") {
		parameters.push(parseParameter());
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}
	pos++;
	return new ast.FunctionNode(functionName, parameters);
}

function parseParameter() {
	switch (tokens[pos].type) {
		case "number": {
			return parseNumber();
		}
		case "player": {
			return parsePlayer();
		}
		case "player": {
			return parsePlayer();
		}
		case "leftBracket": {
			return parseCardMatcher();
		}
		case "function": {
			return parseFuction();
		}
		default: {
			throw new Error("CDF Script Parser Error: A '" + tokens[pos].type + "' token does not start a valid function parameter.");
		}
	}
}

function parseNumber() {
	let node = new ast.IntNode(tokens[pos].value);
	pos++;
	return node;
}

function parsePlayer() {
	let node = new ast.PlayerNode(tokens[pos].value);
	pos++;
	return node;
}

function parseCardMatcher() {
	pos++;
	let cardTypes = [];
	while (tokens[pos].type != "from") {
		if (tokens[pos].type != "cardType") {
			throw new Error("CDF Script Parser Error: Expected a 'cardType' token in card matcher syntax. Got '" + tokens[pos].type + "' instead.");
		}
		cardTypes.push(tokens[pos].value);
		pos++;
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}

	pos++;
	let zones = [];
	while (tokens[pos].type != "where" && tokens[pos].type != "rightBracket") {
		if (tokens[pos].type != "zoneIdentifier") {
			throw new Error("CDF Script Parser Error: Expected a 'zoneIdentifier' token in card matcher syntax. Got '" + tokens[pos].type + "' instead.");
		}
		zones.push(new ast.ZoneNode(tokens[pos].value));
		pos++;
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}

	if (tokens[pos].type == "where") {
		while (tokens[pos].type != "rightBracket") {
			pos++;
			// TODO: implement where clause
		}
	}

	pos++;
	return new ast.CardMatchNode(cardTypes, zones);
}