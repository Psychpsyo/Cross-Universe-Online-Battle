import {renderCard} from "/custom/renderer.js";

function getCard() {
	let card = {
		"cardType": cardType.value,
		"name": cardName.value,
		"level": cardLevel.value == ""? -1 : cardLevel.value,
		"attack": cardAttack.value,
		"defense": cardDefense.value,
		"types": [],
		"effects": []
	};
	if (localStorage.getItem("username")) {
		card.author = localStorage.getItem("username");
	}
	return card;
}

function updateCard() {
	renderCard(getCard(), cardCanvas);
}

cardName.addEventListener("input", updateCard);
cardLevel.addEventListener("input", updateCard);
cardAttack.addEventListener("input", updateCard);
cardDefense.addEventListener("input", updateCard);
cardType.addEventListener("input", updateCard);

function saveCard() {
	let cards = JSON.parse(localStorage.getItem("customCards"));
	cards.push(getCard());
	localStorage.setItem("customCards", JSON.stringify(cards));
}

saveButton.addEventListener("click", saveCard);

updateCard();