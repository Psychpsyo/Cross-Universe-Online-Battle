import {countDeckCards, deckToCardIdList, toBasicDeck} from "./deckUtils.mjs";
import localize, {locale} from "./locale.mjs";
import * as cardLoader from "./cardLoader.mjs";

// currently expects to be put inside a <dialog>
class DeckDialog extends HTMLElement {
	// the deck currently being viewed in this
	#deck = null;
	// the lists of decks currently available in here
	#deckLists = null;

	constructor() {
		super();
	}

	connectedCallback() {
		this.classList.add("dialogContent");

		const header = document.createElement("header");
		this.appendChild(header);

		this.heading = document.createElement("h1");
		header.appendChild(this.heading);

		this.downloadBtn = document.createElement("button");
		this.downloadBtn.classList.add("svgButton");
		this.downloadBtn.style.display = "none";
		this.downloadBtn.addEventListener("click", () => {
			const deck = toBasicDeck(this.#deck);
			const downloadElement = document.createElement("a");
			downloadElement.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deck));
			downloadElement.download = deck.Name + ".deck";
			downloadElement.click();
		});

		const downloadBtnImg = document.createElement("img");
		downloadBtnImg.src = "images/icons/download.svg";
		downloadBtnImg.alt = localize("game.deckSelect.downloadDeck");
		downloadBtnImg.draggable = false;
		this.downloadBtn.appendChild(downloadBtnImg);

		const headerButtonHolder = document.createElement("div");
		headerButtonHolder.classList.add("headerButtonsRight");
		headerButtonHolder.appendChild(this.downloadBtn);
		header.appendChild(headerButtonHolder);

		this.flexBox = document.createElement("div");
		this.flexBox.classList.add("deckDialogFlex");
		this.appendChild(this.flexBox);

		// deck view on the right
		const deckView = document.createElement("div");
		deckView.classList.add("deckDialogDeckView");
		this.flexBox.appendChild(deckView);

		this.cardGrid = document.createElement("div");
		this.cardGrid.classList.add("cardGrid");
		deckView.appendChild(this.cardGrid);

		this.description = document.createElement("div");
		this.description.classList.add("deckDialogDescription");
		deckView.appendChild(this.description);


