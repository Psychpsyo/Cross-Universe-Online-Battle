import {locale} from "/scripts/locale.mjs";
import * as cardLoader from "/scripts/cardLoader.mjs";
import * as deckUtils from "/scripts/deckUtils.mjs";
import * as uiUtils from "/scripts/uiUtils.mjs";
import * as cardPrinter from "./cardPrinter/cardPrinter.mjs";

//load illustrator & contest winner tags
let illustratorTags = await fetch("data/illustratorTags.json").then(async response => await response.json());
let contestWinnerTags = await fetch("data/contestWinnerTags.json").then(async response => await response.json());

// translate page
// main section
title.textContent = locale.deckMaker.title;
headerBackButton.title = locale.general.buttonBack;
headerDeckButton.title = locale.deckMaker.deckButton;
headerSearchButton.title = locale.deckMaker.searchButton;

quickSearch.setAttribute("aria-label", locale.deckMaker.quickSearch.title);
quickSearch.placeholder = locale.deckMaker.quickSearch.prompt;
noResultsMessage.textContent = locale.deckMaker.quickSearch.noResults;

deckMakerPanels.setAttribute("aria-label", locale.deckMaker.searchResults);
deckMakerUnits.setAttribute("aria-label", locale.deckMaker.unitTokenColumn);
deckMakerSpells.setAttribute("aria-label", locale.deckMaker.spellColumn);
deckMakerItems.setAttribute("aria-label", locale.deckMaker.itemColumn);

unitHeader.textContent = locale.deckMaker.units;
tokenHeader.textContent = locale.deckMaker.tokens;
standardSpellHeader.textContent = locale.deckMaker.standardSpells;
continuousSpellHeader.textContent = locale.deckMaker.continuousSpells;
enchantSpellHeader.textContent = locale.deckMaker.enchantSpells;
standardItemHeader.textContent = locale.deckMaker.standardItems;
continuousItemHeader.textContent = locale.deckMaker.continuousItems;
equipableItemHeader.textContent = locale.deckMaker.equipableItems;

// deck menu
deckCreationPanelHeader.textContent = locale.deckMaker.deckMenu.title;
deckCardListHeader.textContent = locale.deckMaker.deckMenu.cardListTitle;
deckDetailsHeader.textContent = locale.deckMaker.deckMenu.detailsTitle;
recentCardsHeaderBtn.textContent = locale.deckMaker.deckMenu.recentCardsTitle;

deckMakerDetailsName.textContent = locale.deckMaker.deckMenu.name;
deckMakerDetailsNameInput.placeholder = locale.deckMaker.deckMenu.namePlaceholder;
deckMakerDetailsDescription.textContent = locale.deckMaker.deckMenu.description;
deckMakerDetailsPartner.textContent = locale.deckMaker.deckMenu.partner;

deckMakerDetailsCardTotal.textContent = locale.deckMaker.deckMenu.cardTotal;
deckMakerDetailsUnitCount.textContent = locale.deckMaker.deckMenu.unitTotal;
deckMakerDetailsSpellCount.textContent = locale.deckMaker.deckMenu.spellTotal;
deckMakerDetailsItemCount.textContent = locale.deckMaker.deckMenu.itemTotal;

levelDistributionTitle.textContent = locale.deckMaker.deckMenu.levelDistribution;

deckWarningsTitle.textContent = locale.deckMaker.deckMenu.warnings.title;
cardMinWarning.textContent = locale.deckMaker.deckMenu.warnings.cardMinimum;
cardMaxWarning.textContent = locale.deckMaker.deckMenu.warnings.cardMaximum;
unitWarning.textContent = locale.deckMaker.deckMenu.warnings.needsUnit;
tokenWarning.textContent = locale.deckMaker.deckMenu.warnings.noTokens;
partnerWarning.textContent = locale.deckMaker.deckMenu.warnings.noPartner;
unsupportedWarning.textContent = locale.deckMaker.deckMenu.warnings.unsupported;

