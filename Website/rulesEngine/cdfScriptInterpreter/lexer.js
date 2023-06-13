let keywordTokenTypes = {
	from: "from",
	set: "set",
	yes: "bool",
	no: "bool",
	you: "player",
	opponent: "player",
	field: "zoneIdentifier",
	deck: "zoneIdentifier",
	discard: "zoneIdentifier",
	exile: "zoneIdentifier",
	hand: "zoneIdentifier",
	unitZone: "zoneIdentifier",
	spellItemZone: "zoneIdentifier",
	partnerZone: "zoneIdentifier",
	yourField: "zoneIdentifier",
	yourDeck: "zoneIdentifier",
	yourDiscard: "zoneIdentifier",
	yourExile: "zoneIdentifier",
	yourHand: "zoneIdentifier",
	yourUnitZone: "zoneIdentifier",
	yourSpellItemZone: "zoneIdentifier",
	yourPartnerZone: "zoneIdentifier",
	opponentField: "zoneIdentifier",
	opponentDeck: "zoneIdentifier",
	opponentDiscard: "zoneIdentifier",
	opponentExile: "zoneIdentifier",
	opponentHand: "zoneIdentifier",
	opponentUnitZone: "zoneIdentifier",
	opponentSpellItemZone: "zoneIdentifier",
	opponentPartnerZone: "zoneIdentifier",
	card: "cardType",
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
	DAMAGE: "function",
	DISCARD: "function",
	DRAW: "function",
	EXILE: "function",
	LIFE: "function",
	MANA: "function",
	SELECT: "function",
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
			case "&": {
				tokens.push({type: "logical", value: "and"});
				pos++;
				break;
			}
			case "|": {
				tokens.push({type: "logical", value: "or"});
				pos++;
				break;
			}
			case "-": {
				tokens.push({type: "minus"});
				pos++;
				break;
			}
			case "=": {
				if (code[pos+1] == "!") {
					tokens.push({type: "comparison", value: "exactEquals"});
					pos += 2;
				} else {
					tokens.push({type: "comparison", value: "equals"});
					pos++;
				}
				break;
			}
			default: {
				if (code[pos].match(/[a-z]/i)) {
					let wordLength = 1;
					while(code[pos + wordLength].match(/[a-z]/i)) {
						wordLength++;
					}
					let word = code.substr(pos, wordLength);
					if (keywordTokenTypes[word]) {
						tokens.push({type: keywordTokenTypes[word], value: word});
					} else if (word.startsWith("CU")) {
						wordLength = 8;
						tokens.push({type: "cardId", value: code.substr(pos, wordLength)});
					} else {
						tokens.push({type: "name", value: word});
					}
					pos += wordLength;
					break;
				}
				if (code[pos].match(/[0-9]/)) {
					let numLength = 1;
					while(code[pos + numLength].match(/[0-9]/i)) {
						numLength++;
					}
					tokens.push({type: "number", value: parseInt(code.substr(pos, numLength))});
					pos += numLength;
					break;
				}
				console.log("Found unknown character while tokenizing: " + code.codePointAt(pos));
				pos++;
			}
		}
	}
	return tokens;
}


//DISCARD(SELECT(1, [card from yourHand]))
//DAMAGE(100, opponent)

//set unit = SELECT(1, [unit from field])
//APPLY({this.name = unit.name, this.types + unit.types}, endPhase)
