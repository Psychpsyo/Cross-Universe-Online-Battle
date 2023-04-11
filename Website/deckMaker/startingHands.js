startingHandGenBtn.addEventListener("click", function() {
	startingHandGenerator.showModal();
	generateStartingHand();
});
function generateStartingHand() {
	startingHandGeneratorCards.innerHTML = "";
	let cards = [...deckList];
	for (let i = 0; i < 5;i++) {
		let cardId = cards.splice(Math.floor(Math.random() * cards.length), 1);
		let img = document.createElement("img");
		img.src = linkFromCardId(cardId);
		startingHandGeneratorCards.appendChild(img);
	}
}

regenerateStartingHand.addEventListener("click", function() {
	generateStartingHand();
});