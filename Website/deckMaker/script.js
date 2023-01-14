let shiftHeld = false;
//load illustrator tags
let illustratorTags = {};
fetch("data/illustratorTags.json")
.then(response => response.text())
.then(response => {
	illustratorTags = JSON.parse(response);
});
//load contest winner tags
let contestWinnerTags = {};
fetch("data/contestWinnerTags.json")
.then(response => response.text())
.then(response => {
	contestWinnerTags = JSON.parse(response);
});

// load locale files
let locale = {};

//used to sort japanese type list by Gojuon
let jpTypesHiragana = {
	"Angel": "てんし",
	"Armor": "よろい",
	"Beast": "けもの",
	"Bird": "とり",
	"Book": "しょもつ",
	"Boundary": "けっかい",
	"Bug": "むし",
	"Chain": "くさり",
	"Curse": "のろい",
	"Dark": "やみ",
	"Demon": "あっき",
	"Dragon": "どらごん",
	"Earth": "ち",
	"Electric": "いかづち",
	"Figure": "にんぎょう",
	"Fire": "ほのお",
	"Fish": "さかな",
	"Ghost": "しりょう",
	"Gravity": "じゅうりょく",
	"Ice": "こおり",
	"Illusion": "げんそう",
	"Katana": "かたな",
	"Landmine": "じらい",
	"Light": "ひかり",
	"Machine": "きかい",
	"Mage": "まじゅつし",
	"Medicine": "くすり",
	"Myth": "しんわ",
	"Plant": "しょくぶつ",
	"Psychic": "ぴーえすあい",
	"Rock": "がんせき",
	"Samurai": "さむらい",
	"Shield": "たて",
	"Spirit": "せいれい",
	"Structure": "けんぞうぶつ",
	"Sword": "けん",
	"Warrior": "せんし",
	"Water": "みず",
	"Wind": "かぜ",
	"typeless": "ん"
}

// load locale
fetch("../data/locales/" + localStorage.getItem("language") + ".json")
.then(response => {
	return response.json()
})
.then(jsonData => {
	locale = jsonData;
	
	//deck maker translation
	document.getElementById("unitHeader").textContent = locale["searchUnits"];
	document.getElementById("tokenHeader").textContent = locale["searchTokens"];
	document.getElementById("standardSpellHeader").textContent = locale["searchStandardSpells"];
	document.getElementById("continuousSpellHeader").textContent = locale["searchContinuousSpells"];
	document.getElementById("enchantSpellHeader").textContent = locale["searchEnchantSpells"];
	document.getElementById("standardItemHeader").textContent = locale["searchStandardItems"];
	document.getElementById("continuousItemHeader").textContent = locale["searchContinuousItems"];
	document.getElementById("equipableItemHeader").textContent = locale["searchEquipableItems"];
	
	document.getElementById("deckMakerDeckButton").textContent = locale["deckMakerDeck"];
	
	document.getElementById("deckMakerDetailsName").textContent = locale["deckMakerDeckName"];
	document.getElementById("deckMakerDetailsDescription").textContent = locale["deckMakerDescription"];
	document.getElementById("deckMakerDetailsPartner").textContent = locale["deckMakerPartner"];
	
	document.getElementById("deckMakerDetailsUnitCount").textContent = locale["deckMakerUnitTotal"];
	document.getElementById("deckMakerDetailsSpellCount").textContent = locale["deckMakerSpellTotal"];
	document.getElementById("deckMakerDetailsItemCount").textContent = locale["deckMakerItemTotal"];
	
	//search panel translation
	document.getElementById("cardSearchSearchBtn").textContent = locale["searchSearch"];
	document.getElementById("cardSearchNameLabel").textContent = locale["searchCardName"];
	document.getElementById("cardSearchIdLabel").textContent = locale["searchCardId"];
	document.getElementById("cardSearchAttackLabel").textContent = locale["searchAttack"];
	document.getElementById("cardSearchDefenseLabel").textContent = locale["searchDefense"];
	document.getElementById("cardSearchTypeLabel").textContent = locale["searchTypes"];
	document.getElementById("cardSearchCharacterLabel").textContent = locale["searchCharacters"];
	document.getElementById("cardSearchDeckLimitLabel").textContent = locale["searchDeckLimit"];
	document.getElementById("cardSearchSortLabel").textContent = locale["searchSortBy"];
	
	//sort the types alphabetically or by Gojuon
	let sortedOptions = Array.from(document.getElementById("cardSearchTypeInput").children).sort(function(a, b) {
		if (localStorage.getItem("language") == "ja") {
			return jpTypesHiragana[a.value] > jpTypesHiragana[b.value]? 1 : 0;
		} else {
			return a.value > b.value? 1 : 0;
		}
	});
	
	sortedOptions.forEach(typeOption => {
		document.getElementById("cardSearchTypeInput").appendChild(typeOption);
	});
	
	//label the types
	Array.from(document.getElementById("cardSearchTypeInput").children).forEach(typeOption => {
		typeOption.innerHTML = typeOption.value == "typeless"? locale["typeless"] : locale["type" + typeOption.value];
	});
	
	//card info panel
	document.getElementById("cardInfoReleaseDateLabel").textContent = locale["cardInfoReleased"];
	document.getElementById("cardInfoIllustratorLabel").textContent = locale["cardInfoIllustrator"];
	document.getElementById("cardInfoIdeaLabel").textContent = locale["cardInfoIdea"];
	document.getElementById("cardInfoMentionedHeader").textContent = locale["cardInfoMentionedCards"];
	document.getElementById("cardInfoMentionedOnHeader").textContent = locale["cardInfoMentionedOn"];
	document.getElementById("cardInfoVisibleHeader").textContent = locale["cardInfoVisibleCards"];
	document.getElementById("cardInfoVisibleOnHeader").textContent = locale["cardInfoVisibleOn"];
	document.getElementById("cardInfoToDeck").textContent = locale["cardInfoToDeck"];
});

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
window.addEventListener("blur", function(e) {
	shiftHeld = false;
});