		// TODO: remove this once Firefox and Safari support closedBy on dialog
		this.parentElement.addEventListener("click", function(e) {
			if (e.target === this) {
				this.close();
			}
		});
	}

	#clearDeck() {
		this.#deck = null;
		this.cardGrid.innerHTML = "";
		this.cardGrid.scrollTop = 0;
		this.description.innerHTML = "";
	}

	#showDeck(deck, {onCardClicked=()=>{}, allowDownload=false}) {
		this.#clearDeck();
		this.#deck = deck;

		console.log(allowDownload);
		if (allowDownload) {
			this.downloadBtn.style.removeProperty("display");
		} else {
			this.downloadBtn.style.display = "none";
		}

		// add new cards
		let partnerAdded = false;
		deckToCardIdList(deck).forEach(cardId => {
			let cardImg = document.createElement("img");
			cardImg.src = cardLoader.getCardImageFromID(cardId, "tiny");
			cardImg.dataset.cardId = cardId;

			// make partner card glow
			if (cardId === deck.suggestedPartner && !partnerAdded) {
				partnerAdded = true;
				cardImg.classList.add("cardHighlight");
			}

			this.cardGrid.appendChild(cardImg);
			cardImg.addEventListener("click", onCardClicked);
		});

		// set the description
		if (deck.description) {
			this.description.textContent = deck.description[locale.code] ?? deck.description.en ?? deck.description[Object.keys(deck.description)[0]] ?? "";
			this.description.hidden = false;
		} else {
			this.description.hidden = true;
		}
	}

	#setupDeckListPane(deckLists, showDeckOptions) {
		if (this.deckListPane) {
			// if we need to show the same selection of deck lists, we don't need to re-do setup
			if (deckLists === this.#deckLists) {
				this.deckListPane.style.removeProperty("display");
				return;
			}
			// otherwise, remove the current deckListPane to rebuild it.
			this.deckListPane.remove();
		}

		this.#deckLists = deckLists;

		this.currentDeckSelection = "default";

		this.deckListPane = document.createElement("div");
		this.deckListPane.classList.add("deckDialogListPane");

		const deckListHeader = document.createElement("div");
		deckListHeader.classList.add("deckDialogListHeader");
		this.deckListPane.appendChild(deckListHeader);

		for (const deckList of Object.keys(deckLists)) {
			const button = document.createElement("button");
			button.textContent = localize(`game.deckSelect.deckLists.${deckList}`);
			button.classList.add("bigButton");
			button.addEventListener("click", () => {
				if (this.currentDeckSelection !== deckList) {
					this.currentDeckSelection = deckList;
					this.#addDecksToList(deckList, showDeckOptions);
				}
			});
			deckListHeader.appendChild(button);
		}

		this.deckList = document.createElement("div");
		this.deckList.classList.add("deckDialogList");
		this.deckListPane.appendChild(this.deckList);
		this.#addDecksToList(Object.keys(deckLists)[0], showDeckOptions);

		const loadDeckBtn = document.createElement("button");
		loadDeckBtn.textContent = localize("game.deckSelect.deckListLoadSelected");
		loadDeckBtn.classList.add("deckDialogLoadButton", "bigButton");
		loadDeckBtn.addEventListener("click", () => {
			const selectedDeck = this.querySelector(".selectedDeck");
			if (!selectedDeck) return;
			this.parentElement.close();
			gameState.loadDeck(this.#deck);
		});
		this.deckListPane.appendChild(loadDeckBtn);

		this.flexBox.prepend(this.deckListPane);
	}

	// loading decks into the deck list
	async #addDecksToList(deckList, showDeckOptions) {
		// empty the deck selector
		this.deckList.innerHTML = "";
		this.currentDeckSelection = deckList;

		let deckPromises = [];
		for (const deckID of this.#deckLists[deckList]) {
			deckPromises.push(
				fetch("./data/decks/" + deckID + ".deckx")
				.then(response => response.json())
				.then(deck => {
					return {id: deckID, deck: deck};
				})
			);
		}

		let deckResults = await Promise.allSettled(deckPromises);
		for (const result of deckResults) {
			const deck = result.value.deck;
			this.#deckLists[this.currentDeckSelection][result.value.id] = deck;
			const deckElem = document.createElement("button");
			deckElem.classList.add("bigButton");
			deckElem.textContent = deck.name[locale.code] ?? deck.name.en ?? deck.name.ja ?? "---";

			const cardAmountSubtitle = document.createElement("span");
			cardAmountSubtitle.classList.add("deckCardAmount");
			cardAmountSubtitle.textContent = localize("game.deckSelect.deckListCardAmount", countDeckCards(deck));

			deckElem.addEventListener("click", (e) => {
				this.deckListPane.querySelector(".selectedDeck")?.classList.remove("selectedDeck");
				e.target.classList.add("selectedDeck");
				this.#showDeck(deck, showDeckOptions);
			});

			deckElem.appendChild(document.createElement("br"));
			deckElem.appendChild(cardAmountSubtitle);
			this.deckList.appendChild(deckElem);
		}

		this.#clearDeck();
	}

	openForDeck(deck, showDeckOptions) {
		if (this.deckListPane) this.deckListPane.style.display = "none";

		this.#showDeck(deck, showDeckOptions);

		// set the name
		if (deck.name) {
			this.heading.classList.remove("textPlaceholder");
			this.heading.textContent = deck.name[locale.code] ?? deck.name.en ?? deck.name[Object.keys(deck.description)[0]] ?? "";
		} else {
			this.heading.textContent = "";
		}
		if (this.heading.textContent === "") {
			this.heading.textContent = localize("game.deckSelect.unnamedDeck");
			this.heading.classList.add("textPlaceholder");
		}

		this.parentElement.showModal();
	}

	openAsDeckSelector(deckLists, showDeckOptions) {
		this.heading.textContent = localize("game.deckSelect.dialogHeader");
		this.#setupDeckListPane(deckLists, showDeckOptions);
		this.parentElement.showModal();
	}
}
customElements.define("deck-dialog", DeckDialog);
