import * as ast from "./astNodes.js";

let pos;
let tokens;
let effectId; // The effect that is currently being parsed.

class ScriptParserError extends Error {
	constructor(message) {
		super("On " + effectId + " : " + message);
		this.name = "ScriptParserError";
	}
}

export function parseScript(tokenList, newEffectId) {
	effectId = newEffectId;
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
	let actionNodes = [];
	do {
		switch (tokens[pos].type) {
			case "function": {
				actionNodes.push(parseFunction());
				break;
			}
			case "variable": {
				switch (tokens[pos+1].type) {
					case "equals": {
						actionNodes.push(parseAssignment());
						break;
					}
					case "dotOperator": {
						actionNodes.push(parseFunction());
						break;
					}
					default: {
						throw new ScriptParserError("Line starting with 'variable' token continues with unwanted '" + tokens[pos+1].type + "'.");
					}
				}
				break;
			}
			case "player": {
				actionNodes.push(parseFunction());
				break;
			}
			default: {
				throw new ScriptParserError("'" + tokens[pos].type + "' is not a valid token at the start of a line.");
			}
		}
	} while (pos < tokens.length - 1 && tokens[pos++].type == "andOperator");
	return new ast.LineNode(actionNodes);
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
		parameters.push(parseExpression());
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
	let newValue = parseExpression();
	return new ast.AssignmentNode(variableName, newValue);
}

function parseExpression() {
	let insideParens = false;
	if (tokens[pos].type == "leftParen") {
		insideParens = true;
		pos++;
	}
	let expression = [];
	do {
		expression.push(parseValue());
		if (tokens[pos]) {
			switch (tokens[pos].type) {
				case "plus": {
					expression.push(new ast.PlusNode(null, null));
					break;
				}
				case "minus": {
					expression.push(new ast.MinusNode(null, null));
					break;
				}
				case "multiply": {
					expression.push(new ast.MultiplyNode(null, null));
					break;
				}
				case "ceilDivide": {
					expression.push(new ast.CeilDivideNode(null, null));
					break;
				}
				case "floorDivide": {
					expression.push(new ast.FloorDivideNode(null, null));
					break;
				}
				case "equals": {
					expression.push(new ast.EqualsNode(null, null));
					break;
				}
				case "notEquals": {
					expression.push(new ast.NotEqualsNode(null, null));
					break;
				}
				case "greaterThan": {
					expression.push(new ast.GreaterThanNode(null, null));
					break;
				}
				case "lessThan": {
					expression.push(new ast.LessThanNode(null, null));
					break;
				}
				case "andOperator": {
					expression.push(new ast.AndNode(null, null));
					break;
				}
				case "orOperator": {
					expression.push(new ast.OrNode(null, null));
					break;
				}
				default: {
					pos--;
				}
			}
			pos++;
		}
	} while (tokens[pos] && !["rightParen", "rightBracket", "newLine", "separator"].includes(tokens[pos].type));

	if (insideParens) {
		if (tokens[pos].type == "rightParen") {
			pos++;
		} else {
			throw new ScriptParserError("Found unwanted '" + tokens[pos].type + "' token instead of ')' at the end of parenthesized expression.");
		}
	}

	for (let type of [ast.DotMathNode, ast.DashMathNode, ast.ComparisonNode, ast.LogicNode]) {
		for (let i = 0; i < expression.length; i++) {
			if (expression[i] instanceof type) {
				expression[i].leftSide = expression[i-1];
				expression[i].rightSide = expression[i+1];
				i--;
				expression.splice(i, 3, expression[i+1]);
			}
		}
	}
	if (expression.length > 1) {
		throw new ScriptParserError("Failed to fully consolidate expression.");
	}
	return expression[0];
}

function parseValue() {
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
			if (tokens[pos+1].type == "from") {
				let cardMatcher = parseCardMatcher();
				if (tokens[pos].type == "dotOperator") {
					pos++;
					if (tokens[pos].type != "cardProperty") {
						throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' when trying to access card property of a card match statement [from...where...].");
					}
					return parseCardProperty(cardMatcher);
				}
				return cardMatcher;
			}
			return parseList(tokens[pos+1].type);
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
			return parseExpression();
		}
		case "variable": {
			if (tokens[pos+1].type == "dotOperator") {
				return parseFunction();
			} else {
				return parseVariable();
			}
		}
		case "thisCard": {
			pos++;
			if (tokens[pos].type == "dotOperator") {
				pos++;
				if (tokens[pos].type != "cardProperty") {
					throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' when trying to access thisCard property.");
				}
				return parseCardProperty(new ast.ThisCardNode());
			}
			return new ast.ThisCardNode();
		}
		case "cardProperty": {
			return parseCardProperty(new ast.ImplicitCardNode());
		}
		case "cardType": {
			return parseCardType();
		}
		default: {
			throw new ScriptParserError("A '" + tokens[pos].type + "' token does not start a valid value.");
		}
	}
}

function parseCardProperty(cardsNode) {
	let node = new ast.CardPropertyNode(cardsNode, tokens[pos].value);
	pos++;
	return node;
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
	let node = new ast.ValueArrayNode([value]);
	pos++;
	return node;
}

function parseBool() {
	let node = new ast.BoolNode(tokens[pos].value);
	pos++;
	return node;
}

function parseCardId() {
	let node = new ast.ValueArrayNode([tokens[pos].value]);
	pos++;
	return node;
}

function parsePlayer() {
	let node = new ast.PlayerNode(tokens[pos].value);
	pos++;
	return node;
}

function parseType() {
	let node = new ast.ValueArrayNode([tokens[pos].value]);
	pos++;
	return node;
}

function parseCardType() {
	let node = new ast.ValueArrayNode([tokens[pos].value]);
	pos++;
	return node;
}

function parseList(type) {
	let elements = [];
	pos++;
	while (tokens[pos].type == type) {
		elements.push(tokens[pos].value);
		pos++;
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}
	if (tokens[pos].type != "rightBracket") {
		throw new ScriptParserError("Expected a 'rightBracket' at the end of a list. Got '" + tokens[pos].type + "' instead.");
	}
	pos++;
	return new ast.ValueArrayNode(elements);
}

function parseZone() {
	let node = new ast.ZoneNode(tokens[pos].value);
	pos++;
	return node;
}

function parseCardMatcher() {
	pos++;
	pos++; // just skip over the 'from' token
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

	let conditions = null;
	if (tokens[pos].type == "where") {
		pos++;
		conditions = parseExpression();
	}

	if (tokens[pos].type != "rightBracket") {
		throw new ScriptParserError("Expected a 'rightBracket' token at the end of card matcher syntax. Got '" + tokens[pos].type + "' instead.");
	}

	pos++;
	return new ast.CardMatchNode(zones, conditions);
}