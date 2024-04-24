import {startEffect} from "../scripts/levitationEffect.mjs";
import {reloadLocale, locale} from "../scripts/locale.mjs";
import {TutorialAI} from "./tutorialAi.mjs";
import {deckToCardIdList, toDeckx} from "../scripts/deckUtils.mjs";

function translatePage() {
	welcomeTitle.textContent = locale.intro.welcome;
	skipBtn.textContent = locale.intro.skip;

	namePrompt.textContent = locale.intro.namePrompt;
	nameInput.placeholder = locale.intro.enterName;
	confirmNameBtn.textContent = locale.intro.confirm;
	nameNotice.textContent = locale.intro.nameNotice;

	tutorialPrompt.textContent = locale.intro.tutorialPrompt;
	tutorialYesBtn.textContent = locale.intro.tutorialYes;
	tutorialNoBtn.textContent = locale.intro.tutorialNo;
	tutorialNotice.textContent = locale.intro.tutorialNotice;

	document.documentElement.lang = locale.code;
}

languageSelect.value = localStorage.getItem("language");
nameInput.value = localStorage.getItem("username");
translatePage();
document.documentElement.removeAttribute("aria-busy");

startEffect();

function confirmName() {
	localStorage.setItem("username", nameInput.value);


	// TEMPORARY EARLY EXIT SO I CAN COMMIT THIS FOR NOW
	openMainMenu();
	return;


	introStep1.style.display = "none";
	introStep2.style.display = "block";
}
confirmNameBtn.addEventListener("click", confirmName);
nameInput.addEventListener("keydown", e => {
	if (e.key === "Enter") {
		confirmName();
	}
});

function openMainMenu() {
	localStorage.setItem("finishedIntro", true);
	window.location.replace(location.href.substring(0, location.href.indexOf("/")) + "index.html");
}
tutorialNoBtn.addEventListener("click", openMainMenu);
skipBtn.addEventListener("click", openMainMenu);

languageSelect.addEventListener("change", async function() {
	localStorage.setItem("language", this.value);
	await reloadLocale();
	translatePage();
});

// for starting a tutorial game
let tutorialDeck = null; // we load this once the player actually decides to play the tutorial
tutorialYesBtn.addEventListener("click", () => {
	gameFrame.contentWindow.location.replace(location.href.substring(0, location.href.indexOf("/")) + "/game/index.html");
	tutorialDeck = fetch("./intro/tutorialDeck.deck");
});

function rigShuffleRng(cardList, topDeck = []) {
	// so that we don't mutate the list that comes in
	const list = [...cardList];
	const rng = [];
	// We just pretend to be the fisher-yates shuffler for a moment
	for (let i = list.length - 1; i > 0; i--) {
		// pick a 'random' element and swap it with the current element
		let rand = Math.floor(Math.random() * i);
		if (i >= list.length - topDeck.length) {
			rand = list.indexOf(topDeck[list.length - (i + 1)]);
		}
		[list[i], list[rand]] = [list[rand], list[i]];
		rng.push(rand);
	}

	return rng;
}

window.addEventListener("message", e => {
	if (e.source !== gameFrame.contentWindow) return;

	switch (e.data.type) {
		case "ready": {
			gameFrame.contentWindow.opponentAi = new TutorialAI();
			tutorialDeck.then(async response => {
				const deck = toDeckx(await response.json());
				const deckCardList = deckToCardIdList(deck);
				deckCardList.splice(deckCardList.indexOf(deck.suggestedPartner), 1);
				gameFrame.contentWindow.postMessage({
					type: "singleplayer",
					decks: [deck, deck],
					replay: {
						rngLog: [
							0, // starting player
							rigShuffleRng(deckCardList, [
								"U00044", // Machine Trooper
							]), // opponent deck shuffle
							rigShuffleRng(deckCardList, [
								"U00059", // Warrior of Light
								"U00058", // Terminal Berserker
								"U00199", // Ripper Doll
								"I00009", // Common Sword
								"S00030", // Parry

								"S00024" // Pinpoint Barrier
							]) // player deck shuffle
						]
					}
				});
			});
			break;
		}
		case "gameStarted": {
			gameFrame.style.visibility = "visible";
			break;
		}
		case "leaveGame": {
			console.log("tutorial done. :)");
			break;
		}
	}
});
