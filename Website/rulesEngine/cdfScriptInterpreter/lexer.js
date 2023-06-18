let keywordTokenTypes = {
	from: "from",
	where: "where",
	thisCard: "thisCard",
	currentPhase: "currentPhase",
	currentTurn: "currentTurn",

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

	field: "zone",
	deck: "zone",
	discard: "zone",
	exile: "zone",
	hand: "zone",
	unitZone: "zone",
	spellItemZone: "zone",
	partnerZone: "zone",
	yourField: "zone",
	yourDeck: "zone",
	yourDiscard: "zone",
	yourExile: "zone",
	yourHand: "zone",
	yourUnitZone: "zone",
	yourSpellItemZone: "zone",
	yourPartnerZone: "zone",
	opponentField: "zone",
	opponentDeck: "zone",
	opponentDiscard: "zone",
	opponentExile: "zone",
	opponentHand: "zone",
	opponentUnitZone: "zone",
	opponentSpellItemZone: "zone",
	opponentPartnerZone: "zone",

	yourTurn: "turn",
	opponentTurn: "turn",

	manaSupplyPhase: "phase",
	drawPhase: "phase",
	mainPhase: "phase",
	mainPhase1: "phase",
	battlePhase: "phase",
	mainPhase2: "phase",
	endPhase2: "phase",
	yourManaSupplyPhase: "phase",
	yourDrawPhase: "phase",
	yourMainPhase: "phase",
	yourMainPhase1: "phase",
	yourBattlePhase: "phase",
	yourMainPhase2: "phase",
	yourEndPhase2: "phase",
	opponentManaSupplyPhase: "phase",
	opponentDrawPhase: "phase",
	opponentMainPhase: "phase",
	opponentMainPhase1: "phase",
	opponentBattlePhase: "phase",
	opponentMainPhase2: "phase",
	opponentEndPhase2: "phase",

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
	LIFE: "function",
	MANA: "function",
	SELECT: "function",
	SELECTPLAYER: "function",
	SUMMON: "function",
	TOKENS: "function",

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
				tokens.push({type: "minus"});
				pos++;
				break;
			}
			case "+": {
				tokens.push({type: "plus"});
				pos++;
				break;
			}
			case "*": {
				tokens.push({type: "multiply"});
				pos++;
				break;
			}
			case "/": {
				tokens.push({type: "ceilDivide"});
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
					throw new Error("Generic not operator not currently implemented.");
				}
				pos++;
				break;
			}
			case ">": {
				tokens.push({type: "greaterThan"});
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
						tokens.push({type: "cardId", value: code.substr(pos, wordLength)});
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