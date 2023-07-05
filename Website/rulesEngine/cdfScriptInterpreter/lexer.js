let keywordTokenTypes = {
	from: "from",
	where: "where",
	thisCard: "thisCard",
	currentPhase: "currentPhase",
	currentTurn: "currentTurn",
	turn: "turn",
	any: "anyAmount",
	allTypes: "allTypes",
	life: "playerLife",
	mana: "playerMana",

	yes: "bool",
	no: "bool",

	you: "player",
	opponent: "player",

	name: "cardProperty",
	baseName: "cardProperty",
	level: "cardProperty",
	baseLevel: "cardProperty",
	types: "cardProperty",
	baseTypes: "cardProperty",
	attack: "cardProperty",
	baseAttack: "cardProperty",
	defense: "cardProperty",
	baseDefense: "cardProperty",
	cardType: "cardProperty",
	baseCardType: "cardProperty",
	owner: "cardProperty",
	baseOwner: "cardProperty",
	self: "cardProperty",
	zone: "cardProperty",

	field: "zone",
	deck: "zone",
	discard: "zone",
	exile: "zone",
	hand: "zone",
	unitZone: "zone",
	spellItemZone: "zone",
	partnerZone: "zone",

	manaSupplyPhase: "phase",
	drawPhase: "phase",
	mainPhase: "phase",
	mainPhase1: "phase",
	battlePhase: "phase",
	mainPhase2: "phase",
	endPhase2: "phase",

	unit: "cardType",
	token: "cardType",
	spell: "cardType",
	standardSpell: "cardType",
	continuousSpell: "cardType",
	enchantSpell: "cardType",
	item: "cardType",
	standardItem: "cardType",
	continuousItem: "cardType",
	enchantItem: "cardType",

	APPLY: "function",
	COUNT: "function",
	DAMAGE: "function",
	DECKTOP: "function",
	DESTROY: "function",
	DISCARD: "function",
	DRAW: "function",
	EXILE: "function",
	GAINLIFE: "function",
	GAINMANA: "function",
	LOSELIFE: "function",
	LOSEMANA: "function",
	SELECT: "function",
	SELECTPLAYER: "function",
	SUM: "function",
	SUMMON: "function",
	TOKENS: "function",

	destroyed: "actionAccessor",
	exiled: "actionAccessor",
	discarded: "actionAccessor",
	attacked: "actionAccessor",
	summoned: "actionAccessor",
	cast: "actionAccessor",
	deployed: "actionAccessor",
	targeted: "actionAccessor",
	declared: "actionAccessor",
	retired: "actionAccessor",

	forever: "untilIndicator",
	endOfTurn: "untilIndicator",
	endOfNextTurn: "untilIndicator",
	endOfYourNextTurn: "untilIndicator",
	endOfOpponentNextTurn: "untilIndicator",

	Angel: "type",
	Armor: "type",
	Beast: "type",
	Bird: "type",
	Book: "type",
	Boundary: "type",
	Bug: "type",
	Chain: "type",
	Curse: "type",
	Dark: "type",
	Demon: "type",
	Dragon: "type",
	Earth: "type",
	Electric: "type",
	Figure: "type",
	Fire: "type",
	Fish: "type",
	Ghost: "type",
	Gravity: "type",
	Ice: "type",
	Illusion: "type",
	Katana: "type",
	Landmine: "type",
	Light: "type",
	Machine: "type",
	Mage: "type",
	Medicine: "type",
	Myth: "type",
	Plant: "type",
	Psychic: "type",
	Rock: "type",
	Samurai: "type",
	Shield: "type",
	Spirit: "type",
	Structure: "type",
	Sword: "type",
	Warrior: "type",
	Water: "type",
	Wind: "type"
}