// gets a card's link from its ID
function linkFromCardId(cardId) {
	return "https://crossuniverse.net/images/cards/" + (locale.warnings.includes("noCards")? "en" : locale.code) + "/" + cardId + ".jpg";
}
// gets a card's ID from a link to its image
function cardIdFromLink(imgLink) {
	return imgLink.substr(imgLink.length - 10, 6);
}

// Detailed card info gets cached manually to not rely on the browser's caching system when sending many requests.
let cardInfoCache = {};
async function getCardInfo(cardId) {
	if (!cardInfoCache[cardId]) {
		const response = await fetch("https://crossuniverse.net/cardInfo/?lang=" + localStorage.getItem("language") + "&cardID=" + cardId, {cache: "force-cache"});
		cardInfoCache[cardId] = await response.json();
	}
	return cardInfoCache[cardId];
}

function searchCards(query) {
	//clear current card lists:
	Array.from(document.getElementsByClassName("deckMakerGrid")).forEach(list => {
		while(list.firstChild) {
			list.firstChild.remove();
		}
	});
	
	fetch("https://crossuniverse.net/cardInfo", {method: "POST", body: JSON.stringify(query)})
	.then(response => response.text())
	.then(response => {
		document.getElementById("cardInfoPanel").style.display = "none";
		document.getElementById("cardSearchPanel").style.display = "none";
		document.getElementById("mainOverlayBlocker").style.display = "none";
		JSON.parse(response).forEach(card => {
			let cardImg = document.createElement("img");
			cardImg.loading = "lazy";
			cardImg.src = linkFromCardId(card.cardID);
			cardImg.addEventListener("click", function() {
				showCardInfo(cardIdFromLink(this.src));
			});
			document.getElementById(card.cardType + "Grid").appendChild(cardImg);
		});
	});
}

function fillCardResultGrid(cardList, grid) {
	if (cardList.length > 0) {
		while (document.getElementById("cardInfo" + grid + "Grid").firstChild) {
			document.getElementById("cardInfo" + grid + "Grid").firstChild.remove();
		}
		
		cardList.forEach(card => {
			let cardImg = document.createElement("img");
			cardImg.src = linkFromCardId(card);
			cardImg.addEventListener("click", function() {
				showCardInfo(cardIdFromLink(this.src));
			});
			document.getElementById("cardInfo" + grid + "Grid").appendChild(cardImg);
		});
		document.getElementById("cardInfo" + grid + "Area").style.display = "block";
	}
}

