import {renderCard} from "/custom/renderer.js";
import {locale} from "/modules/locale.js";

let currentlyEditing = window.crypto.randomUUID();
let unsavedChanges = false;

// translate UI
document.getElementById("title").textContent = locale["customCards"]["title"];

document.getElementById("cardNameLabel").textContent = locale["customCards"]["cardName"];
document.getElementById("cardLevelLabel").textContent = locale["customCards"]["cardLevel"];
document.getElementById("cardLevel").placeholder = "?";
document.getElementById("cardAttackLabel").textContent = locale["customCards"]["cardAttack"];
document.getElementById("cardAttack").placeholder = "?";
document.getElementById("cardDefenseLabel").textContent = locale["customCards"]["cardDefense"];
document.getElementById("cardDefense").placeholder = "?";
document.getElementById("cardTypeLabel").textContent = locale["customCards"]["cardType"];

document.getElementById("saveButton").textContent = locale["customCards"]["save"];
document.getElementById("saveCopyButton").textContent = locale["customCards"]["saveCopy"];
document.getElementById("createNewButton").textContent = locale["customCards"]["createNew"];
document.getElementById("downloadImageButton").textContent = locale["customCards"]["downloadImage"];
document.getElementById("downloadCardButton").textContent = locale["customCards"]["downloadCard"];

document.documentElement.lang = locale["code"];
document.documentElement.removeAttribute("aria-busy");

// basic utilities
function getCard() {
	let card = {
		"cardType": cardType.value,
		"name": cardName.value,
		"level": cardLevel.value == ""? -1 : cardLevel.value,
		"types": [],
		"effects": parseEffectsList()
	};
	if (cardType.value == "unit" || cardType.value == "token") {
		card.attack = cardAttack.value === ""? -1 : cardAttack.value;
		card.defense = cardDefense.value === ""? -1 : cardDefense.value;
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

// editing current card
function createContentArea() {
	let holderDiv = document.createElement("div");
	let textArea = document.createElement("textarea");
	textArea.placeholder = "...";
	textArea.autocomplete = "off";
	textArea.addEventListener("input", function() {
		updateCard(true);
		this.style.height = "0";
		this.style.height = this.scrollHeight + "px";
	});
	
	holderDiv.appendChild(textArea);
	return holderDiv;
}

function createContentButtons() {
	let buttonArea = document.createElement("div");
	let effectButton = document.createElement("button");
	effectButton.textContent = "●：";
	effectButton.addEventListener("click", function() {
		this.parentElement.parentElement.firstChild.appendChild(createEffectSection("effect"));
		updateCard(true);
	});
	let bracketsButton = document.createElement("button");
	bracketsButton.textContent = "［］";
	bracketsButton.addEventListener("click", function() {
		this.parentElement.parentElement.firstChild.appendChild(createEffectSection("brackets"));
		updateCard(true);
	});
	let deleteButton = document.createElement("button");
	deleteButton.classList.add("effectEditorDeleteBtn");
	deleteButton.textContent = "X";
	deleteButton.addEventListener("click", function() {
		this.parentElement.parentElement.remove();
		updateCard(true);
	});
	buttonArea.appendChild(effectButton);
	buttonArea.appendChild(bracketsButton);
	buttonArea.appendChild(deleteButton);
	return buttonArea;
}

function createEffectSection(type) {
	let section = document.createElement("div");
	section.classList.add(type + "EditSection");
	
	section.appendChild(createContentArea());
	section.appendChild(createContentButtons());
	
	return section;
}

effectEditor.appendChild(createContentArea());
effectEditor.appendChild(createContentButtons());

function parseEffectsList(root = effectEditor.firstChild) {
	let list = [];
	Array.from(root.children).forEach(elem => {
		let object = {};
		if (elem.nodeName == "TEXTAREA") {
			object.type = "text";
			object.content = elem.value;
		} else {
			object.type = elem.classList.contains("effectEditSection")? "bullet" : "brackets";
			object.content = parseEffectsList(elem.firstChild);
		}
		if (elem.value != "") {
			list.push(object);
		}
	});
	return list;
}

cardName.addEventListener("input", function() {updateCard(true)});
cardLevel.addEventListener("input", function() {updateCard(true)});
cardAttack.addEventListener("input", function() {updateCard(true)});
cardDefense.addEventListener("input", function() {updateCard(true)});
cardType.addEventListener("input", function() {updateCard(true)});

saveButton.addEventListener("click", saveCard);
saveCopyButton.addEventListener("click", function() {
	currentlyEditing = window.crypto.randomUUID();
	saveCard();
});
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