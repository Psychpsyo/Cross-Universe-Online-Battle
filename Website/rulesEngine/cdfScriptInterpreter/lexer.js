let keywordTokenTypes = {
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
	you: "player",
	opponent: "player",
	from: "from",
	set: "set",
	APPLY: "function",
	DAMAGE: "function",
	DISCARD: "function",
	DRAW: "function",
	EXILE: "function",
	SELECT: "function"
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
					tokens.push({type: keywordTokenTypes[word] ?? "name", value: word});
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
