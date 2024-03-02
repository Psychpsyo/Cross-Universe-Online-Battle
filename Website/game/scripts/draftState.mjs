import {GameState} from "./gameState.mjs";
import {BoardState} from "./boardState.mjs";
import {Card} from "/rulesEngine/src/card.mjs";
import {locale} from "/scripts/locale.mjs";
import {netSend} from "./netcode.mjs";
import {deckFromCardList} from "/scripts/deckUtils.mjs";
import {previewCard} from "./generalUI.mjs";
import * as gameUI from "./gameUI.mjs";
import * as cardLoader from "/scripts/cardLoader.mjs";

export class DraftState extends GameState {
	constructor(automatic, format) {
		super();
		gameState = this;

		this.automatic = automatic;
		game.config.validateCardAmounts = false;

		this.format = format;
		format.packCount = Math.ceil(format.deckSize * 2 / format.cardPicks);

		this.currentBooster = [];
		this.takenCards = 0;
		this.packsOpened = 0;
		this.currentPlayer = null;
		this.firstPlayer = null;

		this.pressedReady = false;
		this.opponentReady = false;

		draftStartButton.textContent = locale.draft.startGame;
		draftDeckOwner0.textContent = players[0].name;
		draftDeckOwner1.textContent = players[1].name;

		// deck loading elements won't be needed
		deckDropzone.remove();
		deckSelector.classList.add("deckListDisable");

		draftDeckCount0.textContent = "0/" + format.deckSize;
		draftDeckCount1.textContent = "0/" + format.deckSize;

		document.querySelectorAll(".draftDeckList").forEach(deckList => {
			deckList.style.aspectRatio = "8130 / " + (Math.ceil(format.deckSize / 10) * 1185);
		});

		draftStartButton.addEventListener("click", function() {
			netSend("[ready]");
			gameState.pressedReady = true;
			draftStartButton.textContent = locale.draft.waitingForOpponent;
			draftStartButton.setAttribute("disabled", "");
			gameState.checkReadyConditions();
		});

		// setup that needs async
		game.rng.nextPlayerIndex(game).then((async index => {
			// must remove unsupported cards from card pools
			if (this.automatic) {
				for (const [_, pool] of Object.entries(this.format.cardPools)) {
					for (let i = pool.length - 1; i >= 0; i--) {
						if (!await cardLoader.isCardScripted(pool[i])) {
							pool.splice(i, 1);
						}
					}
					// TODO: prefer card types that are in the original pool
					// A pool of only spells should have a replacement spell inserted instead of a unit
					if (pool.length === 0) {
						pool.push("U00004");
					}
				}
			}

			// select starting player and begin
			this.firstPlayer = game.players[index];
			this.setPlayer(this.firstPlayer);
			this.rerollCards();
			draftGameSetupMenu.hidden = false;
		}).bind(this));
	}
	receiveMessage(command, message) {
		switch (command) {
			case "picked": {
				let cardElem = draftCardSelection.childNodes.item(message);
				if (this.isForPlayer(cardElem, localPlayer.next())) {
					this.addToDeck(cardElem, 0);
				}
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
			new BoardState(this.automatic);
			gameUI.init();
		}
	}

	setPlayer(player) {
		this.currentPlayer = player;
		draftMainInfo.textContent = this.currentPlayer === localPlayer? locale.draft.yourTurn : locale.draft.opponentsTurn;
	}

	// rerolls the current pack and syncs that order to the other player
	async rerollCards() {
		const randomRanges = [];
		for (let i = 0; i < 10; i++) {
			let cardPool = this.format.cardPools[this.format.packContents[i].pool];
			randomRanges.push(cardPool.length);
		}

		const randomValues = await game.rng.nextInts(randomRanges);
		for (let i = 0; i < 10; i++) {
			let cardPool = this.format.cardPools[this.format.packContents[i].pool];
			this.currentBooster.push({card: cardPool[randomValues[i]], forPlayer: this.format.packContents[i].player});
		}

		this.openNewPack();
	}

	// shuffles the freshly rerolled pack onto the screen
	openNewPack() {
		this.packsOpened++;
		draftCardSelection.innerHTML = "";

		for (let i = 0; i < 10; i++) {
			window.setTimeout(this.slideCardIn.bind(this), (i + 1) * 50);
		}

		draftPackNumber.textContent = locale.draft.packNumber.replace("{#CURRENT}", this.packsOpened).replace("{#TOTAL}", this.format.packCount);
		draftCardNumber.textContent = locale.draft.amountTaken.replace("{#CURRENT}", "0").replace("{#TOTAL}", this.format.cardPicks);
	}

	slideCardIn() {
		let card = document.createElement("img");
		card.draggable = false;
		const boosterElement = this.currentBooster.pop();
		card.dataset.cardId = boosterElement.card;
		card.dataset.forPlayer = boosterElement.forPlayer;
		card.src = cardLoader.getCardImageFromID(card.dataset.cardId);
		card.addEventListener("click", async function(e) {
			if (e.shiftKey || e.ctrlKey || e.altKey) {
				e.stopPropagation();
				previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId)), false);
				return;
			}

			// is it your turn?
			if (gameState.currentPlayer !== localPlayer) return;
			// does the card still exist?
			if (this.src.endsWith("cardHidden.png")) return;
			// is this card for you?
			if (!gameState.isForPlayer(this, localPlayer)) return;

			// sync this to the opponent first, since this element may get destroyed by draftAddToDeck if that triggers a reroll.
			netSend("[picked]" + Array.from(this.parentElement.childNodes).indexOf(this));
			gameState.addToDeck(this, 1);
		});
		draftCardSelection.appendChild(card);
	}

	// whether or not
	isForPlayer(cardElem, player) {
		switch (cardElem.dataset.forPlayer) {
			case "1":
				return player === this.firstPlayer;
			case "2":
				return player === this.firstPlayer.next();
		}
		return true;
	}

	// adds a card to deck and switches which player is taking a card
	async addToDeck(cardElem, deck) {
		let deckCard = document.createElement("img");
		deckCard.dataset.cardId = cardElem.dataset.cardId;
		deckCard.src = cardElem.src;
		document.getElementById("draftDeckList" + deck).appendChild(deckCard);
		document.getElementById("draftDeckCount" + deck).textContent = document.getElementById("draftDeckList" + deck).childElementCount + "/" + this.format.deckSize;
		cardElem.src = "images/cardHidden.png";

		deckCard.addEventListener("click", async function(e) {
			e.stopPropagation();
			previewCard(new Card(localPlayer, await cardLoader.getManualCdf(this.dataset.cardId)), false);
		});

		// check if all cards have been taken.
		if (draftDeckList0.childElementCount == this.format.deckSize && draftDeckList1.childElementCount == this.format.deckSize) {
			// disable card picking
			this.currentPlayer = null;
			draftMainInfo.textContent = locale.draft.settingUpDecks;
			draftGameSetupMenu.classList.add("draftFinished");

			// load decks
			let deckSetupPromises = [];
			for (let i = 0; i < 2; i++) {
				players[i].deck = deckFromCardList(Array.from(document.getElementById("draftDeckList" + i).childNodes).map(img => img.dataset.cardId), null, locale.draft.deckName, locale.draft.deckDescription);
				deckSetupPromises.push(cardLoader.deckToCdfList(players[i].deck, this.automatic, game.players[i]).then(deck => {
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
			await this.rerollCards();
		} else {
			draftCardNumber.textContent = locale.draft.amountTaken.replace("{#CURRENT}", this.takenCards).replace("{#TOTAL}", this.format.cardPicks);
		}
		this.setPlayer(this.currentPlayer.next());
	}
}