// This module exports the DeckState class which is the state at the beginning of a (non-draft) match where players select their decks.
import {GameState} from "./gameState.mjs";
import {BoardState} from "./boardState.mjs";
import {locale} from "../../scripts/locale.mjs";
import {netSend} from "./netcode.mjs";
import {toDeckx, countDeckCards} from "../../scripts/deckUtils.mjs";
import {loadDeckPreview, openDeckView, closeDeckView} from "./generalUI.mjs";
import {ScriptParserError} from "../../rulesEngine/src/cdfScriptInterpreter/parser.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as deckErrors from "../../rulesEngine/src/deckErrors.mjs";

let builtInDecks = [];
let currentDeckList = "default";

function loadDeckFile(file) {
	let reader = new FileReader();
	reader.onload = function(e) {
		//check if deck is in VCI Generator format (ending is .deck) and if so, convert it to deckx
		gameState.loadDeck(this.fileName.endsWith(".deck")? toDeckx(JSON.parse(e.target.result)) : JSON.parse(e.target.result));
	};

	reader.fileName = file["name"];
	reader.readAsText(file);
}

//loading decks into the deck list
async function addDecksToDeckSelector(deckList) {
	//empty the deck selector
	document.getElementById("deckList").innerHTML = "";
	currentDeckList = deckList;

	let deckPromises = [];
	for (const deckID of builtInDecks[deckList]) {
		deckPromises.push(
			fetch("./data/decks/" + deckID + ".deckx")
			.then(response => response.json())
			.then(deck => {
				return {id: deckID, deck: deck};
			})
		);
	}

	let deckResults = await Promise.allSettled(deckPromises);
	for (let result of deckResults) {
		let deck = result.value.deck;
		builtInDecks[currentDeckList][result.value.id] = deck;
		let deckDiv = document.createElement("div");
		deckDiv.classList.add("bigButton");
		deckDiv.textContent = deck["name"][locale.code] ?? deck["name"]["en"] ?? deck["name"]["ja"] ?? "---";
		deckDiv.dataset.deck = result.value.id;

		let cardAmountSubtitle = document.createElement("span");
		cardAmountSubtitle.classList.add("deckCardAmount");
		cardAmountSubtitle.textContent = locale.game.deckSelect.deckListCardAmount.replace("{#CARDS}", countDeckCards(deck));

		deckDiv.addEventListener("click", function() {
			if (document.getElementById("selectedDeck")) {
				document.getElementById("selectedDeck").id = "";
			}
			this.id = "selectedDeck";
			loadDeckPreview(builtInDecks[currentDeckList][this.dataset.deck]);
		});

		deckDiv.appendChild(document.createElement("br"));
		deckDiv.appendChild(cardAmountSubtitle);
		document.getElementById("deckList").appendChild(deckDiv);
	}

	//also remove all cards still on the right side, as selectedDeck will be wiped
	deckSelectorCardGrid.innerHTML = "";
	deckSelectorDescription.innerHTML = "";
}