// deck options panel
deckOptionsTitle.textContent = locale.deckMaker.deckMenu.options;
dotDeckExportBtn.textContent = locale.deckMaker.deckMenu.exportDeck;
fileImportBtn.textContent = locale.deckMaker.deckMenu.importDeckFromFile;
deckCodeCopyBtn.textContent = locale.deckMaker.deckMenu.copyDeckCode;
deckCodeImportBtn.textContent = locale.deckMaker.deckMenu.importDeckFromCode;
printDeckBtn.textContent = locale.deckMaker.deckMenu.printDeck;
startingHandGenBtn.textContent = locale.deckMaker.deckMenu.drawStartingHand;

//search panel
cardSearchPanelHeader.textContent = locale.deckMaker.searchMenu.title;
cardSearchSearchBtn.textContent = locale.deckMaker.searchMenu.search;
cardSearchNameLabel.textContent = locale.deckMaker.searchMenu.cardName;
cardSearchNameInput.placeholder = locale.deckMaker.searchMenu.cardNamePlaceholder;
cardSearchIdLabel.textContent = locale.deckMaker.searchMenu.cardId;
cardSearchIdInput.placeholder = locale.deckMaker.searchMenu.cardIdPlaceholder;
cardSearchAttackLabel.textContent = locale.deckMaker.searchMenu.attack;
cardSearchAttackMinInput.setAttribute("aria-label", locale.deckMaker.searchMenu.atkDefMinimum);
cardSearchAttackMaxInput.setAttribute("aria-label", locale.deckMaker.searchMenu.atkDefMaximum);
cardSearchDefenseLabel.textContent = locale.deckMaker.searchMenu.defense;
cardSearchDefenseMinInput.setAttribute("aria-label", locale.deckMaker.searchMenu.atkDefMinimum);
cardSearchDefenseMaxInput.setAttribute("aria-label", locale.deckMaker.searchMenu.atkDefMaximum);
cardSearchTextLabel.textContent = locale.deckMaker.searchMenu.textBox;
cardSearchTextInput.placeholder = locale.deckMaker.searchMenu.textBoxPlaceholder;
cardSearchTypeLabel.textContent = locale.deckMaker.searchMenu.types;
cardSearchCharacterLabel.textContent = locale.deckMaker.searchMenu.characters;
cardSearchCharacterInput.placeholder = locale.deckMaker.searchMenu.charactersPlaceholder;
cardSearchCharacterInput.title = locale.deckMaker.searchMenu.charactersMouseover;
cardSearchDeckLimitLabel.textContent = locale.deckMaker.searchMenu.deckLimit;
searchDeckLimitAny.textContent = locale.deckMaker.searchMenu.deckLimitAny;
searchDeckLimitThree.textContent = locale.deckMaker.searchMenu.deckLimitThree;
searchDeckLimitLess.textContent = locale.deckMaker.searchMenu.deckLimitLess;
searchDeckLimitMore.textContent = locale.deckMaker.searchMenu.deckLimitMore;
searchDeckLimitInfinite.textContent = locale.deckMaker.searchMenu.deckLimitInfinite;
cardSearchSortLabel.textContent = locale.deckMaker.searchMenu.sortBy;
searchSortByRelevancy.textContent = locale.deckMaker.searchMenu.sortByRelevancy;
searchSortByLevel.textContent = locale.deckMaker.searchMenu.sortByLevel;
searchSortByName.textContent = locale.deckMaker.searchMenu.sortByName;
searchSortByReleaseDate.textContent = locale.deckMaker.searchMenu.sortByReleaseDate;
searchSortByCardID.textContent = locale.deckMaker.searchMenu.sortByCardId;
searchSortByAttack.textContent = locale.deckMaker.searchMenu.sortByAttack;
searchSortByDefense.textContent = locale.deckMaker.searchMenu.sortByDefense;
cardSearchSupportLabel.textContent = locale.deckMaker.searchMenu.supportedIn;
searchSupportedInAnywhere.textContent = locale.deckMaker.searchMenu.supportedInAnywhere;
searchSupportedInManual.textContent = locale.deckMaker.searchMenu.supportedInManual;
searchSupportedInAutomatic.textContent = locale.deckMaker.searchMenu.supportedInAutomatic;

