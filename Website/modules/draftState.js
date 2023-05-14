import {GameState} from "/modules/gameState.js";
import {BoardState} from "/modules/boardState.js";
import {Card} from "/modules/card.js";

let basicFormat = await fetch("data/draftFormats/beginnerFormat.json");
basicFormat = await basicFormat.json();
basicFormat.packCount = Math.ceil(basicFormat.deckSize * 2 / basicFormat.cardPicks);

export class DraftState extends GameState {
	constructor() {
		super();
		this.format = basicFormat;
		this.currentBooster = [];
		this.takenCards = 0;
		this.packsOpened = 0;
		this.currentPlayer = 0;
		
		this.pressedReady = false;
		this.opponentReady = false;
		
		draftDeckOwner0.textContent = localStorage.getItem("username");
		if (draftDeckOwner0.textContent == "") {
			draftDeckOwner0.textContent = locale["draft"]["yourDeck"];
		}
		draftDeckOwner1.textContent = opponentName ?? locale["draft"]["opponentDeck"];
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
			draftStartButton.textContent = locale["draft"]["waitingForOpponent"];
			draftStartButton.setAttribute("disabled", "");
			gameState.checkReadyConditions();
		});
		
		// deck selection elements won't be needed
		deckSelector.remove();
		deckDropzone.remove();
		draftGameSetupMenu.removeAttribute("hidden");
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
			gameState = new BoardState();
		}
	}
	
	setPlayer(player) {
		this.currentPlayer = player % 2;
		draftMainInfo.textContent = this.currentPlayer == youAre? locale["draft"]["yourTurn"] : locale["draft"]["opponentsTurn"];
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
				card.dataset.cardId = this.currentBooster.pop();
				card.src = getCardImageFromID(card.dataset.cardId);
				card.addEventListener("click", async function() {
					if (shiftHeld || ctrlHeld || altHeld) {
						await game.registerCard(this.dataset.cardId);
						previewCard(new Card(game, this.dataset.cardId));
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
				card.addEventListener("dragstart", function(e) {
					e.preventDefault();
				});
				draftCardSelection.appendChild(card);
			}.bind(this), (i + 1) * 50);
		}
		
		draftPackNumber.textContent = locale["draft"]["packNumber"].replace("{#CURRENT}", this.packsOpened).replace("{#TOTAL}", this.format.packCount);
		draftCardNumber.textContent = locale["draft"]["amountTaken"].replace("{#CURRENT}", "0").replace("{#TOTAL}", this.format.cardPicks);
	}
	
	// adds a card to deck and switches which player is taking a card
	async addToDeck(card, deck) {
		let deckCard = document.createElement("img");
		deckCard.dataset.cardId = card.dataset.cardId;
		deckCard.src = card.src;
		document.getElementById("draftDeckList" + deck).appendChild(deckCard);
		document.getElementById("draftDeckCount" + deck).textContent = document.getElementById("draftDeckList" + deck).childElementCount + "/" + this.format.deckSize;
		card.src = "images/cardHidden.png";
		
		game.registerCard(card.dataset.cardId);
		deckCard.addEventListener("click", async function() {
			await game.registerCard(card.dataset.cardId);
			previewCard(new Card(game, this.dataset.cardId));
		});
		
		// check if all cards have been taken.
		if (draftDeckList0.childElementCount == this.format.deckSize && draftDeckList1.childElementCount == this.format.deckSize) {
			// disable card picking
			this.currentPlayer = -1;
			draftMainInfo.textContent = locale["draft"]["finished"];
			
			// load decks
			opponentDeckPromise = game.players[0].setDeck(deckUtils.deckFromCardList(Array.from(draftDeckList1.childNodes).map(img => {return img.dataset.cardId}), locale["draft"]["deckName"]));
			await Promise.all([opponentDeckPromise, game.players[1].setDeck(deckUtils.deckFromCardList(Array.from(draftDeckList0.childNodes).map(img => {return img.dataset.cardId}), locale["draft"]["deckName"]))]);
			
			// show start button
			draftStartButton.removeAttribute("hidden");
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
			draftCardNumber.textContent = locale["draft"]["amountTaken"].replace("{#CURRENT}", this.takenCards).replace("{#TOTAL}", this.format.cardPicks);
		}
		this.setPlayer(this.currentPlayer + 1);
	}
}