import {getCardImageFromID} from "../scripts/cardLoader.mjs";
import {locale} from "../scripts/locale.mjs";

const categoryLinks = {
	"cardGameRecommendation": "https://crossuniverse.jp/原作小説/",
	"cardGameDystopia": "https://kakuyomu.jp/works/16817330652761030151"
}

const profilePictureInfo = await fetch("./data/profilePictureInfo.json").then(async response => await response.json());
fetch("./data/profilePictureGroups.json")
.then(async response => await response.json())
.then(profilePictureGroups => {
	for (const group of Object.keys(profilePictureGroups)) {
		addProfilePictureList(group, profilePictureGroups[group], profilePicturesCategorized);
	}
});

let cardNames = {};
let allCardButtonsCreated = false;
export function refetchCardData() {
	fetch(localStorage.getItem("cardDataApiUrl") === ""? "https://crossuniverse.net/cardInfo/" : localStorage.getItem("cardDataApiUrl"), {
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

			setProfilePicture(localStorage.getItem("profilePicture"));
		}
	});
}

function cardNameReload(cardApiData) {
	cardApiData.forEach(card => {
		cardNames[card.cardID] = card.name;
	});
	for (const button of Array.from(document.querySelectorAll("#profilePictureDialog .profilePictureBtn"))) {
		button.setAttribute("aria-label", cardNames[button.dataset.cardID]);
	}
}

function setProfilePicture(newPicture) {
	for (const button of Array.from(document.querySelectorAll(".profilePictureBtn"))) {
		if (button.dataset.cardID == newPicture) {
			button.classList.add("selectedProfilePic");
		} else {
			button.classList.remove("selectedProfilePic");
		}
	}

	profilePictureImage.src = getCardImageFromID(newPicture, "tiny");
	profilePictureImage.style.setProperty("--left", -(profilePictureInfo[newPicture]?.left ?? 50) + "%");
}

function buttonSetProfilePicture() {
	localStorage.setItem("profilePicture", this.dataset.cardID);
	setProfilePicture(this.dataset.cardID);
}

function addProfilePictureList(name, cardIdList, targetDiv) {
	let list = document.createElement("div");
	list.classList.add("profilePictureList");
	for (const cardId of cardIdList) {
		let button = document.createElement("button");
		button.classList.add("profilePictureBtn");
		button.dataset.cardID = cardId;
		button.addEventListener("click", buttonSetProfilePicture);
		if (cardNames[cardId]) {
			button.setAttribute("aria-label", cardNames[cardId]);
		}

		let img = document.createElement("img");
		img.loading = "lazy";
		img.src = getCardImageFromID(cardId, "tiny");
		img.style.setProperty("--left", -(profilePictureInfo[cardId]?.left ?? 50) + "%");
		button.appendChild(img);
		list.appendChild(button);
	}
	let h2 = document.createElement("h2");
	if (name in categoryLinks) {
		let a = document.createElement("a");
		a.textContent = locale.settings.profile.profilePictureMenu.categories[name];
		a.href = categoryLinks[name];
		a.target = "_blank";
		a.classList.add("profilePictureCategoryName");
		a.dataset.category = name;
		h2.appendChild(a);
	} else {
		h2.textContent = locale.settings.profile.profilePictureMenu.categories[name];
		h2.classList.add("profilePictureCategoryName");
		h2.dataset.category = name;
	}
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