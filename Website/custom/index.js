import {renderCard} from "/custom/renderer.js";
import {locale} from "/modules/locale.js";

let currentlyEditing = window.crypto.randomUUID();
let unsavedChanges = false;

// translate UI
document.getElementById("title").textContent = locale["customCards"]["title"];

document.getElementById("cardNameLabel").textContent = locale["customCards"]["cardName"];
document.getElementById("cardLevelLabel").textContent = locale["customCards"]["cardLevel"];
document.getElementById("cardLevel").placeholder = locale["cardDetailsQuestionMark"];
document.getElementById("cardAttackLabel").textContent = locale["customCards"]["cardAttack"];
document.getElementById("cardAttack").placeholder = locale["cardDetailsQuestionMark"];
document.getElementById("cardDefenseLabel").textContent = locale["customCards"]["cardDefense"];
document.getElementById("cardDefense").placeholder = locale["cardDetailsQuestionMark"];
document.getElementById("cardTypeLabel").textContent = locale["customCards"]["cardType"];

document.getElementById("saveButton").textContent = locale["customCards"]["save"];
document.getElementById("createNewButton").textContent = locale["customCards"]["createNew"];

document.documentElement.lang = locale["code"];
document.documentElement.removeAttribute("aria-busy");

// editing current card
function getCard() {
	let card = {
		"cardType": cardType.value,
		"name": cardName.value,
		"level": cardLevel.value == ""? -1 : cardLevel.value,
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

function updateCard(unsavedChange) {
	renderCard(getCard(), cardCanvas);
	if (unsavedChange) {
		unsavedChanges = true;
	}
}

function blankSlate() {
	if (unsavedChanges && !confirm(locale["customCards"]["unsavedChanges"])) {
		return;
	}
	loadCard({
		"cardType": "unit",
		"name": "",
		"level": -1,
		"attack": -1,
		"defense": -1,
		"types": [],
		"effects": []
	});
}

// saving and loading card from and to localStorage
function saveCard() {
	let cards = JSON.parse(localStorage.getItem("customCards")).filter(card => card.uuid != currentlyEditing);
	let savedCard = {
		"uuid": currentlyEditing,
		"lastChange": new Date().getTime(),
		"data": getCard()
	};
	cards.push(savedCard);
	localStorage.setItem("customCards", JSON.stringify(cards));
	reloadCardList();
}

function loadCard(card) {
	cardName.value = card.name;
	cardLevel.value = card.level == -1? "" : card.level;
	cardAttack.value = (card.attack == -1? "" : card.attack) ?? "";
	cardDefense.value = (card.defense == -1? "" : card.defense) ?? "";
	cardType.value = card.cardType;
	updateCard(false);
}

cardName.addEventListener("input", function() {updateCard(true)});
cardLevel.addEventListener("input", function() {updateCard(true)});
cardAttack.addEventListener("input", function() {updateCard(true)});
cardDefense.addEventListener("input", function() {updateCard(true)});
cardType.addEventListener("input", function() {updateCard(true)});

saveButton.addEventListener("click", saveCard);
createNewButton.addEventListener("click", blankSlate);
downloadImageButton.addEventListener("click", function() {
	let downloadElement = document.createElement("a");
	downloadElement.href = cardCanvas.toDataURL();
	downloadElement.download = cardName.value + ".card";
	downloadElement.click();
});
downloadCardButton.addEventListener("click", function() {
	let downloadElement = document.createElement("a");
	let card = getCard();
	downloadElement.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(card));
	downloadElement.download = card.name + ".card";
	downloadElement.click();
});

blankSlate();
updateCard(false);
reloadCardList();

// updating card list
function reloadCardList() {
	savedCardsList.innerHTML = "";
	JSON.parse(localStorage.getItem("customCards"))
	.sort((a, b) => parseInt(a.lastChange) < parseInt(b.lastChange))
	.forEach(card => {
		savedCardsList.appendChild(generateListCard(card));
	});
}

function generateListCard(card) {
	let listCard = document.createElement("div");
	listCard.classList.add("listCard")
	
	let canvas = document.createElement("canvas");
	renderCard(card.data, canvas);
	
	let editButton = document.createElement("button");
	editButton.dataset.cardUuid = card.uuid;
	editButton.textContent = locale["customCards"]["edit"];
	editButton.addEventListener("click", function() {
		if (unsavedChanges && !confirm(locale["customCards"]["unsavedChanges"])) {
			return;
		}
		let card = JSON.parse(localStorage.getItem("customCards")).find(card => card.uuid == this.dataset.cardUuid);
		if (card) {
			loadCard(card.data);
			currentlyEditing = this.dataset.cardUuid;
		} else {
			alert(locale["customCards"]["doesntExist"]);
			this.closest(".listCard").remove();
		}
	});
	
	let deleteButton = document.createElement("button");
	deleteButton.dataset.cardUuid = card.uuid;
	deleteButton.textContent = locale["customCards"]["delete"];
	deleteButton.addEventListener("click", function() {
		let cards = JSON.parse(localStorage.getItem("customCards"));
		let card = cards.find(card => card.uuid == this.dataset.cardUuid).data;
		if (confirm(locale["customCards"]["reallyDelete"].replaceAll("{#CARDNAME}", card.name))) {
			cards = cards.filter(card => card.uuid != this.dataset.cardUuid);
			localStorage.setItem("customCards", JSON.stringify(cards));
			this.closest(".listCard").remove();
		}
	});
	
	listCard.appendChild(canvas);
	listCard.appendChild(editButton);
	listCard.appendChild(deleteButton);
	return listCard;
}