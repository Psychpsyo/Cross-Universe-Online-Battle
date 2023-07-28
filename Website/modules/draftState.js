import {GameState} from "/modules/gameState.js";
import {BoardState} from "/modules/boardState.js";
import {Card} from "/rulesEngine/card.js";
import {locale} from "/modules/locale.js";
import {socket} from "/modules/netcode.js";
import {deckFromCardList} from "/modules/deckUtils.js";
import {previewCard} from "/modules/generalUI.js";
import * as gameUI from "/modules/gameUI.js";
import * as cardLoader from "/modules/cardLoader.js";

let basicFormat = await fetch("data/draftFormats/beginnerFormat.json");
basicFormat = await basicFormat.json();
basicFormat.packCount = Math.ceil(basicFormat.deckSize * 2 / basicFormat.cardPicks);

export class DraftState extends GameState {
	constructor() {
		super();
		gameState = this;

		game.config.validateCardAmounts = false;

		this.format = basicFormat;
		this.currentBooster = [];
		this.takenCards = 0;
		this.packsOpened = 0;
		this.currentPlayer = 0;

		this.pressedReady = false;
		this.opponentReady = false;

		draftStartButton.textContent = locale.draft.startGame;
		draftDeckOwner0.textContent = players[0].name;
		draftDeckOwner1.textContent = players[1].name;
		draftDeckCount0.textContent = "0/" + this.format.deckSize;
		draftDeckCount1.textContent = "0/" + this.format.deckSize;

		document.querySelectorAll(".draftDeckList").forEach(deckList => {
			deckList.style.aspectRatio = "8130 / " + (Math.ceil(this.format.deckSize / 10) * 1185);
		});

		this.setPlayer(0);

		if (youAre === 0) {
			this.rerollCards();
		}

		draftStartButton.addEventListener("click", function() {
			socket.send("[ready]");
			gameState.pressedReady = true;
			draftStartButton.textContent = locale.draft.waitingForOpponent;
			draftStartButton.setAttribute("disabled", "");
			gameState.checkReadyConditions();
		});

		// deck loading elements won't be needed
		deckDropzone.remove();
		deckSelector.classList.add("deckListDisable");

		draftGameSetupMenu.hidden = false;
	}
	receiveMessage(command, message) {
		switch (command) {
			case "picked": {
				this.addToDeck(draftCardSelection.childNodes.item(message), 1);
				return true;
			}
			case "reroll": {
				this.currentBooster = message.split("|");
				this.openNewPack();
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

	checkReadyConditions() {
		if (this.pressedReady && this.opponentReady) {
			new BoardState();
			gameState.givePartnerChoice();
		}
	}

	setPlayer(player) {
		this.currentPlayer = player % 2;
		draftMainInfo.textContent = this.currentPlayer == youAre? locale.draft.yourTurn : locale.draft.opponentsTurn;
	}

	// rerolls the current pack and syncs that order to the other player
	rerollCards() {
		for (let i = 0; i < 10; i++) {
			let cardPool = this.format.cardPools[this.format.packContents[i].pool];
			this.currentBooster.push(cardPool[Math.floor(Math.random() * cardPool.length)]);
		}

		socket.send("[reroll]" + this.currentBooster.join("|"));
		this.openNewPack();
	}

	// shuffles the freshly rerolled pack onto the screen
	openNewPack() {
		this.packsOpened++;
		draftCardSelection.innerHTML = "";

		for (let i = 0; i < 10; i++) {
			window.setTimeout(function() {
				let card = document.createElement("img");
				card.draggable = false;
				card.dataset.cardId = this.currentBooster.pop();
				card.src = cardLoader.getCardImageFromID(card.dataset.cardId);
				card.addEventListener("click", async function(e) {
					if (e.shiftKey || e.ctrlKey || e.altKey) {
						e.stopPropagation();
						previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId), false), false);
						return;
					}

					// is it your turn?
					if (gameState.currentPlayer != youAre) {
						return;
					}
					// does the card still exist?
					if (this.src.endsWith("cardHidden.png")) {
						return;
					}

					// sync this to the opponent first, since this element may get destroyed by draftAddToDeck if that triggers a reroll.
					socket.send("[picked]" + Array.from(this.parentElement.childNodes).indexOf(this));
					gameState.addToDeck(this, 0);
				});
				draftCardSelection.appendChild(card);
			}.bind(this), (i + 1) * 50);
		}

		draftPackNumber.textContent = locale.draft.packNumber.replace("{#CURRENT}", this.packsOpened).replace("{#TOTAL}", this.format.packCount);
		draftCardNumber.textContent = locale.draft.amountTaken.replace("{#CURRENT}", "0").replace("{#TOTAL}", this.format.cardPicks);
	}

	// adds a card to deck and switches which player is taking a card
	async addToDeck(card, deck) {
		let deckCard = document.createElement("img");
		deckCard.dataset.cardId = card.dataset.cardId;
		deckCard.src = card.src;
		document.getElementById("draftDeckList" + deck).appendChild(deckCard);
		document.getElementById("draftDeckCount" + deck).textContent = document.getElementById("draftDeckList" + deck).childElementCount + "/" + this.format.deckSize;
		card.src = "images/cardHidden.png";

		deckCard.addEventListener("click", async function(e) {
			e.stopPropagation();
			previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId), false), false);
		});

		// check if all cards have been taken.
		if (draftDeckList0.childElementCount == this.format.deckSize && draftDeckList1.childElementCount == this.format.deckSize) {
			// disable card picking
			this.currentPlayer = -1;
			draftMainInfo.textContent = locale.draft.settingUpDecks;

			// load decks
			let deckSetupPromises = [];
			for (let i = 0; i < 2; i++) {
				players[i].deck = deckFromCardList(Array.from(document.getElementById("draftDeckList" + i).childNodes).map(img => img.dataset.cardId), locale.draft.deckName, locale.draft.deckDescription);
				deckSetupPromises.push(cardLoader.deckToCdfList(players[i].deck, false, game.players[i]).then(deck => {
					game.players[i].setDeck(deck);
					gameUI.updateCard(game.players[i].deckZone, -1);
					document.getElementById("playerDeckButton" + i).disabled = false;
				}));
			}
			loadingIndicator.classList.add("active");
			await Promise.all(deckSetupPromises);
			loadingIndicator.classList.remove("active");

			// show start button
			draftMainInfo.textContent = locale.draft.finished;
			draftStartButton.hidden = false;
			return;
		}

		// check if a new pack needs to be opened
		this.takenCards++;
		if (this.takenCards == this.format.cardPicks) {
			this.takenCards = 0;
			if (this.currentPlayer == youAre) {
				this.rerollCards();
			}
		} else {
			draftCardNumber.textContent = locale.draft.amountTaken.replace("{#CURRENT}", this.takenCards).replace("{#TOTAL}", this.format.cardPicks);
		}
		this.setPlayer(this.currentPlayer + 1);
	}
}