if (localStorage.getItem("devMode") === "true") {
	searchSupportedInUnimplemented.textContent = locale.deckMaker.searchMenu.supportedInUnimplemented;
	searchSupportedInUnimplemented.hidden = false;
}

//sort the types alphabetically
let sortedOptions = Array.from(cardSearchTypeInput.children).sort(function(a, b) {
	let typeSortNames = locale.optional.typeSortNames ?? locale.types;
	return a.value === "typeless" || typeSortNames[a.value] > typeSortNames[b.value]? 1 : 0;
});

sortedOptions.forEach(typeOption => {
	cardSearchTypeInput.appendChild(typeOption);
});

//label the types
Array.from(cardSearchTypeInput.children).forEach(typeOption => {
	typeOption.innerHTML = typeOption.value == "typeless"? locale.typeless : locale.types[typeOption.value];
});

//card info panel
cardInfoPanel.setAttribute("aria-label", locale.deckMaker.cardInfo.title);
cardInfoGeneralSection.setAttribute("aria-label", locale.deckMaker.cardInfo.generalSection);
cardInfoReleaseDateLabel.textContent = locale.deckMaker.cardInfo.released;
cardInfoIllustratorLabel.textContent = locale.deckMaker.cardInfo.illustrator;
cardInfoIdeaLabel.textContent = locale.deckMaker.cardInfo.idea;
cardInfoMentionedHeader.textContent = locale.deckMaker.cardInfo.mentionedCards;
cardInfoMentionedOnHeader.textContent = locale.deckMaker.cardInfo.mentionedOn;
cardInfoVisibleHeader.textContent = locale.deckMaker.cardInfo.visibleCards;
cardInfoVisibleOnHeader.textContent = locale.deckMaker.cardInfo.visibleOn;
cardInfoToDeck.textContent = locale.deckMaker.cardInfo.toDeck;


document.documentElement.lang = locale.code;
document.documentElement.removeAttribute("aria-busy");

// DONE TRANSLATING

window.deckList = [];
recalculateDeckStats();

if (localStorage.getItem("compactMode") === "true") {
	deckMakerPanels.classList.add("compact");
}

quickSearch.addEventListener("keyup", function(e) {
	if (e.key === "Enter") {
		if (this.value === "") {
			searchCards({});
			return;
		}
		Array.from(document.getElementsByClassName("deckMakerGrid")).forEach(list => {
			list.innerHTML = "";
		});
		loadingIndicator.classList.add("active");
		noResultsMessage.hidden = true;

		let url = localStorage.getItem("cardDataApiUrl") === ""? "https://crossuniverse.net/cardInfo/" : localStorage.getItem("cardDataApiUrl");
		url += url.endsWith("/")? "stringSearch" : "/stringSearch";
		fetch(
			url,
			{method: "POST", body: JSON.stringify({input: this.value, language: locale.warnings.includes("noCards")? "en" : locale.code})}
		).then(response => response.text())
		.then(async (response) => {
			loadingIndicator.classList.remove("active");
			showSearchResults(JSON.parse(response));
		});
	}
});

// make dialogs work
Array.from(document.getElementsByTagName("dialog")).forEach(elem => {
	elem.addEventListener("click", function(e) {
		if (e.target === elem) {
			elem.close();
		}
	});
});

// gets a card's ID from a link to its image
function cardIdFromLink(imgLink) {
	return imgLink.substring(imgLink.length - 10, imgLink.length - 4);
}