async function showCardInfo(cardID) {
	//fill in basic card info
	document.getElementById("cardInfoCardImg").src = linkFromCardId(cardID);
	document.getElementById("cardInfoCardID").textContent = "CU" + cardID;
	cardInfoToDeck.dataset.cardID = cardID;
	
	// name is --- until data from server arrives
	document.getElementById("cardInfoCardName").innerHTML = "---";
	
	//hide all info bits (they get re-enabled later, if that info arrives)
	document.getElementById("cardInfoReleaseDateArea").style.display = "none";
	document.getElementById("cardInfoIllustratorArea").style.display = "none";
	document.getElementById("cardInfoIdeaArea").style.display = "none";
	document.getElementById("cardInfoMentionedArea").style.display = "none";
	document.getElementById("cardInfoMentionedOnArea").style.display = "none";
	document.getElementById("cardInfoVisibleArea").style.display = "none";
	document.getElementById("cardInfoVisibleOnArea").style.display = "none";
	
	//enable card info display
	document.getElementById("cardInfoPanel").style.display = "block";
	document.getElementById("cardInfoOverlayBlocker").style.display = "block";
	
	//load card data
	let cardInfo = await getCardInfo(cardID);
	//fill in name
	if (cardInfo.nameFurigana) {
		let cardNameFurigana = cardInfo.name;
		cardInfo.nameFurigana.reverse().forEach(furigana => {
			//check for empty necessary to determine whether or not furigana needs parentheses in unsupported browsers.
			if (furigana.text != "") {
				cardNameFurigana = cardNameFurigana.slice(0, furigana.end) + "<rp>(</rp><rt>" + furigana.text + "</rt><rp>)</rp>" + cardNameFurigana.slice(furigana.end);
			} else {
				cardNameFurigana = cardNameFurigana.slice(0, furigana.end) + "<rt>" + furigana.text + "</rt>" + cardNameFurigana.slice(furigana.end);
			}
		});
		document.getElementById("cardInfoCardName").innerHTML = "<ruby>" + cardNameFurigana + "</ruby>";
	} else {
		document.getElementById("cardInfoCardName").textContent = cardInfo.name;
	}
	
	//fill in release date
	if (cardInfo.releaseDate) {
		cardInfoReleaseDate.textContent = cardInfo.releaseDate;
		cardInfoReleaseDate.dataset.releaseDate = cardInfo.releaseDate;
		cardInfoReleaseDateArea.style.display = "inline";
	}
	
	if (cardInfo.illustrator) {
		cardInfoIllustrator.textContent = illustratorTags[cardInfo.illustrator][localStorage.getItem("language")];
		cardInfoIllustrator.dataset.illustrator = cardInfo.illustrator;
		cardInfoIllustratorArea.style.display = "inline";
	}
	
	if (cardInfo.idea) {
		cardInfoIdea.textContent = contestWinnerTags[cardInfo.idea][localStorage.getItem("language")];
		cardInfoIdea.dataset.idea = cardInfo.idea;
		cardInfoIdeaArea.style.display = "inline";
	}
	
	//add mentioned cards to grid
	fillCardResultGrid(cardInfo.cardMentions, "Mentioned");
	fillCardResultGrid(cardInfo.mentionedOn, "MentionedOn");
	fillCardResultGrid(cardInfo.visibleCards, "Visible");
	fillCardResultGrid(cardInfo.visibleOn, "VisibleOn");
}

