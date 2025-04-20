// This module exports the DeckState class which is the state at the beginning of a (non-draft) match where players select their decks.
import {GameState} from "./gameState.mjs";
import {BoardState} from "./boardState.mjs";
import {locale} from "../../scripts/locale.mjs";
import {netSend} from "./netcode.mjs";
import {toDeckx} from "../../scripts/deckUtils.mjs";
import {ScriptParserError} from "../../rulesEngine/src/cdfScriptInterpreter/parser.mjs";
import {previewCard} from "./generalUI.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as deckErrors from "../../rulesEngine/src/deckErrors.mjs";

let builtInDecks = [];

function loadDeckFile(file) {
	let reader = new FileReader();
	reader.onload = function(e) {
		// check if deck is in VCI Generator format (ending is .deck) and if so, convert it to deckx
		gameState.loadDeck(this.fileName.endsWith(".deck")? toDeckx(JSON.parse(e.target.result)) : JSON.parse(e.target.result));
	};

	reader.fileName = file["name"];
	reader.readAsText(file);
}

// for deck loading related event listeners
function openDeckSelector(e) {
	e.stopPropagation();
	deckSelector.openAsDeckSelector(
		builtInDecks,
		{
			onCardClicked: async function(e) {
				e.stopPropagation();
				previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId)), false);
			},
			allowDownload: true
		}
	);
	deckSelector.parentElement.appendChild(cardDetails);
}
function deckDropped(e) {
	deckDropLabel.classList.remove("deckHover");
	if (!e.dataTransfer.items[0].getAsFile()) {
		return;
	}
	loadDeckFile(e.dataTransfer.items[0].getAsFile());
}
function dragDeckOver(e) {
	e.preventDefault();
	deckDropLabel.classList.add("deckHover");
}
function dragDeckLeave(e) {
	e.preventDefault();
	deckDropLabel.classList.remove("deckHover");
}

// toggling the prepared deck selector stuff on the mainGameBlackout
function activateDeckDropArea() {
	gameUI.showBlackoutMessage(locale.game.deckSelect.dropYourDeck, locale.game.deckSelect.useOfficialDeck);
	blackoutSubtitle.addEventListener("click", openDeckSelector);
	blackoutSubtitle.classList.add("clickableText");
	deckDropLabel.hidden = false;
}
function deactivateDeckDropArea() {
	gameUI.showBlackoutMessage(locale.game.deckSelect.loadingDeck);
	blackoutSubtitle.removeEventListener("click", openDeckSelector);
	blackoutSubtitle.classList.remove("clickableText");
	deckDropLabel.hidden = true;
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
		const fileSelectDeckLoader = document.createElement("input");
		fileSelectDeckLoader.id = "fileSelectDeckLoader";
		fileSelectDeckLoader.type = "file";
		fileSelectDeckLoader.accept = ".deck,.deckx";
		fileSelectDeckLoader.addEventListener("change", function() {
			loadDeckFile(this.files[0]);
		});
		document.body.appendChild(fileSelectDeckLoader);

		const deckDropLabel = document.createElement("label");
		deckDropLabel.id = "deckDropLabel";
		deckDropLabel.htmlFor = "fileSelectDeckLoader";
		deckDropLabel.addEventListener("drop", deckDropped);
		deckDropLabel.addEventListener("dragover", dragDeckOver);
		deckDropLabel.addEventListener("dragleave", dragDeckLeave);
		mainGameBlackoutContent.firstChild.before(deckDropLabel);
		activateDeckDropArea();

		// show game area
		mainGameArea.hidden = false;
		gameUI.init();
	}

	receiveMessage(command, message, player) {
		switch (command) {
			case "deck": {
				const deck = JSON.parse(message);
				cardLoader.deckToCdfList(deck, this.automatic, player).then(cdfList => {
					playerData[player.index].deck = deck;
					player.setDeck(cdfList);
					gameUI.updateCard(player.deckZone, -1);
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
		deactivateDeckDropArea();
		loadingIndicator.classList.add("active");
		try {
			const cdfList = await cardLoader.deckToCdfList(deck, this.automatic, localPlayer);
			localPlayer.setDeck(cdfList); // this will throw an error if the deck is invalid
			playerData[localPlayer.index].deck = deck;
			if (this.isSinglePlayer) {
				for (let i = 0; i < playerData.length; i++) {
					if (!playerData[i].deck) {
						game.players[i].setDeck(cdfList);
						playerData[i].deck = deck;
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
			activateDeckDropArea();
			return;
		} finally {
			loadingIndicator.classList.remove("active");
		}

		// disable deck selection
		deckDropLabel.remove();
		fileSelectDeckLoader.remove();

		// sync the deck
		netSend("deck", JSON.stringify(deck));

		gameUI.updateCard(localPlayer.deckZone, -1);
		gameUI.showBlackoutMessage(locale.game.deckSelect.waitingForOpponent);

		playerDeckButton1.disabled = false;

		this.checkReadyConditions();
	}

	checkReadyConditions() {
		if (playerData.every(player => player.deck !== null)) {
			if (!this.ready) {
				netSend("ready");
				this.ready = true;
			}
			if (this.opponentReady) {
				new BoardState(this.automatic);
			}
		}
	}
}