function cardToAltText(card) {
	return locale[(card.cardType == "unit" || card.cardType == "unit")? "unitAltText" : "cardAltText"]
		.replace("{#NAME}", card.name)
		.replace("{#LEVEL}", card.level == -1? "?" : card.level)
		.replace("{#CARDTYPE}", locale[card.cardType + "CardDetailType"])
		.replace("{#ATK}", card.attack == -1? "?" : card.attack)
		.replace("{#DEF}", card.defense == -1? "?" : card.defense)
		.replace("{#TYPES}", card.types.length > 0? card.types.map(type => locale.types[type]).join(locale.typeSeparator) : locale.typeless)
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
	cardImg.src = cardLoader.getCardImageFromID(card.cardID);
	cardImg.alt = cardToAltText(card);
	cardButton.addEventListener("click", async function() {
		showCardInfo(await cardLoader.getCardInfo(this.dataset.cardID));
	});
	cardButton.appendChild(cardImg);
	return cardButton;
}

function searchCards(query) {
	//clear current card lists:
	Array.from(document.getElementsByClassName("deckMakerGrid")).forEach(list => {
		list.innerHTML = "";
	});
	closeAllDeckMakerOverlays();
	loadingIndicator.classList.add("active");
	noResultsMessage.hidden = true;

	query.language = locale.warnings.includes("noCards")? "en" : locale.code;

	fetch(
		localStorage.getItem("cardDataApiUrl") === ""? "https://crossuniverse.net/cardInfo/" : localStorage.getItem("cardDataApiUrl"),
		{method: "POST", body: JSON.stringify(query)}
	).then(response => response.text())
	.then(async (response) => {
		loadingIndicator.classList.remove("active");
		showSearchResults(JSON.parse(response));
	});
}

async function showSearchResults(cards) {
	if (cards.length === 0) {
		document.body.classList.add("noResults");
		noResultsMessage.hidden = false;
		return;
	}
	document.body.classList.remove("noResults");
	for (const card of cards) {
		cardLoader.cardInfoCache[card.cardID] = card;

		let display = true;
		switch (cardSearchSupportInput.value) {
			case "automatic":{
				display = await cardLoader.isCardScripted(card.cardID);
				break;
			}
			case "resonite": {
				display = await cardLoader.isInResonite(card.cardID);
				break;
			}
			case "unimplemented": {
				display = !(await cardLoader.isCardScripted(card.cardID));
				break;
			}
		}
		if (display) {
			let listItem = document.createElement("li");
			listItem.appendChild(createCardButton(card, true));
			document.getElementById(card.cardType + "Grid").appendChild(listItem);
		}
	}
}

async function fillCardResultGrid(cardList, grid) {
	if (cardList.length > 0) {
		while (document.getElementById("cardInfo" + grid + "Grid").firstChild) {
			document.getElementById("cardInfo" + grid + "Grid").firstChild.remove();
		}

		cardList.forEach(async cardId => {
			document.getElementById("cardInfo" + grid + "Grid").appendChild(createCardButton(await cardLoader.getCardInfo(cardId), false));
		});
		document.getElementById("cardInfo" + grid + "Area").style.display = "block";
	}
}