document.getElementById("cardSearchSearchBtn").addEventListener("click", function() {
	let query = {types: []};
	
	query.language = localStorage.getItem("language");
	query.name = document.getElementById("cardSearchNameInput").value;
	query.textbox = document.getElementById("cardSearchTextInput").value;
	query.characters = document.getElementById("cardSearchCharacterInput").value;
	query.cardID = document.getElementById("cardSearchIdInput").value;
	query.deckLimit = document.getElementById("cardSearchDeckLimitInput").value;
	query.sortBy = document.getElementById("cardSearchSortInput").value;
	if (document.getElementById("cardSearchAttackMinInput").value != "") {
		query.attackMin = parseInt(document.getElementById("cardSearchAttackMinInput").value);
	}
	if (document.getElementById("cardSearchAttackMaxInput").value != "") {
		query.attackMax = parseInt(document.getElementById("cardSearchAttackMaxInput").value);
	}
	if (document.getElementById("cardSearchDefenseMinInput").value != "") {
		query.defenseMin = parseInt(document.getElementById("cardSearchDefenseMinInput").value);
	}
	if (document.getElementById("cardSearchDefenseMaxInput").value != "") {
		query.defenseMax = parseInt(document.getElementById("cardSearchDefenseMaxInput").value);
	}
	Array.from(document.getElementById("cardSearchTypeInput").selectedOptions).forEach(type => {
		query.types.push(type.value);
	});
	
	searchCards(query);
});

//opening the search panel
document.getElementById("deckMakerSearchButton").addEventListener("click", function() {
	cardSearchPanel.style.display = "block";
	mainOverlayBlocker.style.display = "block";
});
//opening the deck creation panel
document.getElementById("deckMakerDeckButton").addEventListener("click", function() {
	deckCreationPanel.style.display = "flex";
	mainOverlayBlocker.style.display = "block";
});

//make overlay blocker close any overlays when clicked
function closeAllDeckMakerOverlays() {
	deckCreationPanel.style.display = "none";
	cardSearchPanel.style.display = "none";
	mainOverlayBlocker.style.display = "none";
	closeCardInfoPanel();
}

function closeCardInfoPanel() {
	cardInfoPanel.style.display = "none";
	cardInfoOverlayBlocker.style.display = "none";
}

mainOverlayBlocker.addEventListener("click", function() {
	closeAllDeckMakerOverlays();
});

cardInfoOverlayBlocker.addEventListener("click", function() {
	closeCardInfoPanel();
});

//clicking on parts of an individual card's info to search by those
document.getElementById("cardInfoReleaseDate").addEventListener("click", function() {
	searchCards({releaseDate: this.releaseDate});
});
document.getElementById("cardInfoIllustrator").addEventListener("click", function() {
	searchCards({illustrator: this.illustrator});
});
document.getElementById("cardInfoIdea").addEventListener("click", function() {
	searchCards({idea: this.idea});
});

//hotkeys
document.addEventListener("keyup", function(e) {
	if (document.activeElement.tagName.toLowerCase() == "input" || document.activeElement.tagName.toLowerCase() == "textarea") {
		return;
	}
	
	switch(e.code) {
		//[S]earch
		case "KeyS": {
			if (window.getComputedStyle(document.getElementById("cardSearchPanel")).display != "none") {
				closeAllDeckMakerOverlays();
			} else {
				closeAllDeckMakerOverlays();
				document.getElementById("cardSearchPanel").style.display = "block";
				document.getElementById("deckMakerOverlayBlocker").style.display = "block";
			}
			break;
		}
		
		//[D]eck
		case "KeyD": {
			if (window.getComputedStyle(document.getElementById("deckCreationPanel")).display != "none") {
				closeAllDeckMakerOverlays();
			} else {
				closeAllDeckMakerOverlays();
				document.getElementById("deckCreationPanel").style.display = "flex";
				document.getElementById("deckMakerOverlayBlocker").style.display = "block";
			}
			break;
		}
		
		//close all overlays
		case "Escape": {
			closeAllDeckMakerOverlays();
			break;
		}
		//also closes all but is closer to S and D
		case "KeyX": {
			closeAllDeckMakerOverlays();
			break;
		}
	}
});

//editing the work-in-progress deck
let deckList = [];

