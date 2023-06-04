let globalLocale = {};

fetch("../data/locales/" + localStorage.getItem("language") + ".json")
.then(response => {
	return response.json()
})
.then(jsonData => {
	globalLocale = jsonData;
});

// getting a card's image link from its ID
function getCardImageFromID(cardId) {
	return "https://crossuniverse.net/images/cards/" + (globalLocale.warnings.includes("noCards")? "en" : globalLocale.code) + "/" + cardId + ".jpg";
}