import * as ast from "./astNodes.js";
import * as valueModifiers from "../valueModifiers.js";

let pos; // the current position in the token stream
let tokens; // the token stream emitted by the lexer
let effectId; // The effect that is currently being parsed.
let cardId; // the card the effect is on

// contains a list of objects holding variable definition types, indexed by their card IDs, like so:
// {
// 	"CUU00161": {
// 		"$units": "card"
// 	}
// }
let foundVariables = {};

class ScriptParserError extends Error {
	constructor(message) {
		super("On " + effectId + " : " + message);
		this.name = "ScriptParserError";
	}
}

export function parseScript(tokenList, newEffectId, type) {
	if (tokenList.length == 0) {
		return null;
	}
	effectId = newEffectId;
	cardId = effectId.substring(0, effectId.indexOf(":"));
	tokens = tokenList;
	pos = 0;

	switch (type) {
		case "applyTarget":
		case "cardCondition":
		case "condition":
		case "during":
		case "equipableTo":
		case "gameLimit":
		case "globalTurnLimit":
		case "turnLimit": {
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
	let variableName = null;
	if (tokens[pos].type === "variable" && tokens[pos+1].type === "equals") {
		variableName = tokens[pos].value;
		pos += 2;
	}
	let expr = parseExpression();
	// check variable type
	if (variableName) {
		if (!foundVariables[cardId]) {
			foundVariables[cardId] = {};
		}
		if (!foundVariables[cardId][variableName]) {
			foundVariables[cardId][variableName] = expr.returnType;
		} else if (foundVariables[cardId][variableName] !== expr.returnType) {
			new ScriptParserError("Invalid assignment of type " + expr.returnType + " to variable " + variableName + " of type " + foundVariables[cardId][variableName] + ".")
		}
	}
	return new ast.LineNode(expr, variableName);
}

function parseFunction() {
	let player;
	switch (tokens[pos].type) {
		case "function": {
			player = new ast.PlayerNode("own");
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
	let expression = [];
	let needsReturnType = [];
	while (tokens[pos] && !["rightParen", "rightBracket", "rightBrace", "newLine", "separator", "if"].includes(tokens[pos].type)) {
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
					continue;
				}
			}
			needsReturnType.push(expression[expression.length - 1]);
			pos++;
		}
	}

	if (expression.length == 0) {
		return null;
	}

	for (let type of [ast.DotMathNode, ast.DashMathNode, ast.ComparisonNode, ast.LogicNode]) {
		for (let i = 0; i < expression.length; i++) {
			if (expression[i] instanceof type && expression[i].leftSide === null && expression[i].rightSide === null) {
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
	while (needsReturnType.length > 0) {
		for (let i = needsReturnType.length - 1; i >= 0; i--) {
			if (needsReturnType[i].returnType !== null) {
				needsReturnType.splice(i, 1);
				continue;
			}
			if (needsReturnType[i].leftSide.returnType) {
				needsReturnType[i].returnType = needsReturnType[i].leftSide.returnType;
				needsReturnType.splice(i, 1);
			}
		}
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
			return parseList();
		}
		case "function": {
			return parseFunction();
		}
		case "cardType":
		case "cardId":
		case "counter":
		case "dueToReason":
		case "type": {
			return parseValueArray();
		}
		case "phaseType": {
			let node = new ast.PhaseNode(null, tokens[pos].value);
			pos++;
			return node;
		}
		case "blockType": {
			let node = new ast.BlockNode(tokens[pos].value);
			pos++;
			return node;
		}
		case "zone": {
			return parseZone();
		}
		case "deckPosition": {
			let node = new ast.DeckPositionNode(new ast.PlayerNode("both"), tokens[pos].value);
			pos++;
			return node;
		}
		case "bool": {
			return parseBool();
		}
		case "leftParen": {
			pos++;
			const node = parseExpression();
			if (tokens[pos].type == "rightParen") {
				pos++;
			} else {
				throw new ScriptParserError("Found unwanted '" + tokens[pos].type + "' token instead of ')' at the end of parenthesized expression value.");
			}
			return node;
		}
		case "variable": {
			let variable = parseVariable();
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				switch (tokens[pos].type) {
					case "phaseType":
					case "turn":
					case "function":
					case "deckPosition":
					case "playerProperty":
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
			}
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				return parseCardDotAccess(cards);
			}
			return cards;
		}
		case "cardProperty": {
			return parseCardProperty(new ast.ImplicitValuesNode("card"));
		}
		case "playerProperty": {
			return parsePlayerDotAccess(new ast.ImplicitValuesNode("player"));
		}
		case "actionAccessor": {
			return parseActionAccessor(new ast.ImplicitValuesNode("action"));
		}
		case "currentBlock": {
			pos++;
			return new ast.CurrentBlockNode();
		}
		case "currentPhase": {
			pos++;
			return new ast.CurrentPhaseNode();
		}
		case "currentTurn": {
			let node = new ast.CurrentTurnNode();
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				if (tokens[pos].type == "actionAccessor") {
					return parseActionAccessor(node);
				} else {
					throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' when trying to access property of a currentTurn.");
				}
			}
			return node;
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

function parsePlayerDotAccess(playerNode) {
	switch (tokens[pos].type) {
		case "playerProperty": {
			let property = tokens[pos].value;
			let node = new ast.PlayerPropertyNode(playerNode, tokens[pos].value);
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				if (property === "partner") {
					return parseCardDotAccess(node);
				} // else
				throw new ScriptParserError("Unwanted 'dotOperator' after card property '" + property + "'.");
			}
			return node;
		}
		case "function": {
			return parseFunctionToken(playerNode);
		}
		case "deckPosition": {
			let node = new ast.DeckPositionNode(playerNode, tokens[pos].value);
			pos++;
			return node;
		}
		case "zone": {
			return parseZoneToken(playerNode);
		}
		case "turn": {
			pos++;
			return new ast.TurnNode(playerNode);
		}
		case "phaseType": {
			let node = new ast.PhaseNode(playerNode, tokens[pos].value);
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
	let property = tokens[pos].value;
	let node = new ast.CardPropertyNode(cardsNode, tokens[pos].value);
	pos++;
	if (tokens[pos] && tokens[pos].type == "dotOperator") {
		pos++;
		switch (property) {
			case "owner":
			case "baseOwner": {
				return parsePlayerDotAccess(node);
			}
			case "equipments":
			case "equippedUnit":
			case "fightingAgainst": {
				return parseCardDotAccess(node);
			}
			default: {
				throw new ScriptParserError("Unwanted 'dotOperator' after card property '" + property + "'.");
			}
		}

	}
	return node;
}

function parseActionAccessor(actionsNode) {
	let actionType = tokens[pos].value;
	pos++;
	// accessor properties like 'dueTo' or 'by'
	let properties = {};
	if (tokens[pos].type === "leftParen") {
		pos++;
		while (["accessorProperty", "from"].includes(tokens[pos].type)) {
			let property = tokens[pos].value;
			pos++;
			if (tokens[pos].type !== "colon") {
				throw new ScriptParserError("Accessor property must be followed by colon. Got " + tokens[pos].value + " instead.");
			}
			pos++;
			properties[property] = parseExpression();
			if (tokens[pos].type === "separator") pos++;
		}
		pos++;
	}
	let node = new ast.ActionAccessorNode(actionsNode, actionType, properties);
	if (tokens[pos].type == "dotOperator") {
		pos++;
		return parseCardDotAccess(node);
	}
	return node;
}

function parseVariable() {
	if (!foundVariables[cardId][tokens[pos].value]) {
		throw new ScriptParserError("Reference to unassigned variable " + tokens[pos].value + ".");
	}
	let node = new ast.VariableNode(tokens[pos].value, foundVariables[cardId][tokens[pos].value]);
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
	let node = new ast.ValueArrayNode([value], "number");
	pos++;
	return node;
}

function parseBool() {
	let node = new ast.BoolNode(tokens[pos].value);
	pos++;
	return node;
}

function parseValueArray() {
	let node = new ast.ValueArrayNode([tokens[pos].value], tokens[pos].type);
	pos++;
	return node;
}

function parseList() {
	let elements = [];
	pos++;
	let type = tokens[pos].type;
	while (tokens[pos].type === type) {
		elements.push(tokens[pos].value);
		pos++;
		if (tokens[pos].type === "separator") {
			pos++;
		}
	}
	if (tokens[pos].type !== "rightBracket") {
		throw new ScriptParserError("Expected a 'rightBracket' at the end of a list. Got '" + tokens[pos].type + "' instead.");
	}
	pos++;
	return new ast.ValueArrayNode(elements, type);
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
		switch (tokens[pos+1].type) {
			case "cancel": {
				valueModifications.push(parseAbilityCancelModification());
				break;
			}
			case "cardProperty":
			case "playerProperty": {
				valueModifications = valueModifications.concat(parseValueModifications());
				break;
			}
			default: {
				throw new ScriptParserError("Unexpected '" + tokens[pos].type + "' token at start of modifier syntax instead.");
			}
		}
	}
	pos++;
	return new ast.ModifierNode(valueModifications);
}

function parseAbilityCancelModification() {
	pos += 2;
	let rightHandSide = parseExpression();

	// maybe parse 'if' condition
	let condition = null;
	if (tokens[pos].type == "if") {
		pos++;
		condition = parseExpression();
	}

	return new valueModifiers.AbilityCancelModification("abilities", rightHandSide, false, condition);
}

function parseValueModifications() {
	let valueIdentifiers = [];
	let propertyType = null;
	do {
		pos++;
		if (!["cardProperty", "playerProperty"].includes(tokens[pos].type)) {
			throw new ScriptParserError("Expected only object property tokens at the start of a modifier assignment. Got '" + tokens[pos].type + "' instead.");
		}
		if (propertyType && tokens[pos].type != propertyType) {
			throw new ScriptParserError("All properties in a modifier assignment must belong to the same type of object. (player, card...)");
		}
		propertyType = tokens[pos].type;
		valueIdentifiers.push(tokens[pos].value);
		pos++;
	} while (tokens[pos].type == "separator");

	let toBaseValues = [];
	for (let i = 0; i < valueIdentifiers.length; i++) {
		if (valueIdentifiers[i].startsWith("base")) {
			valueIdentifiers[i] = valueIdentifiers[i][4].toLowerCase() + valueIdentifiers[i].substr(5);
			toBaseValues.push(true);
		} else {
			toBaseValues.push(false);
		}
		if (valueIdentifiers[i] == "name") {
			valueIdentifiers[i] = "names";
		}
	}

	if (!["immunityAssignment", "equals", "plusAssignment", "minusAssignment", "divideAssignment", "swapAssignment"].includes(tokens[pos].type)) {
		throw new ScriptParserError("Unwanted '" + tokens[pos].type + "' token as operator in modifier syntax.");
	}
	let assignmentType = tokens[pos].type;
	pos++;

	let rightHandSide;
	if (assignmentType != "swapAssignment") {
		rightHandSide = parseExpression();
	} else {
		if (tokens[pos].type != propertyType) {
			throw new ScriptParserError("Swap modifier (><) can only swap object properties with other properties for the same object type. (Got '" + tokens[pos].type + "' token when '" + propertyTypes + "' was expected.)");
		}
		rightHandSide = tokens[pos].value;
		pos++;
	}

	// maybe parse 'if' condition
	let condition = null;
	if (tokens[pos].type == "if") {
		pos++;
		condition = parseExpression();
	}

	let valueModifications = [];
	for (const [i, valueIdentifier] of valueIdentifiers.entries()) {
		switch (assignmentType) {
			case "immunityAssignment": {
				valueModifications.push(new valueModifiers.ValueUnaffectedModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "equals": {
				valueModifications.push(new valueModifiers.ValueSetModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "plusAssignment": {
				if (["level", "attack", "defense", "manaGainAmount", "standardDrawAmount"].includes(valueIdentifier)) {
					valueModifications.push(new valueModifiers.NumericChangeModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				} else {
					valueModifications.push(new valueModifiers.ValueAppendModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				}
				break;
			}
			case "minusAssignment": {
				if (!["level", "attack", "defense", "manaGainAmount", "standardDrawAmount"].includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot subtract from non-number card property '" + valueIdentifier + "'.");
				}
				valueModifications.push(new valueModifiers.NumericChangeModification(valueIdentifier, new ast.UnaryMinusNode(rightHandSide), toBaseValues[i], condition));
				break;
			}
			case "divideAssignment": {
				if (!["level", "attack", "defense", "manaGainAmount", "standardDrawAmount"].includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot divide non-number card property '" + valueIdentifier + "'.");
				}
				valueModifications.push(new valueModifiers.NumericDivideModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "swapAssignment": {
				if (rightHandSide.startsWith("base") != toBaseValues[i]) {
					throw new ScriptParserError("Swap modifier (><) cannot swap base value with non-base value.");
				}
				if (toBaseValues[i]) {
					rightHandSide = rightHandSide[4].toLowerCase() + rightHandSide.substr(5);
				}
				valueModifications.push(new valueModifiers.ValueSwapModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
		}
	}
	return valueModifications;
}