async function addCardToDeck(cardId) {
	card = await getCardInfo(cardId);
	//add card to the list on the left
	if (deckList.includes(cardId)) {
		//card already there, just increase its counter by one
		let cardAmountDiv = (document.getElementById("deckCreatorCardList").querySelectorAll("[data-card-i-d='" + cardId + "']"))[0].children.item(1).children.item(1);
		cardAmountDiv.textContent = deckList.filter(x => x === cardId).length + 1;
		
		//check if the card limit for that card was exceeded
		if (cardAmountDiv.textContent > card.deckLimit) {
			cardAmountDiv.style.color = "red";
		}
	} else {
		//need to add the card to the list
		let cardListElement = document.createElement("div");
		cardListElement.dataset.cardID = cardId;
		let cardImage = document.createElement("img");
		cardImage.src = linkFromCardId(cardId);
		cardImage.classList.add("deckMakerCardListElementImg");
		cardImage.addEventListener("click", function() {
			showCardInfo(cardIdFromLink(this.src));
		});
		cardListElement.appendChild(cardImage);
		
		let btnDiv = document.createElement("div");
		btnDiv.classList.add("deckMakerCardListElementBtns");
		cardListElement.appendChild(btnDiv);
		
		btnDiv.appendChild(document.createElement("div"));
		btnDiv.appendChild(document.createElement("div"));
		btnDiv.appendChild(document.createElement("div"));
		btnDiv.children.item(0).textContent = "-";
		btnDiv.children.item(1).textContent = "1";
		btnDiv.children.item(2).textContent = "+";
		
		btnDiv.children.item(0).addEventListener("click", function() {
			removeCardFromDeck(this.parentElement.parentElement.dataset.cardID);
		});
		btnDiv.children.item(2).addEventListener("click", function() {
			addCardToDeck(this.parentElement.parentElement.dataset.cardID);
		});
		
		document.getElementById("deckCreatorCardList").appendChild(cardListElement);
	}
	
	//if unit, add card as partner choice
	if (card.cardType == "unit" && card.level < 6 && !deckList.includes(card.cardID)) {
		let partnerOption = document.createElement("option");
		partnerOption.textContent = card.name;
		partnerOption.value = card.cardID;
		document.getElementById("deckMakerDetailsPartnerSelect").appendChild(partnerOption);
	}
	
	//add card to the actual, internal deck list
	deckList.push(cardId);
	
	sortCardsInDeck();
	recalculateDeckStats();
}

async function removeCardFromDeck(cardId) {
	//remove card from the internal deck list
	deckList.splice(deckList.indexOf(cardId), 1);
	
	//find the card on the page
	let cardListElement = (document.getElementById("deckCreatorCardList").querySelectorAll("[data-card-i-d='" + cardId + "']"))[0];
	
	if (deckList.includes(cardId)) {
		//card still here, just decrease number by one
		let cardAmountDiv = cardListElement.children.item(1).children.item(1);
		cardAmountDiv.textContent = deckList.filter(x => x === cardId).length;
		
		//check if the card limit for that card is exceeded
		if (cardAmountDiv.textContent <= (await getCardInfo(cardId)).deckLimit) {
			cardAmountDiv.style.color = "revert";
		}
	} else {
		//remove the element entirely
		cardListElement.remove();
		
		//also reset the partner choice, if necessary
		let partnerSelectOptions = document.getElementById("deckMakerDetailsPartnerSelect").querySelectorAll("[value='" + cardId + "']");
		if (partnerSelectOptions.length > 0) {
			partnerSelectOptions[0].remove();
		}
		
		//lastly, add the card to the recent cards for quick re-adding
		addRecentCard(cardId);
	}
	
	recalculateDeckStats();
}

function sortCardsInDeck() {
	let sortedOptions = Array.from(document.getElementById("deckCreatorCardList").children).sort(function(a, b) {
		if (!a.dataset.cardID) {
			return 1;
		}
		if (!b.dataset.cardID) {
			return -1;
		}
		
		let cardTypeOrderings = ["U", "S", "I", "T"];
		if (cardTypeOrderings.indexOf(a.dataset.cardID[0]) != cardTypeOrderings.indexOf(b.dataset.cardID[0])) {
			return cardTypeOrderings.indexOf(a.dataset.cardID[0]) - cardTypeOrderings.indexOf(b.dataset.cardID[0]);
		} else {
			console.log(cardInfoCache[a.dataset.cardID]);
			return cardInfoCache[a.dataset.cardID].level - cardInfoCache[b.dataset.cardID].level;
		}
	});
	
	sortedOptions.forEach(cardElement => {
		document.getElementById("deckCreatorCardList").appendChild(cardElement);
	});
}

