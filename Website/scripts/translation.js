let locale = {};

fetch("../data/locales/" + localStorage.getItem("language") + ".json")
.then(response => {
	return response.json()
})
.then(jsonData => {
	locale = jsonData;
	
	roomCodeInputTitle.textContent = locale["roomCodeInputTitle"];
	document.getElementById("roomCodeInputLabel").textContent = locale["enterRoomcode"];
	document.getElementById("roomCodeRefresh").setAttribute("aria-label", locale["rerollRoomcode"]);
	
	document.getElementById("gameModeSelectorLabel").textContent = locale["gamemode"];
	document.getElementById("gameModeNormalOption").textContent = locale["gamemodes"]["normal"];
	document.getElementById("gameModeDraftOption").textContent = locale["gamemodes"]["draft"];
	
	document.getElementById("connectBtn").textContent = locale["connectToRoom"];
	document.getElementById("trWaitingForOpponent").textContent = locale["waitingForOpponent"];
	document.getElementById("cancelWaitingBtn").textContent = locale["cancelWaiting"];
	document.getElementById("unofficialNotice").innerHTML = locale["unofficialNotice"];
	document.getElementById("rulesButton").textContent = locale["rulesButton"];
	// set rules button target
	document.getElementById("rulesButton").href = locale["rulesLink"];
	
	document.getElementById("settingsButton").textContent = locale["settingsButton"];
	document.getElementById("deckMakerButton").textContent = locale["deckCreatorButton"];
	
	// in-game
	document.getElementById("revealPartnerBtn").textContent = locale["partnerSelect"]["revealPartner"];
	document.getElementById("startingPlayerSelect").textContent = locale["selectStartingPlayer"];
	
	document.getElementById("chatHeader").textContent = locale["chat"]["title"];
	document.getElementById("chatInput").placeholder = locale["chat"]["enterMessage"];
	document.getElementById("roomCodeDisplayTitle").textContent = locale["roomCode"];
	document.getElementById("roomCodeHider").textContent = locale["roomCodeHide"];
	
	document.getElementById("youInfoText").textContent = locale["infoYou"];
	document.getElementById("opponentInfoText").textContent = locale["infoOpponent"];
	document.getElementById("lifeInfoText").textContent = locale["infoLife"];
	document.getElementById("manaInfoText").textContent = locale["infoMana"];
	
	for (let i = 0; i < 2; i++) {
		document.getElementById("deckTopBtn"+ i).textContent = locale["deckDropTop"];
		document.getElementById("deckShuffleInBtn" + i).textContent = locale["deckDropShuffle"];
		document.getElementById("deckBottomBtn" + i).textContent = locale["deckDropBottom"];
		document.getElementById("deckCancelBtn" + i).textContent = locale["deckDropCancel"];
		document.getElementById("showTopBtn" + i).textContent = locale["deckShowTop"];
	}
	
	document.getElementById("drawBtn").textContent = locale["deckDraw"];
	document.getElementById("shuffleBtn").textContent = locale["deckShuffle"];
	document.getElementById("deckSearchBtn").textContent = locale["deckSearch"];
	
	document.getElementById("lifeBtnHeader").textContent = locale["life"];
	document.getElementById("manaBtnHeader").textContent = locale["mana"];
	document.getElementById("tokenBtn").textContent = locale["actionsTokens"];
	document.getElementById("lifeHalf").textContent = locale["actionsHalf"];
	document.getElementById("showHandBtn").textContent = locale["actionsShowHand"];
	
	document.getElementById("cardSelectorReturnToDeck").textContent = locale["cardSelector"]["returnAllToDeck"];
	
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
	
	document.documentElement.lang = localStorage.getItem("language");
	document.documentElement.removeAttribute("aria-busy");
});