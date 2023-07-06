import {renderCard} from "/custom/renderer.js";
import {locale} from "/modules/locale.js";

let currentlyEditing = window.crypto.randomUUID();
let unsavedChanges = false;

// translate UI
document.getElementById("title").textContent = locale.customCards.title;

cardNameLabel.textContent = locale.customCards.cardName;
cardLevelLabel.textContent = locale.customCards.cardLevel;
cardTypesLabel.textContent = locale.customCards.cardTypes;
cardAbilitiesLabel.textContent = locale.customCards.cardAbilities;
cardAttackLabel.textContent = locale.customCards.cardAttack;
cardDefenseLabel.textContent = locale.customCards.cardDefense;
cardTypeLabel.textContent = locale.customCards.cardType;
Array.from(cardType.children).forEach(elem => {
	elem.textContent = locale[elem.value + "CardDetailType"];
});

cardTypes.title = locale.customCards.possibleTypes.replace("{#TYPES}", Object.values(locale.types).map(val => val.replace(" ", "_")).join(locale.customCards.possibleTypesSeperator))

enableScriptingLabel.textContent = locale.customCards.enableScripting;
scriptingExperimentalWarning.textContent = locale.customCards.scriptingExperimentalWarning;
cardEffectScript.placeholder = locale.customCards.enterEffectsScripts;

saveButton.textContent = locale.customCards.save;
saveCopyButton.textContent = locale.customCards.saveCopy;
createNewButton.textContent = locale.customCards.createNew;
downloadImageButton.textContent = locale.customCards.downloadImage;
downloadCardButton.textContent = locale.customCards.downloadCard;
importCardButton.textContent = locale.customCards.importCard;

savedCardsList.dataset.message = locale.customCards.noSavedCards;

document.documentElement.lang = locale.code;
document.documentElement.removeAttribute("aria-busy");

