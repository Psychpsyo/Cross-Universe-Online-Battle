import * as ast from "./astNodes.js";
import {ScriptParserError} from "./interpreter.js";

let pos;
let tokens;

export function parseScript(tokenList) {
	tokens = tokenList;
	pos = 0;

	let steps = [];

	while(pos < tokens.length) {
		if (tokens[pos].type == "newLine") {
			pos++;
		} else {
			steps.push(parseLine());
		}
	}
	return new ast.ScriptNode(steps);
}

function parseLine() {
	switch (tokens[pos].type) {
		case "function": {
			return parseFunction();
		}
		case "variable": {
			switch (tokens[pos+1].type) {
				case "equals": {
					return parseAssignment();
				}
				case "dotOperator": {
					return parseFunction();
				}
				default: {
					throw new ScriptParserError("Line starting with 'variable' token continues with unwanted '" + tokens[pos+1].type + "'.");
				}
			}
		}
		case "player": {
			return parseFunction();
		}
		default: {
			throw new ScriptParserError("'" + tokens[pos].type + "' is not a valid token at the start of a line.");
		}
	}
}

function parseFunction() {
	let player;
	switch (tokens[pos].type) {
		case "function": {
			player = new ast.PlayerNode("you");
			break;
		}
		case "player": {
			player = parsePlayer();
			if (tokens[pos].type != "dotOperator") {
				throw new ScriptParserError("Expected 'dotOperator' token after 'player' token while parsing function, got '" + tokens[pos].type + "' instead.");
			}
			pos++;
			break;
		}
		case "variable": {
			player = parseVariable();
			if (tokens[pos].type != "dotOperator") {
				throw new ScriptParserError("Expected 'dotOperator' token after 'variable' token while parsing function, got '" + tokens[pos].type + "' instead.");
			}
			pos++;
			break;
		}
		default: {
			throw new ScriptParserError("Encountered unwanted '" + tokens[pos].type + "' while trying to parse a function.");
		}
	}
	let functionName = tokens[pos].value;
	pos++;

	let asManyAsPossible = false;
	if (tokens[pos].type == "asmapOperator") {
		asManyAsPossible = true;
		pos++;
	}

	if (tokens[pos].type != "leftParen") {
		throw new ScriptParserError("'" + functionName + "' must be followed by a '('.");
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

	return new ast.FunctionNode(functionName, parameters, player, asManyAsPossible);
}

function parseAssignment() {
	let variableName = tokens[pos].value;
	pos++;
	if (tokens[pos].type != "equals") {
		throw new ScriptParserError("Variable name '" + variableName + "' must be followed by an '=' for assignments.");
	}
	pos++;
	let newValue = parseParameter();
	return new ast.AssignmentNode(variableName, newValue);
}

function parseParameter() {
	switch (tokens[pos].type) {
		case "minus":
		case "number": {
			return parseNumber();
		}
		case "player": {
			if (tokens[pos+1].type == "dotOperator") {
				return parseFunction();
			} else {
				return parsePlayer();
			}
		}
		case "leftBracket": {
			return parseCardMatcher();
		}
		case "function": {
			return parseFunction();
		}
		case "cardId": {
			return parseCardId();
		}
		case "type": {
			return parseType();
		}
		case "zoneIdentifier": {
			return parseZone();
		}
		case "bool": {
			return parseBool();
		}
		case "leftParen": {
			pos++;
			switch (tokens[pos].type) {
				case "type": {
					return parseTypeList();
				}
				case "cardId": {
					return parseCardIdList();
				}
			}
			throw new ScriptParserError("Encountered unwanted '" + tokens[pos].type + "' token inside list syntax.");
		}
		case "variable": {
			if (tokens[pos+1].type == "dotOperator") {
				return parseFunction();
			} else {
				return parseVariable();
			}
		}
		default: {
			throw new ScriptParserError("A '" + tokens[pos].type + "' token does not start a valid function parameter.");
		}
	}
}

function parseVariable() {
	let node = new ast.VariableNode(tokens[pos].value);
	pos++;
	return node;
}

function parseNumber() {
	let negative = false;
	if (tokens[pos].type == "minus") {
		negative = true;
		pos++;
	}
	let value = tokens[pos].value;
	if (negative) {
		value *= -1;
	}
	let node = new ast.IntNode(value);
	pos++;
	return node;
}

function parseBool() {
	let node = new ast.BoolNode(tokens[pos].value);
	pos++;
	return node;
}

function parseCardId() {
	let node = new ast.CardIDsNode([tokens[pos].value]);
	pos++;
	return node;
}

function parsePlayer() {
	let node = new ast.PlayerNode(tokens[pos].value);
	pos++;
	return node;
}

function parseType() {
	let node = new ast.TypesNode([tokens[pos].value]);
	pos++;
	return node;
}

function parseTypeList() {
	let types = [];
	while (tokens[pos].type == "type") {
		types.push(tokens[pos].value);
		pos++;
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}
	if (tokens[pos].type != "rightParen") {
		throw new ScriptParserError("Expected a 'rightParen' at the end of a type list. Got '" + tokens[pos].type + "' instead.");
	}
	pos++;
	return new ast.TypesNode(types);
}

function parseCardIdList() {
	let cardIDs = [];
	while (tokens[pos].type == "cardId") {
		cardIDs.push(tokens[pos].value);
		pos++;
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}
	if (tokens[pos].type != "rightParen") {
		throw new ScriptParserError("Expected a 'rightParen' at the end of a card ID list. Got '" + tokens[pos].type + "' instead.");
	}
	pos++;
	return new ast.CardIDsNode(cardIDs);
}

function parseZone() {
	let node = new ast.ZoneNode(tokens[pos].value);
	pos++;
	return node;
}

function parseCardMatcher() {
	pos++;
	let cardTypes = [];
	while (tokens[pos].type != "from") {
		if (tokens[pos].type != "cardType") {
			throw new ScriptParserError("Expected a 'cardType' token in card matcher syntax. Got '" + tokens[pos].type + "' instead.");
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
			throw new ScriptParserError("Expected a 'zoneIdentifier' token in card matcher syntax. Got '" + tokens[pos].type + "' instead.");
		}
		zones.push(parseZone());
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