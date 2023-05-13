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

// load locale and translate page
document.documentElement.lang = localStorage.getItem("language");
fetch("../data/locales/" + localStorage.getItem("language") + ".json")
.then(response => {
	return response.json()
})
.then(jsonData => {
	locale = jsonData;
	
	// main section
	document.getElementById("deckCreatorTitle").textContent = locale["deckMaker"]["title"];
	document.getElementById("deckMakerDeckButton").textContent = locale["deckMaker"]["deck"];
	document.getElementById("deckMakerSearchButton").textContent = locale["deckMaker"]["search"];
	
	document.getElementById("deckMakerPanels").setAttribute("aria-label", locale["deckMaker"]["searchResults"]);
	document.getElementById("deckMakerUnits").setAttribute("aria-label", locale["deckMaker"]["unitTokenColumn"]);
	document.getElementById("deckMakerSpells").setAttribute("aria-label", locale["deckMaker"]["spellColumn"]);
	document.getElementById("deckMakerItems").setAttribute("aria-label", locale["deckMaker"]["itemColumn"]);
	
	document.getElementById("unitHeader").textContent = locale["deckMaker"]["units"];
	document.getElementById("tokenHeader").textContent = locale["deckMaker"]["tokens"];
	document.getElementById("standardSpellHeader").textContent = locale["deckMaker"]["standardSpells"];
	document.getElementById("continuousSpellHeader").textContent = locale["deckMaker"]["continuousSpells"];
	document.getElementById("enchantSpellHeader").textContent = locale["deckMaker"]["enchantSpells"];
	document.getElementById("standardItemHeader").textContent = locale["deckMaker"]["standardItems"];
	document.getElementById("continuousItemHeader").textContent = locale["deckMaker"]["continuousItems"];
	document.getElementById("equipableItemHeader").textContent = locale["deckMaker"]["equipableItems"];
	
	// deck menu
	document.getElementById("deckCreationPanelHeader").textContent = locale["deckMaker"]["deckMenu"]["title"];
	document.getElementById("deckCardListHeader").textContent = locale["deckMaker"]["deckMenu"]["cardListTitle"];
	document.getElementById("deckDetailsHeader").textContent = locale["deckMaker"]["deckMenu"]["detailsTitle"];
	document.getElementById("recentCardsHeaderBtn").textContent = locale["deckMaker"]["deckMenu"]["recentCardsTitle"];
	
	document.getElementById("deckMakerDetailsName").textContent = locale["deckMaker"]["deckMenu"]["name"];
	document.getElementById("deckMakerDetailsNameInput").placeholder = locale["deckMaker"]["deckMenu"]["namePlaceholder"];
	document.getElementById("deckMakerDetailsDescription").textContent = locale["deckMaker"]["deckMenu"]["description"];
	document.getElementById("deckMakerDetailsPartner").textContent = locale["deckMaker"]["deckMenu"]["partner"];
	
	document.getElementById("deckMakerDetailsCardTotal").textContent = locale["deckMaker"]["deckMenu"]["cardTotal"];
	document.getElementById("deckMakerDetailsUnitCount").textContent = locale["deckMaker"]["deckMenu"]["unitTotal"];
	document.getElementById("deckMakerDetailsSpellCount").textContent = locale["deckMaker"]["deckMenu"]["spellTotal"];
	document.getElementById("deckMakerDetailsItemCount").textContent = locale["deckMaker"]["deckMenu"]["itemTotal"];
	
	document.getElementById("levelDistributionTitle").textContent = locale["deckMaker"]["deckMenu"]["levelDistribution"];
	
	document.getElementById("deckWarningsTitle").textContent = locale["deckMaker"]["deckMenu"]["warnings"]["title"];
	document.getElementById("cardMinWarning").textContent = locale["deckMaker"]["deckMenu"]["warnings"]["cardMinimum"];
	document.getElementById("cardMaxWarning").textContent = locale["deckMaker"]["deckMenu"]["warnings"]["cardMaximum"];
	document.getElementById("unitWarning").textContent = locale["deckMaker"]["deckMenu"]["warnings"]["needsUnit"];
	document.getElementById("tokenWarning").textContent = locale["deckMaker"]["deckMenu"]["warnings"]["noTokens"];
	document.getElementById("partnerWarning").textContent = locale["deckMaker"]["deckMenu"]["warnings"]["noPartner"];
	
	// starting hand
	document.getElementById("deckOptionsTitle").textContent = locale["deckMaker"]["deckMenu"]["options"];
	document.getElementById("dotDeckExportBtn").textContent = locale["deckMaker"]["deckMenu"]["exportDeck"];
	document.getElementById("deckMakerImportBtn").textContent = locale["deckMaker"]["deckMenu"]["importDeck"];
	document.getElementById("startingHandGenBtn").textContent = locale["deckMaker"]["deckMenu"]["drawStartingHand"];
	
	//search panel
	document.getElementById("cardSearchPanelHeader").textContent = locale["deckMaker"]["searchMenu"]["title"];
	document.getElementById("cardSearchSearchBtn").textContent = locale["deckMaker"]["searchMenu"]["search"];
	document.getElementById("cardSearchNameLabel").textContent = locale["deckMaker"]["searchMenu"]["cardName"];
	document.getElementById("cardSearchNameInput").placeholder = locale["deckMaker"]["searchMenu"]["cardNamePlaceholder"];
	document.getElementById("cardSearchIdLabel").textContent = locale["deckMaker"]["searchMenu"]["cardId"];
	document.getElementById("cardSearchIdInput").placeholder = locale["deckMaker"]["searchMenu"]["cardIdPlaceholder"];
	document.getElementById("cardSearchAttackLabel").textContent = locale["deckMaker"]["searchMenu"]["attack"];
	document.getElementById("cardSearchAttackMinInput").setAttribute("aria-label", locale["deckMaker"]["searchMenu"]["atkDefMinimum"]);
	document.getElementById("cardSearchAttackMaxInput").setAttribute("aria-label", locale["deckMaker"]["searchMenu"]["atkDefMaximum"]);
	document.getElementById("cardSearchDefenseLabel").textContent = locale["deckMaker"]["searchMenu"]["defense"];
	document.getElementById("cardSearchDefenseMinInput").setAttribute("aria-label", locale["deckMaker"]["searchMenu"]["atkDefMinimum"]);
	document.getElementById("cardSearchDefenseMaxInput").setAttribute("aria-label", locale["deckMaker"]["searchMenu"]["atkDefMaximum"]);
	document.getElementById("cardSearchTextLabel").textContent = locale["deckMaker"]["searchMenu"]["textBox"];
	document.getElementById("cardSearchTextInput").placeholder = locale["deckMaker"]["searchMenu"]["textBoxPlaceholder"];
	document.getElementById("cardSearchTypeLabel").textContent = locale["deckMaker"]["searchMenu"]["types"];
	document.getElementById("cardSearchCharacterLabel").textContent = locale["deckMaker"]["searchMenu"]["characters"];
	document.getElementById("cardSearchCharacterInput").placeholder = locale["deckMaker"]["searchMenu"]["charactersPlaceholder"];
	document.getElementById("cardSearchCharacterInput").title = locale["deckMaker"]["searchMenu"]["charactersMouseover"];
	document.getElementById("cardSearchDeckLimitLabel").textContent = locale["deckMaker"]["searchMenu"]["deckLimit"];
	document.getElementById("cardSearchSortLabel").textContent = locale["deckMaker"]["searchMenu"]["sortBy"];
	
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
	document.getElementById("cardInfoPanelContent").setAttribute("aria-label", locale["deckMaker"]["cardInfo"]["title"]);
	document.getElementById("cardInfoGeneralSection").setAttribute("aria-label", locale["deckMaker"]["cardInfo"]["generalSection"]);
	document.getElementById("cardInfoReleaseDateLabel").textContent = locale["deckMaker"]["cardInfo"]["released"];
	document.getElementById("cardInfoIllustratorLabel").textContent = locale["deckMaker"]["cardInfo"]["illustrator"];
	document.getElementById("cardInfoIdeaLabel").textContent = locale["deckMaker"]["cardInfo"]["idea"];
	document.getElementById("cardInfoMentionedHeader").textContent = locale["deckMaker"]["cardInfo"]["mentionedCards"];
	document.getElementById("cardInfoMentionedOnHeader").textContent = locale["deckMaker"]["cardInfo"]["mentionedOn"];
	document.getElementById("cardInfoVisibleHeader").textContent = locale["deckMaker"]["cardInfo"]["visibleCards"];
	document.getElementById("cardInfoVisibleOnHeader").textContent = locale["deckMaker"]["cardInfo"]["visibleOn"];
	document.getElementById("cardInfoToDeck").textContent = locale["deckMaker"]["cardInfo"]["toDeck"];
	
	// starting hand generator
	document.getElementById("handGeneratorTitle").textContent = locale["deckMaker"]["startingHandGenerator"]["title"];
	document.getElementById("regenerateStartingHand").textContent = locale["deckMaker"]["startingHandGenerator"]["redraw"];
	
	
	document.documentElement.lang = localStorage.getItem("language");
	document.documentElement.removeAttribute("aria-busy");
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
		const response = await fetch("https://crossuniverse.net/cardInfo/?lang=" + (locale.warnings.includes("noCards")? "en" : locale.code) + "&cardID=" + cardId, {cache: "force-cache"});
		cardInfoCache[cardId] = await response.json();
	}
	return cardInfoCache[cardId];
}

