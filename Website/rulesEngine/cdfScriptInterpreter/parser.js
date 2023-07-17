import * as ast from "./astNodes.js";
import * as cardValues from "../cardValues.js";

let pos;
let tokens;
let effectId; // The effect that is currently being parsed.

class ScriptParserError extends Error {
	constructor(message) {
		super("On " + effectId + " : " + message);
		this.name = "ScriptParserError";
	}
}

export function parseScript(tokenList, newEffectId, type) {
	effectId = newEffectId;
	tokens = tokenList;
	pos = 0;

	switch (type) {
		case "applyTarget": {
			return new ast.ApplyTargetRootNode(parseExpression());
		}
		case "equipableTo":
		case "during":
		case "condition": {
			return parseExpression();
		}
		case "trigger": {
			return new ast.TriggerRootNode(parseExpression());
		}
		case "modifier": {
			return parseModifier();
		}
		default: {
			let steps = [];
			while(pos < tokens.length) {
				if (tokens[pos].type == "newLine") {
					pos++;
				} else {
					steps.push(parseLine());
				}
			}
			return new ast.ScriptRootNode(steps);
		}
	}
}

function parseLine() {
	let actionNodes = [];
	let variableName = null;
	do {
		switch (tokens[pos].type) {
			case "function": {
				actionNodes.push(parseFunction());
				break;
			}
			case "variable": {
				switch (tokens[pos+1].type) {
					case "equals": {
						variableName = tokens[pos].value;
						pos += 2;
						actionNodes.push(parseExpression());
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
	return new ast.LineNode(actionNodes, variableName);
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
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "function") {
				throw new ScriptParserError("Failed to parse function.");
			}
			pos++;
			break;
		}
		case "variable": {
			player = parseVariable();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "function") {
				throw new ScriptParserError("Failed to parse function.");
			}
			pos++;
			break;
		}
		default: {
			throw new ScriptParserError("Encountered unwanted '" + tokens[pos].type + "' while trying to parse a function.");
		}
	}

	return parseFunctionToken(player);
}

function parseFunctionToken(player) {
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

function parseExpression() {
	let insideParens = false;
	if (tokens[pos].type == "leftParen") {
		insideParens = true;
		pos++;
	}
	let expression = [];
	while (tokens[pos] && !["rightParen", "rightBracket", "rightBrace", "newLine", "separator"].includes(tokens[pos].type)) {
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
				case "divide": {
					expression.push(new ast.DivideNode(null, null));
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
	}

	if (expression.length == 0) {
		return null;
	}

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
		case "number": {
			return parseNumber();
		}
		case "anyAmount": {
			pos++;
			return new ast.AnyAmountNode();
		}
		case "allTypes": {
			pos++;
			return new ast.AllTypesNode();
		}
		case "minus": {
			pos++;
			return new ast.UnaryMinusNode(parseValue());
		}
		case "bang": {
			pos++;
			return new ast.UnaryNotNode(parseValue());
		}
		case "player": {
			let player = parsePlayer();
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				return parsePlayerDotAccess(player);
			}
			return player;
		}
		case "leftBracket": {
			if (tokens[pos+1].type == "from") {
				let cardMatcher = parseCardMatcher();
				if (tokens[pos] && tokens[pos].type == "dotOperator") {
					pos++;
					return parseCardDotAccess(cardMatcher);
				}
				return cardMatcher;
			}
			return parseList(tokens[pos+1].type);
		}
		case "function": {
			return parseFunction();
		}
		case "cardType":
		case "cardId":
		case "type": {
			return parseValueArray();
		}
		case "phaseType": {
			let node = new ast.PhaseNode(null, tokens[pos].value);
			pos++;
			return node;
		}
		case "zone": {
			return parseZone();
		}
		case "bool": {
			return parseBool();
		}
		case "leftParen": {
			return parseExpression();
		}
		case "variable": {
			let variable = parseVariable();
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				switch (tokens[pos].type) {
					case "phaseType":
					case "turn":
					case "function":
					case "zone": {
						return parsePlayerDotAccess(variable);
					}
					case "cardProperty": {
						return parseCardDotAccess(variable);
					}
					case "actionAccessor": {
						return parseActionAccessor(variable);
					}
					default: {
						throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' when trying to access property of a variable.");
					}
				}
			}
			return variable;
		}
		case "thisCard":
		case "attackTarget":
		case "equipment":
		case "equippedUnit":
		case "attackers": {
			let cards;
			switch (tokens[pos].type) {
				case "thisCard":
					cards = new ast.ThisCardNode();
					break;
				case "attackTarget":
					cards = new ast.AttackTargetNode();
					break;
				case "attackers":
					cards = new ast.AttackersNode();
					break;
				case "equipment":
					cards = new ast.EquipmentNode();
					break;
				case "equippedUnit":
					cards = new ast.EquippedToNode();
			}
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				return parseCardDotAccess(cards);
			}
			return cards;
		}
		case "cardProperty": {
			return parseCardProperty(new ast.ImplicitCardNode());
		}
		case "actionAccessor": {
			return parseActionAccessor(new ast.ImplicitActionsNode());
		}
		case "currentPhase": {
			pos++;
			return new ast.CurrentPhaseNode();
		}
		case "currentTurn": {
			pos++;
			return new ast.CurrentTurnNode();
		}
		case "leftBrace": {
			return parseModifier();
		}
		case "untilIndicator": {
			let node = new ast.UntilIndicatorNode(tokens[pos].value);
			pos++;
			return node;
		}
		default: {
			throw new ScriptParserError("A '" + tokens[pos].type + "' token does not start a valid value.");
		}
	}
}

