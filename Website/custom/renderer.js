function loadImage(imageUrl) {
	return new Promise((resolve, reject) => {
		let img = new Image();
		img.addEventListener("load", function() {
			resolve(img);
		});
		img.src = imageUrl;
	});
};

let backgrounds = {
	"unit": loadImage("/custom/images/unit.png"),
	"standardSpell": loadImage("/custom/images/spell.png"),
	"standardItem": loadImage("/custom/images/item.png"),
	"token": loadImage("/custom/images/token.png")
}
// set spell & item variants
backgrounds.continuousSpell = backgrounds.standardSpell;
backgrounds.enchantSpell = backgrounds.standardSpell;
backgrounds.continuousItem = backgrounds.standardItem;
backgrounds.equipableItem = backgrounds.standardItem;

// bracket images
let bracketLeftTop = loadImage("/custom/images/bracketLeftTop.png");
let bracketLeftMiddle = loadImage("/custom/images/bracketLeftMiddle.png");
let bracketLeftBottom = loadImage("/custom/images/bracketLeftBottom.png");
let bracketRightTop = loadImage("/custom/images/bracketRightTop.png");
let bracketRightMiddle = loadImage("/custom/images/bracketRightMiddle.png");
let bracketRightBottom = loadImage("/custom/images/bracketRightBottom.png");

const lineGap = 3;

// TODO: load these from regular locale files!
let localeStrings = {
	"en": {
		"attack": "Attack:",
		"defense": "Defense:",
		
		"standardSpell": "Standard Spell",
		"enchantSpell": "Enchant Spell",
		"continuousSpell": "Continuous Spell",
		"standardItem": "Standard Item",
		"equipableItem": "Equipable Item",
		"continuousItem": "Continuous Item",
		
		"ideaCredit": "Idea: ",
		
		"typeSeparator": ", ",
		"typePsychic": "Psychic",
		"typeDragon": "Dragon",
		"typeFigure": "Figure",
		"typeSamurai": "Samurai",
		"typeLight": "Light",
		"typeKatana": "Katana",
		"typeSword": "Sword",
		"typeCurse": "Curse",
		"typeEarth": "Earth",
		"typeLandmine": "Landmine",
		"typeAngel": "Angel",
		"typeRock": "Rock",
		"typeIllusion": "Illusion",
		"typeStructure": "Structure",
		"typeDemon": "Demon",
		"typeWarrior": "Warrior",
		"typeBook": "Book",
		"typePlant": "Plant",
		"typeMachine": "Machine",
		"typeGhost": "Ghost",
		"typeWater": "Water",
		"typeIce": "Ice",
		"typeFire": "Fire",
		"typeBeast": "Beast",
		"typeShield": "Shield",
		"typeMyth": "Myth",
		"typeSpirit": "Spirit",
		"typeBoundary": "Boundary",
		"typeMedicine": "Medicine",
		"typeBug": "Bug",
		"typeGravity": "Gravity",
		"typeChain": "Chain",
		"typeArmor": "Armor",
		"typeDark": "Dark",
		"typeElectric": "Electric",
		"typeWind": "Wind",
		"typeMage": "Mage",
		"typeFish": "Fish",
		"typeBird": "Bird"
	},
	"ja": {
		"attack": "攻撃力",
		"defense": "防御力",
		
		"standardSpell": "通常スペル",
		"enchantSpell": "付与スペル",
		"continuousSpell": "永続スペル",
		"standardItem": "通常アイテム",
		"equipableItem": "装備アイテム",
		"continuousItem": "永続アイテム",
		
		"ideaCredit": "原案：",
		
		"typeSeparator": ",",
		"typePsychic": "PSI",
		"typeDragon": "ドラゴン",
		"typeFigure": "人形",
		"typeSamurai": "侍",
		"typeLight": "光",
		"typeKatana": "刀",
		"typeSword": "剣",
		"typeCurse": "呪い",
		"typeEarth": "地",
		"typeLandmine": "地雷",
		"typeAngel": "天使",
		"typeRock": "岩石",
		"typeIllusion": "幻想",
		"typeStructure": "建造物",
		"typeDemon": "悪鬼",
		"typeWarrior": "戦士",
		"typeBook": "書物",
		"typePlant": "植物",
		"typeMachine": "機械",
		"typeGhost": "死霊",
		"typeWater": "水",
		"typeIce": "氷",
		"typeFire": "炎",
		"typeBeast": "獣",
		"typeShield": "盾",
		"typeMyth": "神話",
		"typeSpirit": "精霊",
		"typeBoundary": "結界",
		"typeMedicine": "薬",
		"typeBug": "虫",
		"typeGravity": "重力",
		"typeChain": "鎖",
		"typeArmor": "鎧",
		"typeDark": "闇",
		"typeElectric": "雷",
		"typeWind": "風",
		"typeMage": "魔術師",
		"typeFish": "魚",
		"typeBird": "鳥"
	}
}

