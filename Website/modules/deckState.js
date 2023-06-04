// This module exports the DeckState class which is the state at the beginning of a (non-draft) match where players select their decks.
import {GameState} from "/modules/gameState.js";
import {BoardState} from "/modules/boardState.js";
import {Card} from "/rulesEngine/card.js";
import {locale} from "/modules/locale.js";
import {socket} from "/modules/netcode.js";
import {toDeckx, deckToCardIdList, countDeckCards} from "/modules/deckUtils.js";
import {previewCard} from "/modules/generalUI.js";
import * as gameUI from "/modules/gameUI.js";

let officialDecks = [];
fetch("data/deckList.json")
.then(response => response.json())
.then(decks => {
	officialDecks = decks;
});

let currentDeckList = "default";


function openDeckSelect() {
	deckSelector.showModal();
	deckSelector.appendChild(cardDetails);
}
function closeDeckSelect() {
	gameFlexBox.appendChild(cardDetails);
	deckSelector.close();
}

function loadDeckFile(file) {
	let reader = new FileReader();
	reader.onload = function(e) {
		//check if deck is in VCI Generator format (ending is .deck) and if so, convert it to deckx
		gameState.loadDeck(this.fileName.endsWith(".deck")? toDeckx(JSON.parse(e.target.result)) : JSON.parse(e.target.result));
	};
	
	reader.fileName = file["name"];
	reader.readAsText(file);
}

//loading card list in the deck selector
function loadDeckPreview(deck) {
	//add card list on the right
	//remove all cards already there
	document.getElementById("deckSelectorCardGrid").innerHTML = "";
	
	//scroll the list to top
	document.getElementById("deckSelectorCardGrid").scrollTop = 0;
	
	//add the cards
	let partnerAdded = false;
	deckToCardIdList(officialDecks[currentDeckList][deck]).forEach(cardId => {
		let cardImg = document.createElement("img");
		cardImg.src = getCardImageFromID(cardId);
		cardImg.dataset.cardId = cardId;
		
		//make partner card glow
		if (cardId == officialDecks[currentDeckList][deck]["suggestedPartner"] && !partnerAdded) {
			partnerAdded = true;
			cardImg.classList.add("partnerHighlight");
		}
		
		document.getElementById("deckSelectorCardGrid").appendChild(cardImg);
		cardImg.addEventListener("click", async function(e) {
			await game.registerCard(this.dataset.cardId);
			previewCard(new Card(localPlayer, this.dataset.cardId, false));
			e.stopPropagation();
		});
	});
	
	// set the description
	document.getElementById("deckSelectorDescription").textContent = officialDecks[currentDeckList][deck]["description"][locale.code] ?? officialDecks[currentDeckList][deck]["description"]["en"] ?? officialDecks[currentDeckList][deck]["description"]["ja"];
}

//loading decks into the deck list
async function addDecksToDeckSelector(deckList) {
	//empty the deck selector
	while (document.getElementById("deckList").firstChild) {
		document.getElementById("deckList").firstChild.remove();
	}
	currentDeckList = deckList;
	
	for (const deckID of officialDecks[deckList]) {
		await fetch("data/decks/" + deckID + ".deckx")
		.then(response => response.json())
		.then(deck => {
			officialDecks[currentDeckList][deckID] = deck;
			let deckDiv = document.createElement("div");
			deckDiv.classList.add("bigButton");
			deckDiv.textContent = deck["name"][locale.code] ?? deck["name"]["en"] ?? deck["name"]["ja"] ?? "---";
			deckDiv.dataset.deck = deckID;
			
			let cardAmountSubtitle = document.createElement("span");
			cardAmountSubtitle.classList.add("deckCardAmount");
			cardAmountSubtitle.textContent = locale.game.deckSelect.deckListCardAmount.replace("{#CARDS}", countDeckCards(deck));
			
			deckDiv.addEventListener("click", function() {
				if (document.getElementById("selectedDeck")) {
					document.getElementById("selectedDeck").id = "";
				}
				this.id = "selectedDeck";
				loadDeckPreview(this.dataset.deck);
			});
			
			deckDiv.appendChild(document.createElement("br"));
			deckDiv.appendChild(cardAmountSubtitle);
			document.getElementById("deckList").appendChild(deckDiv);
		})
	}
	
	//also remove all cards still on the right side, as selectedDeck will be wiped
	while (document.getElementById("deckSelectorCardGrid").firstChild) {
		document.getElementById("deckSelectorCardGrid").firstChild.remove();
	}
}

