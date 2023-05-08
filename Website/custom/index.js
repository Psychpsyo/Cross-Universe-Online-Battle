import {render} from "/custom/renderer.js";

function getCard() {
	return {
		"cardType": cardType.value,
		"name": cardName.value,
		"level": cardLevel.value == ""? -1 : cardLevel.value,
		"attack": cardAttack.value,
		"defense": cardDefense.value,
		"types": [],
		"effects": []
	};
}

function renderCard() {
	render(getCard(), cardCanvas, localStorage.getItem("username"));
}

cardName.addEventListener("input", renderCard);
cardLevel.addEventListener("input", renderCard);
cardAttack.addEventListener("input", renderCard);
cardDefense.addEventListener("input", renderCard);
cardType.addEventListener("input", renderCard);

function saveCard() {
	let cards = JSON.parse(localStorage.getItem("customCards"));
	cards.push(getCard());
	localStorage.setItem("customCards", JSON.stringify(cards));
}

saveButton.addEventListener("click", saveCard);

renderCard();