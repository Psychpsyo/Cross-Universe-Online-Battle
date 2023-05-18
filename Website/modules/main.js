import {startEffect} from "/modules/levitationEffect.js";

document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");

if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}