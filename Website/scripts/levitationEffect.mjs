import {locale} from "./locale.mjs";

let cardsSoFar = 0;
let effectElement = null;
let effectInterval = null;

const christmasCards = [
	"I00024",
	"I00039",
	"I00067",
	"I00077",
	"I00113",
	"S00047",
	"S00052",
	"S00096",
	"S00141",
	"S00162",
	"S00169",
	"S00215",
	"S00216",
	"T00002",
	"T00024",
	"U00001",
	"U00020",
	"U00055",
	"U00089",
	"U00092",
	"U00098",
	"U00103",
	"U00109",
	"U00121",
	"U00133",
	"U00134",
	"U00155",
	"U00176",
	"U00183",
	"U00185",
	"U00192",
	"U00226",
	"U00229",
	"U00233",
	"U00245",
	"U00256",
	"U00287"
];
const cardBaseUrl = (localStorage.getItem("cardImageUrl") === ""? "https://crossuniverse.net/images/cards/" : localStorage.getItem("cardImageUrl"));
async function getRandomCardLink() {
	// special holidays/occasions
	const date = new Date();
	const day = date.getDate();
	const month = date.getMonth();
	if (month === 11 && ([23, 24, 25, 26].includes(day))) {
		return cardBaseUrl + locale.code + "/" + christmasCards[Math.floor(Math.random(christmasCards.length))] + ".jpg";
	}
	if (month === 3 && day === 1) {
		return cardBaseUrl + locale.code + (Math.random() > .5? "/S00099.jpg" : "/S00238.jpg"); // Final Impact or Final Dice
	}

	// the usual
	// this goes over an intermediary fetch() so that the URL in the actual src will always point to a definite card.
	const response = await fetch(cardBaseUrl + "random/?lang=" + locale.code + "&num=" + cardsSoFar);
	return response.url;
}

async function spawnCard(parentElement) {
	const card = document.createElement("div");
	card.classList.add("levitateCard");

	const floatSeconds = Math.random() * 15 + 35;
	card.style.setProperty("--float-time", floatSeconds + "s");
	card.style.setProperty("--spin-delay", Math.random() * -20 + "s");
	const size = Math.random() * 5 + 7.5;
	card.style.width = size + "vh";
	card.style.zIndex = Math.floor(size * 10000);
	let position = Math.random() * 30;
	if (cardsSoFar % 2 == 0) {
		position += 70;
	}
	card.style.left = position + "%";
	card.dataset.src = await getRandomCardLink();
	card.style.backgroundImage = `url('${card.dataset.src}')`;
	card.addEventListener("click", function() {
		levitatingCardPreviewImage.src = this.dataset.src;
		levitatingCardPreviewOverlay.classList.add("shown");
	});
	cardsSoFar++;

	parentElement.appendChild(card);

	// starts the animation
	setTimeout(function() {
		card.style.top = "-20vh";
	}.bind(card), 500);

	// deletes the card once the animation is done
	setTimeout(function() {
		this.remove();
	}.bind(card), floatSeconds * 1000);
}

levitatingCardPreviewOverlay.addEventListener("click", e => {
	levitatingCardPreviewOverlay.classList.remove("shown");
});

export function startEffect(elem) {
	effectElement = elem;
	spawnCard(effectElement);
	effectInterval = window.setInterval(function() {
		spawnCard(effectElement);
	}, 3000);
}

export function stopEffect() {
	if (effectInterval !== null) {
		clearInterval(effectInterval);
		effectInterval = null;
	}
	if (effectElement !== null) {
		effectElement.innerHTML = "";
		effectElement = null;
	}
}