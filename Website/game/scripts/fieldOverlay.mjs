// This file handles displaying lines on the field (for equipable items and stuff) by modifying an SVG element.

import {FieldZone} from "/rulesEngine/src/zones.mjs";

// the field graphic is 70vh tall so card slots are positioned relative to that.
let vh = 1024 / 70;
let cardXdist = 84.75 * vh / 7; // all 7 columns of card slots together are 84.75vh wide.
let cardYdist = 32 * vh / 2; // one player's field of 2 rows is 32vh tall.
let xMiddle = 654; // this is the horizontal center of the SVG.
let yOuter = 512 - cardYdist / 2; // the very top and bottom of the SVG are Y = 512 and -512 so this is the center of the back row.

// slotX and slotY range from -2 to 2. Providing slotY = 0 will return a point in the vertical center of the field.
function getSlotXY(slotX, slotY) {
	let xPos = xMiddle + slotX * cardXdist;
	let yPos = yOuter * Math.sign(slotY) - (2 * Math.sign(slotY) - slotY) * cardYdist;
	return [xPos, yPos];
}
function getCardXY(card) {
	let slotX = 0;
	let slotY = 0;
	switch (card.zone.type) {
		case "unit": {
			slotX = card.index - 2;
			slotY = 1;
			break;
		}
		case "spellItem": {
			slotX = card.index - 2;
			if (slotX >= 0) {
				slotX += 1;
			}
			slotY = 2;
			break;
		}
		case "partner": {
			slotY = 2;
			break;
		}
	}
	if (card.currentOwner() !== localPlayer) {
		slotX *= -1;
		slotY *= -1;
	}
	return [slotX, slotY];
}
function getCardSlotXY(card) {
	return getSlotXY(...getCardXY(card));
}

export function equipLine(fromCard, toCard) {
	if (!(fromCard.zone instanceof FieldZone && toCard.zone instanceof FieldZone)) {
		return null;
	}
	let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
	let start = getCardSlotXY(fromCard);
	let end = getCardSlotXY(toCard);
	line.setAttribute("x1", start[0]);
	line.setAttribute("y1", start[1]);
	line.setAttribute("x2", end[0]);
	line.setAttribute("y2", end[1]);

	let dashes = line.cloneNode();
	line.classList.add("equipLine");
	dashes.classList.add("equipDashes");

	let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
	g.appendChild(line);
	g.appendChild(dashes);
	fieldSvg.appendChild(g);
	return g;
}