// Recursively formats the effect tree from a card's data to a string with proper new lines and indentation.
// fontSize is used to determine when line breaks should be inserted
// blockParent specifies whether or not the outer effect section was a block, as opposed to a bullet point. (This controls whether or not inner bullet points use full indentation or are indented outwards by one space)
function formatEffectText(content, indent, fontSize, blockParent, ctx, bracketCount, lineCount) {
	let text = "";
	let bracketList = [];
	content.forEach((child, i) => {
		if (i > 0) {
			text += "\n" + "　".repeat(indent);
		}
		switch(child.type) {
			case "bullet": {
				if (!blockParent) {
					text = text.slice(0, -1);
				}
				text += "●：";
				let childResult = formatEffectText(child.content, indent + 2, fontSize, false, ctx, bracketCount, lineCount + text.split("\n").length - 1);
				text += childResult.text;
				bracketList.push(...childResult.brackets);
				break;
			}
			case "brackets": {
				if (!blockParent) {
					text = text.slice(0, -1);
				}
				console.log(text);
				let bracket = {
					"indent": blockParent? indent : indent - 2,
					"firstLine": lineCount + text.split("\n").length - 1
				}
				let childResult = formatEffectText(child.content, indent - 1, fontSize, true, ctx, bracketCount + 1, lineCount + text.split("\n").length - 1);
				text += childResult.text;
				bracket.lastLine = lineCount + text.split("\n").length;
				bracketList.push(bracket);
				bracketList.push(...childResult.brackets);
				break;
			}
			case "text": {
				let contentString = "　".repeat(indent) + child.content;
				// place additional newlines and indents
				let lastNewLine = 0
				let currentPosition = 0
				while (currentPosition != -1) {
					let nextBreak = contentString.indexOf("\n", currentPosition + 1);
					let nextSpace = contentString.indexOf(" ", currentPosition + 1);
					let target = Math.min(nextSpace, nextBreak)
					if (nextSpace == -1) {
						target = nextBreak;
					} else if (nextBreak == -1) {
						target = nextSpace;
					}
					if (ctx.measureText(target == -1? contentString.substring(lastNewLine) : contentString.substring(lastNewLine, target)).width > 640 - bracketCount * fontSize) {
						lastNewLine = currentPosition;
						contentString = contentString.substring(0, currentPosition) + "\n" + "　".repeat(indent) + contentString.substring(currentPosition + 1);
						nextBreak = contentString.indexOf("\n", currentPosition + 1);
						nextSpace = contentString.indexOf(" ", currentPosition + 1);
					}
					// Are we about to skip a line break with currentPosition?
					if (nextSpace > nextBreak && nextBreak != -1) {
						lastNewLine = nextBreak;
						contentString = contentString.substring(0, lastNewLine + 1) + "　".repeat(indent) + contentString.substring(lastNewLine + 1);
					}
					currentPosition = contentString.indexOf(" ", currentPosition + 1);
				}
				text += contentString.substring(indent);
				break;
			}
		}
	});
	return {
		"text": text,
		"brackets": bracketList
	};
}

