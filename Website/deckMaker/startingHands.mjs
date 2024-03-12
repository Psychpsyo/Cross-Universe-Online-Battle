import {locale} from "../scripts/locale.mjs";
import * as cardLoader from "../scripts/cardLoader.mjs";

document.getElementById("handGeneratorTitle").textContent = locale["deckMaker"]["startingHandGenerator"]["title"];
document.getElementById("regenerateStartingHand").textContent = locale["deckMaker"]["startingHandGenerator"]["redraw"];

startingHandGenBtn.addEventListener("click", function() {
	startingHandGenerator.showModal();
	generateStartingHand();
});
export function generateStartingHand() {
	startingHandGeneratorCards.innerHTML = "";
	let cards = [...deckList];
	for (let i = 0; i < 5;i++) {
		let cardId = cards.splice(Math.floor(Math.random() * cards.length), 1)[0];
		let img = document.createElement("img");
		img.src = cardLoader.getCardImageFromID(cardId);
		startingHandGeneratorCards.appendChild(img);
	}
}

regenerateStartingHand.addEventListener("click", function() {
	generateStartingHand();
});