async function recalculateDeckStats() {
	let unitCount = 0;
	let spellCount = 0;
	let itemCount = 0;
	let tokenCount = 0;
	
	let levelDist = [];
	for (let i = 0; i < 13; i++) {
		levelDist[i] = {total: 0, units: 0, spells: 0, items: 0};
	}
	
	for (const cardID of deckList) {
		card = await getCardInfo(cardID);
		//max necessary to catch the Lvl? Token that is denoted as -1 in the dataset
		levelDist[Math.max(0, card.level)].total++;
		switch (cardID[0]) {
			case "U": {
				unitCount++;
				levelDist[card.level].units++;
				break;
			}
			case "S": {
				spellCount++;
				levelDist[card.level].spells++;
				break;
			}
			case "I": {
				itemCount++;
				levelDist[card.level].items++;
				break;
			}
			case "T": {
				tokenCount++;
				//don't count tokens in the level distribution
				levelDist[Math.max(0, card.level)].total--;
				break;
			}
		}
	}
	
	document.getElementById("deckMakerDetailsCardTotalValue").textContent = deckList.length;
	if (deckList.length > 0) {
		document.getElementById("deckMakerDetailsUnitCountValue").textContent = unitCount + " (" + (unitCount / deckList.length * 100).toFixed(2) + "%)";
		document.getElementById("deckMakerDetailsSpellCountValue").textContent = spellCount + " (" + (spellCount / deckList.length * 100).toFixed(2) + "%)";
		document.getElementById("deckMakerDetailsItemCountValue").textContent = itemCount + " (" + (itemCount / deckList.length * 100).toFixed(2) + "%)";
	} else {
		//set preset values to avoid divide by 0 above
		document.getElementById("deckMakerDetailsUnitCountValue").textContent = "0 (0.00%)";
		document.getElementById("deckMakerDetailsSpellCountValue").textContent = "0 (0.00%)";
		document.getElementById("deckMakerDetailsItemCountValue").textContent = "0 (0.00%)";
	}
	
	//set level distribution
	let highestLevel = 0;
	for (let i = 0; i < 13; i++) {
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(0).style.display = levelDist[i].items == 0? "none" : "block";
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(0).style.height = (levelDist[i].items / levelDist[i].total * 100).toFixed(3) + "%";
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(0).title = levelDist[i].items;
		
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(1).style.display = levelDist[i].spells == 0? "none" : "block";
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(1).style.height = (levelDist[i].spells / levelDist[i].total * 100).toFixed(3) + "%";
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(1).title = levelDist[i].spells;
		
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(2).style.display = levelDist[i].units == 0? "none" : "block";
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(2).style.height = (levelDist[i].units / levelDist[i].total * 100).toFixed(3) + "%";
		document.getElementById("deckMakerLevelDistribution").children.item(i).children.item(2).title = levelDist[i].units;
		highestLevel = Math.max(highestLevel, levelDist[i].total);
	}
	
	for (let i = 0; i < 13; i++) {
		document.getElementById("deckMakerLevelDistribution").children.item(i).style.height = (levelDist[i].total / highestLevel * 100).toFixed(3) + "%";
	}
	
	//enable/disable warnings
	document.getElementById("unitWarning").style.display = unitCount == 0? "inline" : "none";
	document.getElementById("tokenWarning").style.display = tokenCount == 0? "none" : "inline";
	document.getElementById("cardMinWarning").style.display = deckList.length >= 30? "none" : "inline";
	document.getElementById("cardMaxWarning").style.display = deckList.length < 51? "none" : "inline";
	document.getElementById("partnerWarning").style.display = document.getElementById("deckMakerDetailsPartnerSelect").value == ""? "inline" : "none";
	document.getElementById("dotDeckExportBtn").disabled = document.getElementById("deckMakerDetailsPartnerSelect").value == "";
}

