import {renderCard} from "/custom/renderer.js";

function getCard() {
	let card = {
		"cardType": cardType.value,
		"name": cardName.value,
		"level": cardLevel.value == ""? -1 : cardLevel.value
		"types": [],
		"effects": []
	};
	if (cardType.value == "unit" || cardType.value == "token") {
		card.attack = cardAttack.value;
		card.defense = cardDefense.value;
	}
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

JSON.parse(localStorage.getItem("customCards")).forEach(card => {
	let listCard = document.createElement("div");
	listCard.classList.add("listCard")
	
	let canvas = document.createElement("canvas");
	renderCard(card, canvas);
	
	let editButton = document.createElement("button");
	editButton.textContent = "Edit";
	
	let deleteButton = document.createElement("button");
	deleteButton.textContent = "Delete";
	
	listCard.appendChild(canvas);
	listCard.appendChild(editButton);
	listCard.appendChild(deleteButton);
	savedCardsList.appendChild(listCard);
});