function parsePlayerDotAccess(player) {
	switch (tokens[pos].type) {
		case "function": {
			return parseFunctionToken(player);
		}
		case "zone": {
			return parseZoneToken(player);
		}
		case "turn": {
			pos++;
			return new ast.TurnNode(player);
		}
		case "phaseType": {
			let node = new ast.PhaseNode(player, tokens[pos].value);
			pos++;
			return node;
		}
		case "playerLife": {
			let node = new ast.LifeNode(player);
			pos++;
			return node;
		}
		case "playerMana": {
			let node = new ast.ManaNode(player);
			pos++;
			return node;
		}
	}
	throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' when trying to access player value.");
}
function parseCardDotAccess(card) {
	if (tokens[pos].type != "cardProperty") {
		throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' when trying to access card property.");
	}
	return parseCardProperty(card);
}

function parseCardProperty(cardsNode) {
	let node = new ast.CardPropertyNode(cardsNode, tokens[pos].value);
	pos++;
	return node;
}

function parseActionAccessor(actionsNode) {
	let node = new ast.ActionAccessorNode(actionsNode, tokens[pos].value);
	pos++;
	if (tokens[pos].type == "dotOperator") {
		pos++;
		return parseCardDotAccess(node);
	}
	return node;
}

function parseVariable() {
	let node = new ast.VariableNode(tokens[pos].value);
	pos++;
	return node;
}
function parsePlayer() {
	let node = new ast.PlayerNode(tokens[pos].value);
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

function parseValueArray() {
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
	let player = null;
	switch (tokens[pos].type) {
		case "zone": {
			// null player will be interpreted as both players
			break;
		}
		case "player": {
			player = parsePlayer();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "zone") {
				throw new ScriptParserError("Failed to parse zone.");
			}
			pos++;
			break;
		}
		case "variable": {
			player = parseVariable();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "zone") {
				throw new ScriptParserError("Failed to parse zone.");
			}
			pos++;
			break;
		}
		default: {
			throw new ScriptParserError("Encountered unwanted '" + tokens[pos].type + "' while trying to parse a zone.");
		}
	}

	return parseZoneToken(player);
}
function parseZoneToken(player) {
	let node = new ast.ZoneNode(tokens[pos].value, player);
	pos++;
	return node;
}

function parseCardMatcher() {
	pos++;
	pos++; // just skip over the 'from' token
	let cardLists = [];
	while (tokens[pos].type != "where" && tokens[pos].type != "rightBracket") {
		cardLists.push(parseValue());
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
	return new ast.CardMatchNode(cardLists, conditions);
}

function parseModifier() {
	let valueModifications = [];
	while (tokens[pos] && tokens[pos].type != "rightBrace") {
		pos++;
		if (tokens[pos].type != "cardProperty") {
			throw new ScriptParserError("Expected a 'cardProperty' token at the start of a modifier assignment. Got '" + tokens[pos].type + "' instead.");
		}
		let valueIdentifier = tokens[pos].value;
		let toBaseValues = false;
		if (valueIdentifier.startsWith("base")) {
			valueIdentifier = valueIdentifier[4].toLowerCase() + valueIdentifier.substr(5);
			toBaseValues = true;
		}
		if (valueIdentifier == "name") {
			valueIdentifier = "names";
		}

		pos++;
		if (!["equals", "plusAssignment", "minusAssignment", "divideAssignment", "swapAssignment"].includes(tokens[pos].type)) {
			throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' token as operator in modifier syntax.");
		}
		let assignmentType = tokens[pos].type;

		pos++;
		switch (assignmentType) {
			case "equals": {
				valueModifications.push(new cardValues.ValueSetModification(valueIdentifier, parseExpression(), toBaseValues));
				break;
			}
			case "plusAssignment": {
				if (["level", "attack", "defense"].includes(valueIdentifier)) {
					valueModifications.push(new cardValues.NumericChangeModification(valueIdentifier, parseExpression(), toBaseValues));
				} else {
					valueModifications.push(new cardValues.ValueAppendModification(valueIdentifier, parseExpression(), toBaseValues));
				}
				break;
			}
			case "minusAssignment": {
				if (!["level", "attack", "defense"].includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot subtract from non-number card property '" + valueIdentifier + "'.");
				}
				valueModifications.push(new cardValues.NumericChangeModification(valueIdentifier, new ast.UnaryMinusNode(parseExpression()), toBaseValues));
				break;
			}
			case "divideAssignment": {
				if (!["level", "attack", "defense"].includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot divide non-number card property '" + valueIdentifier + "'.");
				}
				valueModifications.push(new cardValues.NumericDivideModification(valueIdentifier, parseExpression(), toBaseValues));
				break;
			}
			case "swapAssignment": {
				if (tokens[pos].type != "cardProperty") {
					throw new ScriptParserError("Modifier can only swap card properties with other card properties. (Got '" + tokens[pos].type + "' token instead.)");
				}
				let otherIdentifier = tokens[pos].value;
				pos++;
				if (otherIdentifier.startsWith("base") != toBaseValues) {
					throw new ScriptParserError("Modifier cannot swap base value with non-base value.");
				}
				if (toBaseValues) {
					otherIdentifier = otherIdentifier[4].toLowerCase() + otherIdentifier.substr(5);
				}
				valueModifications.push(new cardValues.ValueSwapModification(valueIdentifier, otherIdentifier, toBaseValues));
				break;
			}
		}
	}
	pos++;
	return new ast.ModifierNode(valueModifications);
}