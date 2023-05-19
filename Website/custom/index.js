import {renderCard} from "/custom/renderer.js";
import {locale} from "/modules/locale.js";

let currentlyEditing = window.crypto.randomUUID();
let unsavedChanges = false;

// translate UI
document.getElementById("title").textContent = locale.customCards.title;

cardNameLabel.textContent = locale.customCards.cardName;
cardLevelLabel.textContent = locale.customCards.cardLevel;
cardAttackLabel.textContent = locale.customCards.cardAttack;
cardDefenseLabel.textContent = locale.customCards.cardDefense;
cardTypeLabel.textContent = locale.customCards.cardType;
Array.from(cardType.children).forEach(elem => {
	elem.textContent = locale[elem.value + "CardDetailType"];
});
cardAbilitiesLabel.textContent = locale.customCards.cardAbilities;

saveButton.textContent = locale.customCards.save;
saveCopyButton.textContent = locale.customCards.saveCopy;
createNewButton.textContent = locale.customCards.createNew;
downloadImageButton.textContent = locale.customCards.downloadImage;
downloadCardButton.textContent = locale.customCards.downloadCard;

document.documentElement.lang = locale.code;
document.documentElement.removeAttribute("aria-busy");

// basic utilities
function getCard() {
	effectEditor.normalize();
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

function beforeUnloadListener(e) {
	e.preventDefault();
	e.returnValue = "";
}

function updateCard(unsaved) {
	renderCard(getCard(), cardCanvas);
	if (unsaved && !unsavedChanges) {
		window.addEventListener("beforeunload", beforeUnloadListener);
	} else if (!unsaved) {
		window.removeEventListener("beforeunload", beforeUnloadListener);
	}
	unsavedChanges = unsaved;
}

function blankSlate() {
	if (unsavedChanges && !confirm(locale.customCards.unsavedChanges)) {
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
effectEditNewBullet.addEventListener("click", function() {
	let effect = document.createElement("div");
	effect.classList.add("effectEditSection");
	effectEditor.appendChild(effect);
	updateCard(true);
});
effectEditNewBrackets.addEventListener("click", function() {
	let brackets = document.createElement("div");
	brackets.classList.add("bracketsEditSection");
	effectEditor.appendChild(brackets);
	updateCard(true);
});
effectEditor.addEventListener("input", function() {
	
	updateCard(true);
});

function parseEffectsList(root = effectEditor) {
	let list = [];
	Array.from(root.childNodes).forEach(elem => {
		let object = {};
		if (elem.nodeName == "#text") {
			if (elem.textContent.trim() != "") {
				object.type = "text";
				object.content = elem.textContent.trim();
			}
		} else if (elem.classList.contains("effectEditSection")) {
			object.type = "bullet";
			object.content = parseEffectsList(elem);
		} else if (elem.classList.contains("bracketsEditSection")) {
			object.type = "brackets";
			object.content = parseEffectsList(elem);
		}
		if (object.type) {
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
	editButton.textContent = locale.customCards.edit;
	editButton.addEventListener("click", function() {
		if (unsavedChanges && !confirm(locale.customCards.unsavedChanges)) {
			return;
		}
		let card = JSON.parse(localStorage.getItem("customCards")).find(card => card.uuid == this.dataset.cardUuid);
		if (card) {
			loadCard(card.data);
			currentlyEditing = this.dataset.cardUuid;
		} else {
			alert(locale.customCards.doesntExist);
			this.closest(".listCard").remove();
		}
	});
	
	let deleteButton = document.createElement("button");
	deleteButton.dataset.cardUuid = card.uuid;
	deleteButton.textContent = locale.customCards.delete;
	deleteButton.addEventListener("click", function() {
		let cards = JSON.parse(localStorage.getItem("customCards"));
		let card = cards.find(card => card.uuid == this.dataset.cardUuid).data;
		if (confirm(locale.customCards.reallyDelete.replaceAll("{#CARDNAME}", card.name))) {
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
	
	loadCardEffects(card.effects, effectEditor);
	
	updateCard(false);
}

function loadCardEffects(list, toElem) {
	console.log(list);
	list.forEach(effect => {
		switch (effect.type) {
			case "text": {
				toElem.appendChild(document.createTextNode(effect.content));
				break;
			}
			case "bullet": {
				let bullet = document.createElement("div");
				bullet.classList.add("effectEditSection");
				toElem.appendChild(bullet);
				loadCardEffects(effect.content, bullet);
				break;
			}
			case "brackets": {
				let brackets = document.createElement("div");
				brackets.classList.add("bracketsEditSection");
				toElem.appendChild(brackets);
				loadCardEffects(effect.content, brackets);
				break;
			}
		}
	});
}