import {locale} from "/scripts/locale.mjs";

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

// Recursively formats the effect tree from a card's data to a string with proper new lines and indentation.
// fontSize is used to determine when line breaks should be inserted
// blockParent specifies whether or not the outer effect section was a block, as opposed to a bullet point. (This controls whether or not inner bullet points use full indentation or are indented outwards by one space)
function formatEffectText(content, indent, fontSize, blockParent, ctx, bracketCount, lineCount) {
	let text = "";
	let bracketList = [];
	content.forEach((child, i) => {
		if (i > 0 || (child.type != "text" && !blockParent)) {
			text += "\n" + "　".repeat(indent);
		}
		switch(child.type) {
			case "bullet": {
				if (!blockParent) {
					text = text.slice(0, -1);
				}
				text += "●：";
				let childResult = formatEffectText(child.content, indent + (blockParent? 2 : 1), fontSize, false, ctx, bracketCount, lineCount + text.split("\n").length - 1);
				text += childResult.text;
				bracketList.push(...childResult.brackets);
				break;
			}
			case "brackets": {
				if (!blockParent) {
					text = text.slice(0, -2);
				}
				text += "　";
				let myIndent = blockParent? indent : indent - 2;
				let bracket = {
					"indent": myIndent,
					"firstLine": lineCount + text.split("\n").length - 1
				}
				let childResult = formatEffectText(child.content, myIndent + 1, fontSize, true, ctx, bracketCount + 1, lineCount + text.split("\n").length - 1);
				text += childResult.text;
				bracket.lastLine = lineCount + text.split("\n").length;
				bracketList.push(bracket);
				bracketList.push(...childResult.brackets);
				break;
			}
			case "text": {
				let contentString = "";
				child.content.split("\n").forEach(line => {
					line = "　".repeat(indent) + line;

					let lastNewLine = 0;
					let currentPosition = 0;
					while (currentPosition != -1) {
						let nextSpace = line.indexOf(" ", currentPosition + 1);
						if (lastNewLine != currentPosition && ctx.measureText(nextSpace == -1? line.substring(lastNewLine) : line.substring(lastNewLine, nextSpace)).width > 640 - bracketCount * fontSize) {
							lastNewLine = currentPosition;
							line = line.substring(0, lastNewLine) + "\n" + "　".repeat(indent) + line.substring(lastNewLine + 1);
						}
						currentPosition = line.indexOf(" ", currentPosition + 1);
					}
					contentString += "\n" + line;
				});

				text += contentString.substring(indent + 1);
				break;
			}
		}
	});
	return {
		"text": text,
		"brackets": bracketList
	};
}

async function renderCard(card, canvas) {
	let language = localStorage.getItem("language");
	canvas.width = 813;
	canvas.height = 1185;
	let ctx = canvas.getContext("2d");

	ctx.fillStyle = "#B09F97";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "black";

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
	let typeString = card.types.map(type => locale["types"][type]).join(locale["typeSeparator"]);
	fontSize = 49;
	ctx.font = fontSize + "px 'Yu Mincho'";
	while (ctx.measureText(typeString).width > 597) {
		fontSize--;
		ctx.font = fontSize + "px 'Yu Mincho'";
	}
	ctx.textBaseline = "middle";
	ctx.fillText(typeString, 108, 676);

	// write text box
	fontSize = 28;
	ctx.font = fontSize + "px 'Yu Gothic UI'";
	while (formatEffectText(card.effects, 0, fontSize, true, ctx, 0, 0).text.split("\n").length * (fontSize + lineGap) > (card.cardType == "token"? 245 : (card.author? 248 : 275))) {
		fontSize--;
		ctx.font = fontSize + "px 'Yu Gothic UI'";
	}
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

	// write token notice and author (but not both)
	ctx.textBaseline = "alphabetic";
	if (card.cardType == "token") {
		ctx.font = "25px 'Yu Mincho'";
		ctx.textAlign = "center";
		ctx.fillText(locale["customCards"]["renderer"]["tokenNotice"], 406, 1045);
	} else if (card.author) {
		ctx.font = "23px 'Yu Mincho'";
		ctx.textAlign = "right";
		ctx.fillText(locale["customCards"]["renderer"]["ideaCredit"] + card.author, 707, 1048);
	}

	// write bottom section
	ctx.font = "35px 'Yu Gothic UI'";
	if (card.cardType == "unit" || card.cardType == "token") {
		ctx.textAlign = "left";
		ctx.fillText(locale["customCards"]["renderer"]["attack"], 104, 1117);
		ctx.fillText(locale["customCards"]["renderer"]["defense"], 415, 1117);

		ctx.textAlign = "right";
		ctx.fillText(card.attack < 0? "？" : card.attack, 392 + (card.attack < 0? 8 : 0), 1117);
		ctx.fillText("/", 406, 1117);
		ctx.fillText(card.defense < 0? "？" : card.defense, 708 + (card.defense < 0? 8 : 0), 1117);
	} else {
		ctx.textAlign = "center";
		ctx.fillText(locale["customCards"]["renderer"][card.cardType], 406, 1117);
	}
}

export {renderCard};