async function render(card, canvas, ideaCredit) {
	let language = localStorage.getItem("language");
	canvas.width = 813;
	canvas.height = 1185;
	let ctx = canvas.getContext("2d");
	
	ctx.drawImage(await backgrounds[card.cardType], 0, 0);
	
	// write level
	ctx.font = "39pt 'Yu Mincho'";
	ctx.textAlign = "center";
	ctx.fillText(card.level < 0? "？" : card.level, 684 + (card.level > 99? 10 : 0), 135);
	
	// write name
	let fontSize = 49;
	ctx.textAlign = "left";
	while (ctx.measureText(card.name).width > 477) {
		fontSize--;
		ctx.font = fontSize + "px 'Yu Mincho'";
	}
	ctx.fillText(card.name, 108, 135);
	
	// write type
	let typeString = card.types.map(type => localeStrings[language]["type" + type]).join(localeStrings[language]["typeSeparator"]);
	fontSize = 49;
	while (ctx.measureText(typeString).width > 597) {
		fontSize--;
		ctx.font = fontSize + "px 'Yu Mincho'";
	}
	ctx.textBaseline = "middle";
	ctx.fillText(typeString, 108, 676);
	
	// write text box
	fontSize = 28;
	while (formatEffectText(card.effects, 0, fontSize, true, ctx, 0, 0).text.split("\n").length * (fontSize + lineGap) > (card.cardType == "token"? 245 : (ideaCredit? 248 : 275))) {
		fontSize--;
	}
	ctx.font = fontSize + "px 'Yu Gothic UI'";
	ctx.textBaseline = "top";
	let effects = formatEffectText(card.effects, 0, fontSize, true, ctx, 0, 0);
	effects.text.split("\n").forEach((line, i) => {
		ctx.fillText(line, 89, 782 + i * (fontSize + lineGap));
	});
	// draw brackets
	effects.brackets.forEach(async bracket => {
		ctx.drawImage(await bracketLeftTop, 95 + bracket.indent * fontSize, 779 + bracket.firstLine * (fontSize + lineGap));
		ctx.drawImage(await bracketLeftMiddle, 95 + bracket.indent * fontSize, 779 + bracket.firstLine * (fontSize + lineGap) + 7, 17, (bracket.lastLine - bracket.firstLine) * (fontSize + lineGap) - 14);
		ctx.drawImage(await bracketLeftBottom, 95 + bracket.indent * fontSize, 779 + bracket.lastLine * (fontSize + lineGap) - 7);
		
		ctx.drawImage(await bracketRightTop, 701 - bracket.indent * fontSize, 779 + bracket.firstLine * (fontSize + lineGap));
		ctx.drawImage(await bracketRightMiddle, 701 - bracket.indent * fontSize, 779 + bracket.firstLine * (fontSize + lineGap) + 7, 17, (bracket.lastLine - bracket.firstLine) * (fontSize + lineGap) - 14);
		ctx.drawImage(await bracketRightBottom, 701 - bracket.indent * fontSize, 779 + bracket.lastLine * (fontSize + lineGap) - 7);
	});
	
	// write bottom section
	ctx.font = "35px 'Yu Gothic UI'";
	if (card.cardType == "unit" || card.cardType == "token") {
		ctx.fillText(localeStrings[language]["attack"], 104, 1089);
		ctx.fillText(localeStrings[language]["defense"], 415, 1089);
		
		ctx.textAlign = "right";
		ctx.fillText(card.attack < 0? "？" : card.attack, 392 + (card.attack < 0? 8 : 0), 1089);
		ctx.fillText("/", 406, 1089);
		ctx.fillText(card.defense < 0? "？" : card.defense, 708 + (card.defense < 0? 8 : 0), 1089);
	} else {
		ctx.textAlign = "center";
		ctx.fillText(localeStrings[language][card.cardType], 406, 1089);
	}
}

export {render};