export function tokenize(code) {
	let pos = 0;
	let tokens = [];
	while (pos < code.length) {
		switch (code[pos]) {
			case " ": {
				pos++;
				break;
			}
			case "(": {
				tokens.push({type: "leftParen"});
				pos++;
				break;
			}
			case ")": {
				tokens.push({type: "rightParen"});
				pos++;
				break;
			}
			case "[": {
				tokens.push({type: "leftBracket"});
				pos++;
				break;
			}
			case "]": {
				tokens.push({type: "rightBracket"});
				pos++;
				break;
			}
			case "{": {
				tokens.push({type: "leftBrace"});
				pos++;
				break;
			}
			case "}": {
				tokens.push({type: "rightBrace"});
				pos++;
				break;
			}
			case ",": {
				tokens.push({type: "separator"});
				pos++;
				break;
			}
			case "\n": {
				tokens.push({type: "newLine"});
				pos++;
				break;
			}
			case ".": {
				tokens.push({type: "dotOperator"});
				pos++;
				break;
			}
			case "?": {
				if (code[pos+1] == "?") {
					tokens.push({type: "youMayOperator"});
					pos += 2;
				} else {
					tokens.push({type: "asmapOperator"});
					pos++;
				}
				break;
			}
			case "&": {
				tokens.push({type: "andOperator"});
				pos++;
				break;
			}
			case "|": {
				tokens.push({type: "orOperator"});
				pos++;
				break;
			}
			case "-": {
				if (code[pos+1] == "=") {
					tokens.push({type: "minusAssignment"});
					pos++;
				} else {
					tokens.push({type: "minus"});
				}
				pos++;
				break;
			}
			case "+": {
				if (code[pos+1] == "=") {
					tokens.push({type: "plusAssignment"});
					pos++;
				} else {
					tokens.push({type: "plus"});
				}
				pos++;
				break;
			}
			case "*": {
				tokens.push({type: "multiply"});
				pos++;
				break;
			}
			case "/": {
				if (code[pos+1] == "=") {
					tokens.push({type: "divideAssignment"});
					pos++;
				} else {
					tokens.push({type: "divide"});
				}
				pos++;
				break;
			}
			case "\\": {
				tokens.push({type: "floorDivide"});
				pos++;
				break;
			}
			case "=": {
				tokens.push({type: "equals"});
				pos++;
				break;
			}
			case "!": {
				if (code[pos+1] == "=") {
					tokens.push({type: "notEquals"});
					pos++;
				} else {
					tokens.push({type: "bang"});
				}
				pos++;
				break;
			}
			case ">": {
				if (code[pos+1] == "<") {
					tokens.push({type: "swapAssignment"});
					pos++;
				} else {
					tokens.push({type: "greaterThan"});
				}
				pos++;
				break;
			}
			case "<": {
				tokens.push({type: "lessThan"});
				pos++;
				break;
			}
			case "$": {
				let variableLength = 1;
				while(code[pos + variableLength] && code[pos + variableLength].match(/[a-z]/i)) {
					variableLength++;
				}
				let variableName = code.substr(pos, variableLength);
				tokens.push({type: "variable", value: variableName});
				pos += variableLength;
				break;
			}
			default: {
				if (code[pos].match(/[a-z]/i)) {
					let wordLength = 1;
					while(code[pos + wordLength] && code[pos + wordLength].match(/[a-z0-9]/i)) {
						wordLength++;
					}
					let word = code.substr(pos, wordLength);
					if (keywordTokenTypes[word]) {
						tokens.push({type: keywordTokenTypes[word], value: word});
					} else if (word.startsWith("CU")) {
						tokens.push({type: "cardId", value: code.substr(pos + 2, wordLength - 2)});
					} else {
						tokens.push({type: "name", value: word});
					}
					pos += wordLength;
					break;
				}
				if (code[pos].match(/[0-9]/)) {
					let numLength = 1;
					while(code[pos + numLength] && code[pos + numLength].match(/[0-9]/i)) {
						numLength++;
					}
					tokens.push({type: "number", value: parseInt(code.substr(pos, numLength))});
					pos += numLength;
					break;
				}
				throw new Error("Found unknown character while tokenizing: " + code.codePointAt(pos));
			}
		}
	}
	return tokens;
}