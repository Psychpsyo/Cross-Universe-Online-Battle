// getting a card's image link from its ID
function getCardImageFromID(cardId) {
	return "https://crossuniverse.net/images/cards/" + (locale.warnings.includes("noCards")? "en" : locale.code) + "/" + cardId + ".jpg";
}

//track shift key
document.addEventListener("keydown", function(e) {
	if (e.key === "Shift") {
		shiftHeld = true;
	}
});
document.addEventListener("keyup", function(e) {
	if (e.key === "Shift") {
		shiftHeld = false;
	}
});
//track ctrl key
document.addEventListener("keydown", function(e) {
	if (e.key === "Control") {
		ctrlHeld = true;
	}
});
document.addEventListener("keyup", function(e) {
	if (e.key === "Control") {
		ctrlHeld = false;
	}
});
//track alt key
document.addEventListener("keydown", function(e) {
	if (e.key === "Alt") {
		altHeld = true;
	}
});
document.addEventListener("keyup", function(e) {
	if (e.key === "Alt") {
		altHeld = false;
	}
});

window.addEventListener("blur", function(e) {
	shiftHeld = false;
	ctrlHeld = false;
	altHeld = false;
});