function cardToAltText(card) {
	return locale[(card.cardType == "unit" || card.cardType == "unit")? "unitAltText" : "cardAltText"]
		.replace("{#NAME}", card.name)
		.replace("{#LEVEL}", card.level == -1? locale["cardDetailsQuestionMark"] : card.level)
		.replace("{#CARDTYPE}", locale[card.cardType + "CardDetailType"])
		.replace("{#ATK}", card.attack == -1? locale["cardDetailsQuestionMark"] : card.attack)
		.replace("{#DEF}", card.defense == -1? locale["cardDetailsQuestionMark"] : card.defense)
		.replace("{#TYPES}", card.types.length > 0? card.types.map(type => locale["type" + type]).join(locale["typeSeparator"]) : locale["typeless"])
		.replace("{#EFFECTS}", card.effectsPlain);
}

function createCardButton(card, lazyLoading) {
	let cardButton = document.createElement("button");
	cardButton.classList.add("cardButton");
	cardButton.dataset.cardID = card.cardID;
	let cardImg = document.createElement("img");
	if (lazyLoading) {
		cardImg.loading = "lazy";
	}
	cardImg.src = linkFromCardId(card.cardID);
	cardImg.alt = cardToAltText(card);
	cardButton.addEventListener("click", async function() {
		showCardInfo(await getCardInfo(this.dataset.cardID));
	});
	cardButton.appendChild(cardImg);
	return cardButton;
}

