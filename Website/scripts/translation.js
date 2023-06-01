let locale = {};

fetch("../data/locales/" + localStorage.getItem("language") + ".json")
.then(response => {
	return response.json()
})
.then(jsonData => {
	locale = jsonData;
	
	// in-game
	document.getElementById("chatHeader").textContent = locale["chat"]["title"];
	document.getElementById("chatInput").placeholder = locale["chat"]["enterMessage"];
	
	document.getElementById("youInfoText").textContent = locale["infoYou"];
	document.getElementById("opponentInfoText").textContent = locale["infoOpponent"];
	document.getElementById("lifeInfoText").textContent = locale["infoLife"];
	document.getElementById("manaInfoText").textContent = locale["infoMana"];
	
	if (localStorage.getItem("fieldLabelToggle") == "true") {
		document.querySelectorAll(".fieldLabelUnitZone").forEach(label => {
			label.textContent = locale["fieldLabels"]["unitZone"];
		});
		document.querySelectorAll(".fieldLabelSpellItemZone").forEach(label => {
			label.textContent = locale["fieldLabels"]["spellItemZone"];
		});
		document.querySelectorAll(".fieldLabelPartnerZone").forEach(label => {
			label.textContent = locale["fieldLabels"]["partnerZone"];
		});
		document.querySelectorAll(".fieldLabelDeck").forEach(label => {
			label.textContent = locale["fieldLabels"]["deck"];
			if (locale["fieldLabels"]["verticalText"]) {
				label.classList.add("verticalFieldLabel");
			}
		});
		document.querySelectorAll(".fieldLabelDiscardPile").forEach(label => {
			label.textContent = locale["fieldLabels"]["discardPile"];
			if (locale["fieldLabels"]["verticalText"]) {
				label.classList.add("verticalFieldLabel");
			}
		});
		document.querySelectorAll(".fieldLabelExileZone").forEach(label => {
			label.textContent = locale["fieldLabels"]["exileZone"];
			if (locale["fieldLabels"]["verticalText"]) {
				label.classList.add("verticalFieldLabel");
			}
		});
	}
});