import {getCardImageFromID} from "/modules/cardLoader.js";
import {locale} from "/modules/locale.js";

let profilePictureInfo = await fetch("../data/profilePictureInfo.json").then(async response => await response.json());
fetch("../data/profilePictureGroups.json")
.then(async response => await response.json())
.then(profilePictureGroups => {
	for (const group of Object.keys(profilePictureGroups)) {
		addProfilePictureList(group, profilePictureGroups[group], profilePicturesCategorized);
	}
});

let cardNames = {};
let allCardButtonsCreated = false;
export function refetchCardData() {
	fetch("https://crossuniverse.net/cardInfo", {
		method: "POST",
		body: JSON.stringify({
			"language": localStorage.getItem("language"),
			"sortBy": "cardID"
		})
	})
	.then(response => response.json())
	.then(response => {
		cardNameReload(response);
		if (!allCardButtonsCreated) {
			allCardButtonsCreated = true;
			let cardLists = {
				U: [],
				S: [],
				I: [],
				T: []
			}
			response.forEach(card => {
				cardLists[card.cardID[0]].push(card.cardID);
			});
			addProfilePictureList("units", cardLists.U, profilePicturesAll);
			addProfilePictureList("tokens", cardLists.T, profilePicturesAll);
			addProfilePictureList("spells", cardLists.S, profilePicturesAll);
			addProfilePictureList("items", cardLists.I, profilePicturesAll);
		}
	});
}

function cardNameReload(cardApiData) {
	cardApiData.forEach(card => {
		cardNames[card.cardID] = card.name;
	});
	for (const button of Array.from(document.querySelectorAll(".profilePicture"))) {
		button.setAttribute("aria-label", cardNames[button.dataset.cardID]);
	}
}

function recalculateActiveButtons() {
	for (const button of Array.from(document.querySelectorAll(".profilePicture"))) {
		if (button.dataset.cardID == localStorage.getItem("profilePicture")) {
			button.classList.add("selectedProfilePic");
		} else {
			button.classList.remove("selectedProfilePic");
		}
	}
}

function buttonSetProfilePicture() {
	localStorage.setItem("profilePicture", this.dataset.cardID);
	recalculateActiveButtons();
}

function addProfilePictureList(name, cardIdList, targetDiv) {
	let list = document.createElement("div");
	list.classList.add("profilePictureList");
	for (const cardId of cardIdList) {
		let button = document.createElement("button");
		button.classList.add("profilePicture");
		button.dataset.cardID = cardId;
		button.addEventListener("click", buttonSetProfilePicture);
		if (cardNames[cardId]) {
			button.setAttribute("aria-label", cardNames[cardId]);
		}
		if (cardId == localStorage.getItem("profilePicture")) {
			button.classList.add("selectedProfilePic");
		}

		let img = document.createElement("img");
		img.loading = "lazy";
		img.src = getCardImageFromID(cardId);
		img.style.setProperty("--left", -(profilePictureInfo[cardId]?.left ?? 50) + "%");
		button.appendChild(img);
		list.appendChild(button);
	}
	let h2 = document.createElement("h2");
	h2.textContent = locale.settings.profile.profilePicture.categories[name];
	h2.classList.add("profilePictureHeader");
	h2.dataset.category = name;
	targetDiv.appendChild(h2);
	targetDiv.appendChild(list);
}

function closeProfilePictureSelector() {
	profilePictureDialog.close();
	document.documentElement.classList.remove("dialogOpen");
}
profilePictureCloseBtn.addEventListener("click", closeProfilePictureSelector);
profilePictureDialog.addEventListener("click", function(e) {
	if (e.target === profilePictureDialog) {
		closeProfilePictureSelector();
	}
});
profilePictureButton.addEventListener("click", function() {
	profilePictureDialog.showModal();
	document.documentElement.classList.add("dialogOpen");
});

profilePicturesAllBtn.addEventListener("click", function() {
	profilePicturesAllBtn.disabled = true;
	profilePicturesCategorizedBtn.disabled = false;

	profilePicturesCategorized.hidden = true;
	profilePicturesAll.hidden = false;
	profilePicturesAll.scrollTop = 0;
});
profilePicturesCategorizedBtn.addEventListener("click", function() {
	profilePicturesCategorizedBtn.disabled = true;
	profilePicturesAllBtn.disabled = false;

	profilePicturesAll.hidden = true;
	profilePicturesCategorized.hidden = false;
	profilePicturesCategorized.scrollTop = 0;
});