export class DeckState extends GameState {
	constructor(automatic) {
		super();
		
		this.automatic = automatic;
		this.ready = false;
		this.opponentReady = false;
		
		//loading custom decks from file
		document.getElementById("deckDropzone").addEventListener("drop", function(e) {
			document.getElementById("deckDropzone").style.removeProperty("background-color");
			if (!e.dataTransfer.items[0].getAsFile()) {
				return;
			}
			loadDeckFile(e.dataTransfer.items[0].getAsFile());
		});
		document.getElementById("deckDropzone").addEventListener("dragover", function(e) {
			e.preventDefault();
			this.style.backgroundColor = "#ffffff33";
		});
		document.getElementById("deckDropzone").addEventListener("dragleave", function(e) {
			e.preventDefault();
			this.style.removeProperty("background-color");
		});
		document.getElementById("fileSelectDeckLoader").addEventListener("change", function() {
			loadDeckFile(this.files[0]);
		});
		
		// selecting deck from the deck list
		deckSelector.addEventListener("click", function(e) {
			if (e.target == document.getElementById("deckSelector")) {
				closeDeckSelect();
			}
		});
		
		document.getElementById("loadSelectedDeckBtn").addEventListener("click", function() {
			if (!document.getElementById("selectedDeck")) {
				return;
			}
			
			closeDeckSelect();
			this.loadDeck(officialDecks[currentDeckList][document.getElementById("selectedDeck").dataset.deck]);
		}.bind(this));
		
		// opening the deck selector
		document.getElementById("deckSelectSpan").addEventListener("click", function(e) {
			e.stopPropagation();
			currentDeckList = "default";
			addDecksToDeckSelector(currentDeckList);
			openDeckSelect();
		});
		// deck selector deck list buttons
		document.getElementById("defaultDecksBtn").addEventListener("click", function() {
			if (currentDeckList != "default") {
				currentDeckList = "default";
				addDecksToDeckSelector("default");
			}
		});
		document.getElementById("legacyDecksBtn").addEventListener("click", function() {
			if (currentDeckList != "legacy") {
				currentDeckList = "legacy";
				addDecksToDeckSelector("legacy");
			}
		});
		
		// show game area
		dropDeckHereLabel.textContent = locale.game.deckSelect.dropYourDeck;
		deckSelectSpan.textContent = locale.game.deckSelect.useOfficialDeck;
		defaultDecksBtn.textContent = locale.game.deckSelect.deckListDefault;
		legacyDecksBtn.textContent = locale.game.deckSelect.deckListLegacy;
		loadSelectedDeckBtn.textContent = locale.game.deckSelect.deckListLoadSelected;
		mainGameBlackout.textContent = locale.game.deckSelect.chooseYourDeck;
		
		mainGameArea.removeAttribute("hidden");
	}
	
	receiveMessage(command, message) {
		switch (command) {
			case "deck": {
				game.players[0].setDeck(JSON.parse(message)).then(() => {
					gameUI.updateCard(game.players[0].deckZone, -1);
					gameState.checkReadyConditions();
				});
				return true;
			}
			case "ready": {
				this.opponentReady = true;
				this.checkReadyConditions();
				return true;
			}
		}
		return false;
	}
	
	async loadDeck(deck) {
		// deck selection elements aren't needed anymore.
		deckDropzone.remove();
		deckSelector.remove();
		
		// sync and load the deck
		socket.send("[deck]" + JSON.stringify(deck));
		mainGameBlackout.textContent = locale.game.deckSelect.loadingDeck;
		await localPlayer.setDeck(deck);
		gameUI.updateCard(localPlayer.deckZone, -1);
		mainGameBlackout.textContent = locale.game.deckSelect.waitingForOpponent;
		
		this.checkReadyConditions();
	}
	
	checkReadyConditions() {
		if (!game.players.find(player => player.deck == null)) {
			if (!this.ready) {
				socket.send("[ready]");
				this.ready = true;
			}
			if (this.opponentReady) {
				gameState = new BoardState(this.automatic);
			}
		}
	}
}