function searchCards(query) {
	//clear current card lists:
	Array.from(document.getElementsByClassName("deckMakerGrid")).forEach(list => {
		while(list.firstChild) {
			list.firstChild.remove();
		}
	});
	closeAllDeckMakerOverlays();
	
	fetch("https://crossuniverse.net/cardInfo", {method: "POST", body: JSON.stringify(query)})
	.then(response => response.text())
	.then(response => {
		JSON.parse(response).forEach(card => {
			cardInfoCache[card.cardID] = card;
			let listItem = document.createElement("li");
			listItem.appendChild(createCardButton(card, true));
			document.getElementById(card.cardType + "Grid").appendChild(listItem);
		});
	});
}

async function fillCardResultGrid(cardList, grid) {
	if (cardList.length > 0) {
		while (document.getElementById("cardInfo" + grid + "Grid").firstChild) {
			document.getElementById("cardInfo" + grid + "Grid").firstChild.remove();
		}
		
		cardList.forEach(async cardId => {
			document.getElementById("cardInfo" + grid + "Grid").appendChild(createCardButton(await getCardInfo(cardId), false));
		});
		document.getElementById("cardInfo" + grid + "Area").style.display = "block";
	}
}

async function showCardInfo(cardInfo) {
	//fill in basic card info
	document.getElementById("cardInfoCardImg").src = linkFromCardId(cardInfo.cardID);
	document.getElementById("cardInfoCardID").textContent = "CU" + cardInfo.cardID;
	cardInfoToDeck.dataset.cardID = cardInfo.cardID;
	
	//hide all info bits (they get re-enabled later, if relevant to the card)
	document.getElementById("cardInfoReleaseDateArea").style.display = "none";
	document.getElementById("cardInfoIllustratorArea").style.display = "none";
	document.getElementById("cardInfoIdeaArea").style.display = "none";
	document.getElementById("cardInfoMentionedArea").style.display = "none";
	document.getElementById("cardInfoMentionedOnArea").style.display = "none";
	document.getElementById("cardInfoVisibleArea").style.display = "none";
	document.getElementById("cardInfoVisibleOnArea").style.display = "none";
	
	//fill in name
	if (cardInfo.nameFurigana) {
		let cardNameFurigana = cardInfo.name;
		[...cardInfo.nameFurigana].reverse().forEach(furigana => {
			// check for empty necessary to determine whether or not furigana needs parentheses in unsupported browsers.
			if (furigana.text != "") {
				cardNameFurigana = cardNameFurigana.slice(0, furigana.end) + "<rp>(</rp><rt>" + furigana.text + "</rt><rp>)</rp>" + cardNameFurigana.slice(furigana.end);
			} else {
				cardNameFurigana = cardNameFurigana.slice(0, furigana.end) + "<rt></rt>" + cardNameFurigana.slice(furigana.end);
			}
		});
		document.getElementById("cardInfoCardName").innerHTML = "<ruby>" + cardNameFurigana + "</ruby>";
	} else {
		document.getElementById("cardInfoCardName").textContent = cardInfo.name;
	}
	
	// set card image alt text
	cardInfoCardImg.alt = locale["cardDetailsInfoString"].replace("{#LEVEL}", cardInfo.level == -1? locale["cardDetailsQuestionMark"] : cardInfo.level).replace("{#CARDTYPE}", locale[cardInfo.cardType + "CardDetailType"]) + ".\n" + locale["cardDetailsEffects"] + "\n" + cardInfo.effectsPlain;
	
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
	
	
	//enable card info display
	if (!cardInfoPanel.open) {
		cardInfoPanel.showModal();
	}
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
	cardSearchPanel.showModal();
});
//opening the deck creation panel
document.getElementById("deckMakerDeckButton").addEventListener("click", function() {
	deckCreationPanel.showModal();
});