// basic utilities
function getCard() {
	effectEditor.normalize();
	let card = {
		"cardType": cardType.value,
		"name": cardName.value,
		"level": cardLevel.value == ""? -1 : cardLevel.value,
		"types": parseTypesList(),
		"effects": parseEffectsList()
	};
	if (cardType.value == "unit" || cardType.value == "token") {
		card.attack = cardAttack.value === ""? -1 : cardAttack.value;
		card.defense = cardDefense.value === ""? -1 : cardDefense.value;
	}
	if (localStorage.getItem("username")) {
		card.author = localStorage.getItem("username");
	}
	if (enableScriptingToggle.checked) {
		card.cdfScriptEffects = cardEffectScript.value;
	}
	return card;
}
function parseTypesList() {
	let types = cardTypes.value.replace(/[,，\s]+/g, " ").split(" ");
	let finalTypes = [];
	types.forEach(type => {
		for (const key in locale.types) {
			if (locale.types[key].toLowerCase().replace(" ", "_") == type.toLowerCase()) {
				if (!finalTypes.includes(key)) {
					finalTypes.push(key);
				}
				return;
			}
		}
	});
	return finalTypes;
}
function parseEffectsList(root = effectEditor) {
	let list = [];
	Array.from(root.childNodes).forEach(elem => {
		let object = {};
		if (elem.nodeName == "#text") {
			if (elem.textContent.trim() != "") {
				object.type = "text";
				object.content = elem.textContent.trim();
			}
		} else if (elem.classList.contains("bulletEditSection")) {
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
cardName.addEventListener("input", function() {updateCard(true)});
cardLevel.addEventListener("input", function() {updateCard(true)});
cardTypes.addEventListener("input", function() {updateCard(true)});
effectEditor.addEventListener("input", function() {updateCard(true)});
cardAttack.addEventListener("input", function() {updateCard(true)});
cardDefense.addEventListener("input", function() {updateCard(true)});
cardType.addEventListener("input", function() {updateCard(true)});

enableScriptingToggle.addEventListener("change", function() {
	scriptingEditor.hidden = !this.checked;
});

// effect editor
if (!effectEditor.isContentEditable) {
	// Workarounds for browsers that don't yet support contenteditable="plaintext-only" (Firefox)
	effectEditor.contentEditable = "true";
	function typeNode(node) {
		let selection = window.getSelection();
		for (let i = 0; i < selection.rangeCount; i++) {
			let range = selection.getRangeAt(i);
			range.deleteContents();
			range.insertNode(node);
			range.collapse();
		}
		updateCard(true);
	}
	effectEditor.addEventListener("paste", function(e) {
		e.preventDefault();
		typeNode(document.createTextNode(e.clipboardData.getData("text/plain")));
	});
	effectEditor.addEventListener("beforeinput", function(e) {
		if (e.inputType == "insertParagraph") {
			e.preventDefault();
			typeNode(document.createTextNode("\n"));
		}
	});
	effectEditor.addEventListener("drop", function(e) {
		e.preventDefault();
		let droppedText = e.dataTransfer.getData("text");
		if (droppedText) {
			typeNode(document.createTextNode(droppedText));
		}
	});
	effectEditor.addEventListener("input", function(e) {
		if (this.childElementCount == 1 && this.firstChild.nodeName == "BR") {
			this.innerHTML = "";
		};
	});
}
function createEffectSection(type) {
	let section = document.createElement("div");
	section.classList.add("editSection");
	section.classList.add(type + "EditSection");
	return section;
}
function insertEffectSection(type) {
	let selection = window.getSelection();
	let totalInsertions = 0;
	for (let i = 0; i < selection.rangeCount; i++) {
		let range = selection.getRangeAt(i);
		// check if we're inside the effect editor
		let rangeContainer = range.commonAncestorContainer;
		if (rangeContainer.nodeName == "#text") {
			rangeContainer = rangeContainer.parentElement;
		}
		if (rangeContainer.closest("#effectEditor") === null) {
			continue;
		}
		// insert the section
		let section = createEffectSection(type);

		if (range.endContainer === range.startContainer) {
			if (range.endContainer.childElementCount == 1 && range.endContainer.firstChild.nodeName == "BR") {
				range.endContainer.firstChild.remove();
			}
			range.surroundContents(section);
		} else {
			range.insertNode(section);
		}
		// insert relevant safety-newlines
		section.parentElement.normalize();
		if (section.parentElement != effectEditor && section == section.parentElement.firstChild) {
			section.parentElement.insertBefore(document.createElement("br"), section);
		}
		if (section.childNodes.length == 0) {
			section.appendChild(document.createElement("br"));
		}
		range.selectNodeContents(section);
		range.collapse();
		totalInsertions++;
	}
	if (totalInsertions == 0) {
		let section = createEffectSection(type);
		section.appendChild(document.createElement("br"));
		effectEditor.appendChild(section);
		selection.removeAllRanges();
		let range = new Range();
		range.selectNodeContents(section);
		range.collapse();
		selection.addRange(range);
	}
}
effectEditNewBullet.addEventListener("click", function() {
	insertEffectSection("bullet");
	updateCard(true);
});
effectEditNewBrackets.addEventListener("click", function() {
	insertEffectSection("brackets");
	updateCard(true);
});

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
importCardButton.addEventListener("click", () => {
	if (unsavedChanges && !confirm(locale.customCards.unsavedChanges)) {
		return;
	}
	importCardInput.click();
});
importCardInput.addEventListener("input", function() {
	let reader = new FileReader();
	reader.onload = async function(e) {
		// the raw loaded json data
		let loadedCard = JSON.parse(e.target.result);

		// will be sanitized into this
		let card = {
			"cardType": loadedCard.cardType ?? "unit",
			"name": loadedCard.name ?? "",
			"level": loadedCard.level ?? -1
		};
		if (card.cardType == "unit" || card.cardType == "token") {
			card.attack = loadedCard.attack ?? -1;
			card.defense = loadedCard.defense ?? -1;
		}
		card.types = [];
		if (Array.isArray(loadedCard.types)) {
			for (const type of loadedCard.types) {
				if (type in locale.types) {
					card.types.push(type);
				}
			}
		}
		card.effects = loadedCard.effects ?? [];

		loadCard(card);
	};
	reader.readAsText(this.files[0]);
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

	cardTypes.value = card.types.map(type => locale["types"][type]).join(locale["typeSeparator"]);

	effectEditor.innerHTML = "";
	loadCardEffects(card.effects, effectEditor);

	updateCard(false);
}

function loadCardEffects(list, toElem) {
	list.forEach(effect => {
		switch (effect.type) {
			case "text": {
				toElem.appendChild(document.createTextNode(effect.content));
				break;
			}
			case "bullet":
			case "brackets": {
				let brackets = createEffectSection(effect.type);
				toElem.appendChild(brackets);
				loadCardEffects(effect.content, brackets);
				break;
			}
		}
	});
}