export class DeckState extends GameState {
	constructor(automatic, isSinglePlayer = false) {
		super();
		this.automatic = automatic;
		this.isSinglePlayer = isSinglePlayer;
		this.ready = false;
		this.opponentReady = false;

		fetch("./data/deckList.json")
		.then(response => response.json())
		.then(decks => {
			builtInDecks = decks;
		});

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

		document.getElementById("loadSelectedDeckBtn").addEventListener("click", function() {
			if (!document.getElementById("selectedDeck")) {
				return;
			}

			closeDeckView();
			this.loadDeck(builtInDecks[currentDeckList][document.getElementById("selectedDeck").dataset.deck]);
		}.bind(this));

		// opening the deck selector
		document.getElementById("deckSelectSpan").addEventListener("click", function(e) {
			e.stopPropagation();
			currentDeckList = "default";
			addDecksToDeckSelector(currentDeckList);
			openDeckView();
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
		deckViewTitle.textContent = locale.game.deckSelect.dialogHeader;
		defaultDecksBtn.textContent = locale.game.deckSelect.deckListDefault;
		legacyDecksBtn.textContent = locale.game.deckSelect.deckListLegacy;
		loadSelectedDeckBtn.textContent = locale.game.deckSelect.deckListLoadSelected;
		gameUI.showBlackoutMessage(locale.game.deckSelect.chooseYourDeck);

		mainGameArea.hidden = false;
		gameUI.init();
	}

	receiveMessage(command, message) {
		switch (command) {
			case "deck": {
				let deck = JSON.parse(message);
				cardLoader.deckToCdfList(deck, this.automatic, game.players[0]).then(cdfList => {
					players[0].deck = deck;
					game.players[0].setDeck(cdfList);
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
		gameUI.showBlackoutMessage(locale.game.deckSelect.loadingDeck);
		loadingIndicator.classList.add("active");
		const cdfList = await cardLoader.deckToCdfList(deck, this.automatic, localPlayer);
		try {
			localPlayer.setDeck(cdfList); // this will throw an error if the deck is invalid
			players[localPlayer.index].deck = deck;
			if (this.isSinglePlayer) {
				for (let i = 0; i < players.length; i++) {
					if (!players[i].deck) {
						game.players[i].setDeck(cdfList);
						players[i].deck = deck;
					}
				}
				this.opponentReady = true;
			}
		} catch (e) {
			switch (true) {
				case e instanceof cardLoader.UnsupportedCardError: {
					const cardInfo = await cardLoader.getCardInfo(e.cardId);
					alert(locale.game.deckSelect.errors.unsupportedInAutomatic.replaceAll("{#CARDNAME}", cardInfo.name));
					break;
				}
				case e instanceof deckErrors.DeckSizeError: {
					if (e.tooMany) {
						alert(locale.game.deckSelect.errors.tooManyCards.replaceAll("{#DECKLIMIT}", game.config.upperDeckLimit));
					} else {
						alert(locale.game.deckSelect.errors.notEnoughCards.replaceAll("{#DECKLIMIT}", game.config.lowerDeckLimit));
					}
					break;
				}
				case e instanceof deckErrors.CardAmountError: {
					const cardInfo = await cardLoader.getCardInfo(e.cardId);
					alert(locale.game.deckSelect.errors.tooManyOfCard.replaceAll("{#CARDNAME}", cardInfo.name));
					break;
				}
				case e instanceof deckErrors.DeckTokenError: {
					const cardInfo = await cardLoader.getCardInfo(e.cardId);
					alert(locale.game.deckSelect.errors.hasToken.replaceAll("{#CARDNAME}", cardInfo.name));
					break;
				}
				case e instanceof ScriptParserError: {
					console.error(e, e.stack);
					const cardInfo = await cardLoader.getCardInfo(e.cardId);
					alert(locale.game.deckSelect.errors.scriptError.replaceAll("{#CARDNAME}", cardInfo.name));
					break;
				}
				case e instanceof cardLoader.NonexistantCardError: {
					alert(locale.game.deckSelect.errors.nonexistantCard.replaceAll("{#CARDID}", "CU" + e.cardId));
					break;
				}
				default: {
					console.error(e, e.stack);
					alert(locale.game.deckSelect.errors.generic);
				}
			}
			gameUI.showBlackoutMessage(locale.game.deckSelect.chooseYourDeck);
			return;
		} finally {
			loadingIndicator.classList.remove("active");
		}

		// deck selection elements aren't needed anymore.
		deckDropzone.remove();
		deckSelector.classList.add("deckListDisable");

		// sync the deck
		netSend("[deck]" + JSON.stringify(deck));

		gameUI.updateCard(localPlayer.deckZone, -1);
		gameUI.showBlackoutMessage(locale.game.deckSelect.waitingForOpponent);

		playerDeckButton1.disabled = false;

		this.checkReadyConditions();
	}

	checkReadyConditions() {
		if (players.every(player => player.deck !== null)) {
			if (!this.ready) {
				netSend("[ready]");
				this.ready = true;
			}
			if (this.opponentReady) {
				new BoardState(this.automatic);
			}
		}
	}
}