//make overlay blocker close any overlays when clicked
function closeAllDeckMakerOverlays() {
	deckCreationPanel.close();
	cardSearchPanel.close();
	cardInfoPanel.close();
	startingHandGenerator.close();
}

//clicking on parts of an individual card's info to search by those
document.getElementById("cardInfoReleaseDate").addEventListener("click", function() {
	searchCards({releaseDate: this.dataset.releaseDate});
});
document.getElementById("cardInfoIllustrator").addEventListener("click", function() {
	searchCards({illustrator: this.dataset.illustrator});
});
document.getElementById("cardInfoIdea").addEventListener("click", function() {
	searchCards({idea: this.dataset.idea});
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
				cardSearchPanel.showModal();
			}
			break;
		}
		
		//[D]eck
		case "KeyD": {
			if (window.getComputedStyle(document.getElementById("deckCreationPanel")).display != "none") {
				closeAllDeckMakerOverlays();
			} else {
				closeAllDeckMakerOverlays();
				deckCreationPanel.showModal();
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
		cardListElement.appendChild(createCardButton(card));
		
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
	
	if (deckList.length >= 5) {
		startingHandGenBtn.disabled = false;
	}
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
	
	if (deckList.length < 5) {
		startingHandGenBtn.disabled = true;
	}
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
	document.getElementById("unitWarning").style.display = unitCount == 0? "block" : "none";
	document.getElementById("tokenWarning").style.display = tokenCount == 0? "none" : "block";
	document.getElementById("cardMinWarning").style.display = deckList.length >= 30? "none" : "block";
	document.getElementById("cardMaxWarning").style.display = deckList.length < 51? "none" : "block";
	document.getElementById("partnerWarning").style.display = document.getElementById("deckMakerDetailsPartnerSelect").value == ""? "block" : "none";
	document.getElementById("dotDeckExportBtn").disabled = document.getElementById("deckMakerDetailsPartnerSelect").value == "";
}

async function addRecentCard(cardId) {
	let cardImg = document.createElement("img");
	cardImg.src = linkFromCardId(cardId);
	cardImg.addEventListener("click", function() {
		addCardToDeck(cardIdFromLink(this.src));
		this.remove();
	});
	let cardInfo = await getCardInfo(cardId);
	cardImg.alt = cardInfo.name;
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
		deckCreationPanel.showModal();
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

recentCardsHeaderBtn.addEventListener("click", function() {
	recentCardsList.classList.toggle("shown");
})