async function showCardInfo(cardInfo) {
	//fill in basic card info
	document.getElementById("cardInfoCardImg").src = cardLoader.getCardImageFromID(cardInfo.cardID);
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
		cardInfo.nameFurigana.toReversed().forEach(furigana => {
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
	cardInfoCardImg.alt = locale.cardDetailsLevel + (cardInfo.level == -1? "?" : cardInfo.level) + locale.cardDetailsLevelTypeSeparator + locale[cardInfo.cardType + "CardDetailType"] + ".\n" + locale.cardDetailsEffects + "\n" + cardInfo.effectsPlain;

	//fill in release date
	if (cardInfo.releaseDate) {
		cardInfoReleaseDate.textContent = cardInfo.releaseDate;
		cardInfoReleaseDate.dataset.releaseDate = cardInfo.releaseDate;
		cardInfoReleaseDateArea.style.display = "inline";
	}

	if (cardInfo.illustrator) {
		cardInfoIllustrator.textContent = illustratorTags[cardInfo.illustrator][locale.code] ?? illustratorTags[cardInfo.illustrator]["en"];
		cardInfoIllustrator.dataset.illustrator = cardInfo.illustrator;
		cardInfoIllustratorArea.style.display = "inline";
	}

	if (cardInfo.idea) {
		cardInfoIdea.textContent = contestWinnerTags[cardInfo.idea][locale.code] ?? contestWinnerTags[cardInfo.idea]["en"];
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

	query.language = (locale.warnings.includes("noCards")? "en" : locale.code);
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
document.getElementById("headerSearchButton").addEventListener("click", function() {
	cardSearchPanel.showModal();
});
//opening the deck creation panel
document.getElementById("headerDeckButton").addEventListener("click", function() {
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
	if (document.activeElement.tagName.toLowerCase() == "input" ||
		document.activeElement.tagName.toLowerCase() == "textarea" ||
		e.metaKey || e.shiftKey // TODO: shift is a workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1557094 since my main concern is Win+Shift+S
	) {
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
async function addCardToDeck(cardId) {
	let card = await cardLoader.getCardInfo(cardId);
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

	if (deckList.length >= 0) {
		printDeckBtn.disabled = false;
	}
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
		if (cardAmountDiv.textContent <= (await cardLoader.getCardInfo(cardId)).deckLimit) {
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

	if (deckList.length == 0) {
		printDeckBtn.disabled = true;
	}
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
			return cardLoader.cardInfoCache[a.dataset.cardID].level - cardLoader.cardInfoCache[b.dataset.cardID].level;
		}
	});

	sortedOptions.forEach(cardElement => {
		deckCreatorCardList.appendChild(cardElement);
	});
}

async function recalculateDeckStats() {
	let unitCount = 0;
	let spellCount = 0;
	let itemCount = 0;
	let tokenCount = 0;

	let levelDist = [];
	for (let i = 0; i <= 12; i++) {
		levelDist[i] = {total: 0, units: 0, spells: 0, items: 0};
	}

	for (const cardId of deckList) {
		let card = await cardLoader.getCardInfo(cardId);
		//max necessary to catch the Lvl? Token that is denoted as -1 in the dataset
		levelDist[Math.max(0, card.level)].total++;
		switch (cardId[0]) {
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

	deckMakerDetailsCardTotalValue.textContent = deckList.length;
	if (deckList.length > 0) {
		deckMakerDetailsUnitCountValue.textContent = unitCount + " (" + (unitCount / deckList.length * 100).toFixed(2) + "%)";
		deckMakerDetailsSpellCountValue.textContent = spellCount + " (" + (spellCount / deckList.length * 100).toFixed(2) + "%)";
		deckMakerDetailsItemCountValue.textContent = itemCount + " (" + (itemCount / deckList.length * 100).toFixed(2) + "%)";
	} else {
		//set preset values to avoid divide by 0 above
		deckMakerDetailsUnitCountValue.textContent = "0 (0.00%)";
		deckMakerDetailsSpellCountValue.textContent = "0 (0.00%)";
		deckMakerDetailsItemCountValue.textContent = "0 (0.00%)";
	}

	//set level distribution
	let levelCardMax = 0;
	for (let i = 0; i <= 12; i++) {
		deckMakerLevelDistribution.children.item(i).children.item(0).style.display = levelDist[i].items == 0? "none" : "block";
		deckMakerLevelDistribution.children.item(i).children.item(0).style.height = (levelDist[i].items / levelDist[i].total * 100).toFixed(3) + "%";
		deckMakerLevelDistribution.children.item(i).children.item(0).title = levelDist[i].items;

		deckMakerLevelDistribution.children.item(i).children.item(1).style.display = levelDist[i].spells == 0? "none" : "block";
		deckMakerLevelDistribution.children.item(i).children.item(1).style.height = (levelDist[i].spells / levelDist[i].total * 100).toFixed(3) + "%";
		deckMakerLevelDistribution.children.item(i).children.item(1).title = levelDist[i].spells;

		deckMakerLevelDistribution.children.item(i).children.item(2).style.display = levelDist[i].units == 0? "none" : "block";
		deckMakerLevelDistribution.children.item(i).children.item(2).style.height = (levelDist[i].units / levelDist[i].total * 100).toFixed(3) + "%";
		deckMakerLevelDistribution.children.item(i).children.item(2).title = levelDist[i].units;
		levelCardMax = Math.max(levelCardMax, levelDist[i].total);
	}

	for (let i = 0; i <= 12; i++) {
		deckMakerLevelDistribution.children.item(i).style.height = (levelDist[i].total / levelCardMax * 100).toFixed(3) + "%";
		deckMakerLevelDistribution.children.item(i).hidden = false;
		deckMakerLevelDistributionLabels.children.item(i).hidden = false;
	}

	// hide levels 11/12 if not used
	for (let i = 12; i > 10; i--) {
		if (levelDist[i].total > 0) {
			break;
		}
		deckMakerLevelDistribution.children.item(i).hidden = true;
		deckMakerLevelDistributionLabels.children.item(i).hidden = true;
	}

	dotDeckExportBtn.disabled = deckMakerDetailsPartnerSelect.value === "";
	deckCodeCopyBtn.disabled = deckList.length === 0;

	//enable/disable warnings
	document.getElementById("unitWarning").style.display = unitCount == 0? "block" : "none";
	document.getElementById("tokenWarning").style.display = tokenCount == 0? "none" : "block";
	document.getElementById("cardMinWarning").style.display = deckList.length >= 30? "none" : "block";
	document.getElementById("cardMaxWarning").style.display = deckList.length < 51? "none" : "block";
	document.getElementById("partnerWarning").style.display = document.getElementById("deckMakerDetailsPartnerSelect").value == ""? "block" : "none";
	document.getElementById("unsupportedWarning").style.display = "none";
	if (localStorage.getItem("autoWarning") === "true") {
		for (const cardId of deckList) {
			if (!(await cardLoader.isCardScripted(cardId))) {
				document.getElementById("unsupportedWarning").style.display = "block";
			}
		}
	}
}

async function addRecentCard(cardId) {
	let cardImg = document.createElement("img");
	cardImg.src = cardLoader.getCardImageFromID(cardId);
	cardImg.addEventListener("click", function() {
		addCardToDeck(cardIdFromLink(this.src));
		this.remove();
	});
	let cardInfo = await cardLoader.getCardInfo(cardId);
	cardImg.alt = cardInfo.name;
	document.getElementById("recentCardsList").insertBefore(cardImg, document.getElementById("recentCardsList").firstChild);

	//start removing elements from the recent list once it gets too long
	if (document.getElementById("recentCardsList").childElementCount > 25) {
		document.getElementById("recentCardsList").lastChild.remove();
	}
}

//add card to deck from card detail view and go to deck
document.getElementById("cardInfoToDeck").addEventListener("click", function(e) {
	addCardToDeck(this.dataset.cardID);

	//don't open deck when holding shift
	if (!e.shiftKey) {
		closeAllDeckMakerOverlays();
		deckCreationPanel.showModal();
	}
});

//update deck analytics when setting a partner
document.getElementById("deckMakerDetailsPartnerSelect").addEventListener("change", function() {
	recalculateDeckStats();
});

// deck import
document.getElementById("fileImportInput").addEventListener("change", function() {
	loadDeckFile(this.files[0]);
});
document.getElementById("fileImportBtn").addEventListener("click", function() {
	document.getElementById("fileImportInput").click();
});
document.getElementById("deckCodeImportBtn").addEventListener("click", function() {
	const deckCode = prompt(locale.deckMaker.deckMenu.deckCodeImportPrompt)?.trim();
	if (deckCode) {
		loadDeck(deckUtils.decodeDeckCode(deckCode));
	}
});

function loadDeckFile(file) {
	const reader = new FileReader();
	reader.onload = function(e) {
		loadDeck(this.fileName.endsWith(".deck")? deckUtils.toDeckx(JSON.parse(e.target.result)) : JSON.parse(e.target.result));
	};

	reader.fileName = file["name"];
	reader.readAsText(file);
}

async function loadDeck(deck) {
	if (deckList.length > 0 && !confirm(locale.deckMaker.unsavedChangesWarning)) return;

	// remove all cards from current deck
	while (deckList.length > 0) {
		removeCardFromDeck(deckList[0]);
	}
	// clear recent cards
	while (document.getElementById("recentCardsList").firstChild) {
		document.getElementById("recentCardsList").firstChild.remove();
	}
	// open deck panel
	closeAllDeckMakerOverlays();
	deckCreationPanel.showModal();

	// set deck name and description
	document.getElementById("deckMakerDetailsNameInput").value = deck.name?.[localStorage.getItem("language")] ?? deck.name?.en ?? deck.name?.ja ?? "";
	document.getElementById("deckMakerDetailsDescriptionInput").value = deck.description?.[localStorage.getItem("language")] ?? deck.description?.en ?? deck.description?.ja ?? "";

	// load cards
	for (const card of deck.cards.reverse()) {
		const promises = [];
		for (let i = 0; i < card.amount; i++) {
			promises.push(addCardToDeck(card.id));
		}
		await Promise.all(promises);

		if (deck.suggestedPartner === card.id) {
			document.getElementById("deckMakerDetailsPartnerSelect").value = deck.suggestedPartner;
			recalculateDeckStats();
		}
	}
}

//deck export
document.getElementById("dotDeckExportBtn").addEventListener("click", function() {
	let deck = deckUtils.basicDeckFromCardList(
		deckList,
		deckMakerDetailsPartnerSelect.value,
		deckMakerDetailsNameInput.value === ""? deckMakerDetailsNameInput.placeholder : deckMakerDetailsNameInput.value,
		deckMakerDetailsDescriptionInput.value
	);

	//generate the actual download
	let downloadElement = document.createElement("a");
	downloadElement.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deck));
	downloadElement.download = deck.Name + ".deck";
	downloadElement.click();
});

deckCodeCopyBtn.addEventListener("click", function() {
	const deck = deckUtils.deckFromCardList(deckList, deckMakerDetailsPartnerSelect.value === ""? null : deckMakerDetailsPartnerSelect.value);
	navigator.clipboard.writeText(deckUtils.encodeDeckCode(deck));
});
uiUtils.makeCopyButton(deckCodeCopyBtn, locale.deckMaker.deckMenu.copyDeckCode);

// recent card hiding
recentCardsHeaderBtn.addEventListener("click", function() {
	recentCardsList.classList.toggle("shown");
})

// drag & dropping a deck
window.addEventListener("dragover", function(e) {
	e.preventDefault();
});
window.addEventListener("drop", function(e) {
	if (e.dataTransfer.items.length === 0) return;
	let file = e.dataTransfer.items[0].getAsFile();
	if (!file || !(file.name.endsWith(".deck") || file.name.endsWith(".deckx"))) {
		return;
	}
	e.preventDefault();
	loadDeckFile(file);
});

// prevent user from accidently leaving the site
window.unloadWarning = new AbortController();
window.addEventListener("beforeunload", function(e) {
	if (deckList.length > 0) {
		e.preventDefault();
		e.returnValue = "";
	}
}, {signal: unloadWarning.signal});

// .deck or .deckx files getting opened with the PWA
if ("launchQueue" in window) {
	window.launchQueue.setConsumer(launchParams => {
		if (launchParams.files && launchParams.files.length > 0) {
			launchParams.files[0].getFile().then(file => {
				loadDeckFile(file);
			});
		}
	});
}

// printing out decks
printDeckBtn.addEventListener("click", () => print());
window.addEventListener("beforeprint", () => {
	cardPrinter.setCards(deckList.map(cardId => cardLoader.getCardImageFromID(cardId)));
});