function addRecentCard(cardId) {
	let cardImg = document.createElement("img");
	cardImg.src = linkFromCardId(cardId);
	cardImg.addEventListener("click", function() {
		addCardToDeck(cardIdFromLink(this.src));
		this.remove();
	});
	document.getElementById("recentCardsList").insertBefore(cardImg, document.getElementById("recentCardsList").firstChild);
	
	//start removing elements from the recent list once it gets too long
	if (document.getElementById("recentCardsList").childElementCount > 25) {
		document.getElementById("recentCardsList").lastChild.remove();
	}
}

//add card to deck from card detail view and go to deck
document.getElementById("cardInfoToDeck").addEventListener("click", function() {
	addCardToDeck(this.dataset.cardID);
	
	//don't open deck when holding shift
	if (!shiftHeld) {
		closeAllDeckMakerOverlays();
		deckCreationPanel.style.display = "flex";
		mainOverlayBlocker.style.display = "block";
	}
});

//update deck analytics when setting a partner
document.getElementById("deckMakerDetailsPartnerSelect").addEventListener("change", function() {
	recalculateDeckStats();
});

//deck import
document.getElementById("deckMakerImportBtn").addEventListener("click", function() {
	document.getElementById("deckMakerImportInput").click();
});

document.getElementById("deckMakerImportInput").addEventListener("change", function() {
	//remove all cards from current deck
	while (deckList.length > 0) {
		removeCardFromDeck(deckList[0]);
	}
	//clear recent cards
	while (document.getElementById("recentCardsList").firstChild) {
		document.getElementById("recentCardsList").firstChild.remove();
	}
	
	let reader = new FileReader();
	reader.onload = async function(e) {
		//check if deck is in VCI Generator format (ending is .deck) and if so, convert it
		let loadedDeck = this.fileName.endsWith(".deck")? deckUtils.toJsonDeck(JSON.parse(e.target.result)) : JSON.parse(e.target.result);
		
		//quick fix for loading card description
		if (this.fileName.endsWith(".deck")) {
			document.getElementById("deckMakerDetailsDescriptionInput").value = JSON.parse(e.target.result).Description
		} else {
			document.getElementById("deckMakerDetailsDescriptionInput").value = "";
		}
		
		//load cards
		for (const card of loadedDeck.cards.reverse()) {
			for (let i = 0; i < card.amount; i++) {
				await addCardToDeck(card.id);
			}
			
			if (loadedDeck.suggestedPartner == card.id) {
				document.getElementById("deckMakerDetailsPartnerSelect").value = loadedDeck.suggestedPartner;
				recalculateDeckStats();
			}
		}
		
		//set deck name
		document.getElementById("deckMakerDetailsNameInput").value = loadedDeck.name[localStorage.getItem("language")] ?? loadedDeck.name.en ?? loadedDeck.name.ja ?? "";
	};
	
	reader.fileName = this.files[0]["name"];
	if (reader.fileName.endsWith(".deck") || reader.fileName.endsWith(".json")) { //validate file format
		reader.readAsText(this.files[0]);
	}
});

//deck export
document.getElementById("dotDeckExportBtn").addEventListener("click", function() {
	let deckObject = {Cards: []};
	deckObject.Name = document.getElementById("deckMakerDetailsNameInput").value;
	deckObject.Description = document.getElementById("deckMakerDetailsDescriptionInput").value;
	if (deckObject.Name == "") {
		deckObject.Name = document.getElementById("deckMakerDetailsNameInput").placeholder;
	}
	deckObject.Partner = "CU" + document.getElementById("deckMakerDetailsPartnerSelect").value;
	
	deckList.sort().reverse();
	//temporarily remove partner
	deckList.splice(deckList.indexOf(document.getElementById("deckMakerDetailsPartnerSelect").value), 1);
	deckList.forEach(cardID => {
		deckObject.Cards.push("CU" + cardID);
	});
	//re-add partner
	deckList.push(document.getElementById("deckMakerDetailsPartnerSelect").value);
	
	//generate the actual download
	let downloadElement = document.createElement("a");
	downloadElement.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deckObject));
	downloadElement.download = deckObject.Name + ".deck";
	downloadElement.style.display = "none";
	
	document.body.appendChild(downloadElement);
	downloadElement.click();
	downloadElement.remove();
});

// recent card hiding

recentCardsHeader.addEventListener("click", function() {
	recentCardsList.classList.toggle("shown");
})