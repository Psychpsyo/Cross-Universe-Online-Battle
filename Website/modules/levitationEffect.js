import {locale} from "/modules/locale.js";

let cardsSoFar = 0;
let effectElement = null;
let effectInterval = null;

function spawnCard(parentElement) {
	let card = document.createElement("div");
	card.classList.add("levitateCard");

	let floatSeconds = Math.random() * 15 + 35;
	card.style.setProperty("--float-time", floatSeconds + "s");
	card.style.setProperty("--spin-delay", Math.random() * -20 + "s");
	let size = Math.random() * 5 + 7.5;
	card.style.width = size + "vh";
	card.style.zIndex = Math.floor(size * 10000);
	let position = Math.random() * 30;
	if (cardsSoFar % 2 == 0) {
		position += 70;
	}
	card.style.left = position + "%";
	card.style.backgroundImage = "url('https://crossuniverse.net/images/cards/random?lang=" + locale.code + "&num=" + cardsSoFar + "')"
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