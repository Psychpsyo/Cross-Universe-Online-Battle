// This module exports the board state which is the main game state where the players actually play.
import {GameState} from "/modules/gameState.js";
import {socket, zoneToLocal} from "/modules/netcode.js";
import {ManualController} from "/modules/manualController.js";
import * as ui from "/modules/generalUI.js";

// selecting starting player
document.getElementById("startingPlayerSelect").addEventListener("click", function() {
	document.getElementById("startingPlayerSelect").style.display = "none";
	let startingPlayer = Math.random() > .5;
	putChatMessage(startingPlayer? locale["youStart"] : locale["opponentStarts"], "notice");
	socket.send("[selectPlayer]" + startingPlayer);
	partnerRevealButtonDiv.style.display = "block";
});


//opening the partner select menu
function openPartnerSelectMenu() {
	// unhide backdrop
	overlayBackdrop.style.display = "block";
	
	//clear partner selector
	if (document.getElementById("partnerSelectorGrid").firstChild) {
		document.getElementById("partnerSelectorGrid").innerHTML = "";
	}
	
	//add cards
	localPlayer.deckZone.cards.forEach((card, i) => {
		//check if card is a unit (eligible as a partner)
		if (card.getCardTypes().contains("unit")) {
			let cardImg = document.createElement("img");
			cardImg.src = card.getImage();
			cardImg.dataset.cardIndex = i;
			cardImg.addEventListener("click", function() {
				if (shiftHeld) {
					previewCard(localPlayer.deckZone.cards[this.dataset.cardIndex]);
				} else {
					document.getElementById("partnerSelectionMenu").style.display = "none";
					gameState.getPartnerFromDeck(this.dataset.cardIndex);
					overlayBackdrop.style.display = "none";
				}
			});
			document.getElementById("partnerSelectorGrid").appendChild(cardImg)
		}
	});
	document.getElementById("partnerSelectionMenu").style.display = "flex";
	
	//scroll to top
	document.getElementById("partnerSelectorGrid").parentNode.scrollTop = 0;
}


export class BoardState extends GameState {
	constructor() {
		super();
		
		// remove draft game section and deck drop zone since they are not needed anymore
		draftGameSetupMenu.remove();
		
		ui.init();
		this.controller = new ManualController();
		
		// show game area
		mainGameBlackout.textContent = "";
		mainGameArea.removeAttribute("hidden");
		gameInteractions.removeAttribute("hidden");
		
		// do partner select
		if (localPlayer.deck.suggestedPartner) {
			if (localStorage.getItem("partnerChoiceToggle") === "true") {
				document.getElementById("partnerSelectQuestion").style.display = "block";
				
				document.getElementById("chooseSuggestedPartnerBtn").addEventListener("click", function() {
					document.getElementById("partnerSelectQuestion").remove();
					gameState.getPartnerFromDeck();
				});
				document.getElementById("manualChoosePartnerBtn").addEventListener("click", function() {
					document.getElementById("partnerSelectQuestion").remove();
					openPartnerSelectMenu();
				});
			} else {
				this.getPartnerFromDeck();
			}
		} else {
			openPartnerSelectMenu();
		}
		
		document.getElementById("revealPartnerBtn").addEventListener("click", function() {
			document.getElementById("partnerRevealButtonDiv").style.display = "none";
			localPlayer.partnerZone.cards[0].hidden = false;
			ui.updateCard(localPlayer.partnerZone, 0);
			socket.send("[revealPartner]");
		});
	}
	receiveMessage(command, message) {
		switch (command) {
			case "deckOrder": { // opponent shuffled a deck
				let deck = zoneToLocal("deck" + message[0]);
				message = message.substr(2);
				let order = message.split("|").map(i => parseInt(i));
				deck.cards.sort((a, b) => order.indexOf(deck.cards.indexOf(a)) - order.indexOf(deck.cards.indexOf(b)));
				putChatMessage(locale[deck.playerIndex == 1? "yourDeckShuffled" : "opponentDeckShuffled"], "notice");
				return true;
			}
			case "choosePartner": { // opponent selected their partner
			let partnerPosInDeck = parseInt(message);
				game.players[0].partnerZone.add(game.players[0].deckZone.cards[partnerPosInDeck], 0);
				ui.removeCard(game.players[0].deckZone, partnerPosInDeck);
				ui.insertCard(game.players[0].partnerZone, 0);
				this.doSelectStartingPlayer();
				return true;
			}
			case "revealPartner": { // opponent revealed their partner
				game.players[0].partnerZone.cards[0].hidden = false;
				ui.updateCard(game.players[0].partnerZone, 0);
				return true;
			}
			case "selectPlayer": { // opponent chose the starting player (at random)
				startingPlayerSelect.style.display = "none";
				putChatMessage(message == "true"? locale["opponentStarts"] : locale["youStart"], "notice");
				partnerRevealButtonDiv.style.display = "block";
				return true;
			}
			case "revealCard": { // opponent revealed a presented card
				//let cardDiv = presentedCards0.children.item(parseInt(message));
				//cardDiv.src = cardAreas["presentedCards0"].cards[cardDiv.dataset.cardIndex].getImage();
				//cardDiv.dataset.shown = true;
				return true;
			}
			case "unrevealCard": { // opponent hid a presented card
				//let cardDiv = presentedCards0.children.item(parseInt(message));
				//cardDiv.src = "images/cardBackFrameP0.png";
				//cardDiv.dataset.shown = false;
				return true;
			}
			case "createToken": {
				//cardAreas.tokens.createOpponentToken(message);
				return true;
			}
			default: {
				let done = ui.receiveMessage(command, message);
				if (!done) {
					done = this.controller.receiveMessage(command, message);
				}
				return done;
			}
		}
	}
	
	// called after partner selection
	getPartnerFromDeck(partnerPosInDeck = -1) {
		mainGameBlackout.textContent = locale["partnerSelect"]["waitingForOpponent"];
		if (partnerPosInDeck == -1) {
			partnerPosInDeck = localPlayer.deckZone.cards.findIndex(card => {return card.cardId == game.players[localPlayer.index].deck["suggestedPartner"]});
		}
		localPlayer.partnerZone.add(localPlayer.deckZone.cards[partnerPosInDeck], 0);
		ui.removeCard(localPlayer.deckZone, partnerPosInDeck);
		ui.insertCard(localPlayer.partnerZone, 0);
		
		socket.send("[choosePartner]" + partnerPosInDeck);
		
		this.controller.deckShuffle(localPlayer.deckZone);
		
		this.doSelectStartingPlayer();
	}
	
	doSelectStartingPlayer() {
		if (game.players[0].partnerZone.cards[0] && game.players[1].partnerZone.cards[0]) {
			if (youAre === 0) {
				startingPlayerSelect.style.display = "block";
			}
			mainGameBlackout.remove();
		}
	}
}