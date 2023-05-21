import {locale} from "/modules/locale.js";
import {startEffect} from "/modules/levitationEffect.js";

// translate main menu
roomCodeInputTitle.textContent = locale.mainMenu.roomCodeInputTitle;
roomCodeInputLabel.textContent = locale.mainMenu.enterRoomcode;
roomCodeRefresh.setAttribute("aria-label", locale.mainMenu.rerollRoomcode);

gameModeSelectorLabel.textContent = locale.mainMenu.gamemode;
gameModeNormalOption.textContent = locale.mainMenu.gamemodes.normal;
gameModeDraftOption.textContent = locale.mainMenu.gamemodes.draft;

connectBtn.textContent = locale.mainMenu.connectToRoom;
trWaitingForOpponent.textContent = locale.mainMenu.waitingForOpponent;
cancelWaitingBtn.textContent = locale.mainMenu.cancelWaiting;
unofficialNotice.innerHTML = locale.mainMenu.unofficialNotice;
rulesButton.textContent = locale.mainMenu.rulesButton;

rulesButton.href = locale.mainMenu.rulesLink;

settingsButton.textContent = locale.mainMenu.settingsButton;
deckMakerButton.textContent = locale.mainMenu.deckCreatorButton;

document.documentElement.lang = locale.code;
document.documentElement.removeAttribute("aria-busy");

// set up the background cards effect
document.documentElement.style.setProperty("--p1-card-back", "url('" + localStorage.getItem("cardBack") + "')");
if (localStorage.getItem("mainMenuCards") == "true") {
	startEffect(levitatingCards);
}