import {reloadLocale, locale} from "/modules/locale.js";
import {refetchCardData} from "./profilePictureSelector.js";

// hotkey helper functions
// these convert between the ids of the hotkeys' button elements and the the name for the hotkey
function idToHotkey(id) {
	return editingHotkey[6].toLowerCase() + editingHotkey.substring(7);
}
function hotkeyToId(hotkeyName) {
	return "hotkey" + hotkeyName[0].toUpperCase() + hotkeyName.substring(1);
}
// converts a hotkey object to that hotkey's string representation
async function hotkeyToString(hotkey) {
	if (hotkey.keyCode === "") {
		return "---";
	}
	let keyName = locale.settings.hotkeys.keys[hotkey.keyCode];
	if ("keyboard" in navigator) {
		// TODO: Keyboard API works on Chrome already, but not in Firefox. :(
		// My own system is used in addition to it since, even on Chrome, the API has far from all the keys.
		keyName = keyName ?? (await navigator.keyboard.getLayoutMap()).get(hotkey.keyCode);
	}
	keyName = keyName ?? "?";
	keyName = keyName[0].toUpperCase() + keyName.substring(1);
	return (hotkey.ctrl? locale.settings.hotkeys.keyCtrl + " + " : "") + (hotkey.shift? locale.settings.hotkeys.keyShift + " + " : "") + (hotkey.alt? locale.settings.hotkeys.keyAlt + " + " : "") + keyName;
}
// coloring repeat hotkeys in red
function validateHotkeys() {
	let seenHotkeys = [];
	for (const [name, hotkey] of Object.entries(JSON.parse(localStorage.getItem("hotkeys")))) {
		if (hotkey.keyCode === "") {
			continue;
		}
		document.getElementById(hotkeyToId(name)).classList.remove("invalidHotkey");
		// check for an unmodified number row hotkey
		if (hotkey.keyCode.startsWith("Digit") && !hotkey.ctrl && !hotkey.shift && !hotkey.alt) {
			document.getElementById(hotkeyToId(name)).classList.add("invalidHotkey");
			break;
		}
		let stringHotkey = JSON.stringify(hotkey);
		for (const seenHotkey of seenHotkeys) {
			if (stringHotkey === seenHotkey) {
				document.getElementById(hotkeyToId(name)).classList.add("invalidHotkey");
				break;
			}
		}
		seenHotkeys.push(stringHotkey);
	}
}

async function relabelAllHotkeys() {
	for (const [name, hotkey] of Object.entries(JSON.parse(localStorage.getItem("hotkeys")))) {
		document.getElementById(hotkeyToId(name)).textContent = await hotkeyToString(hotkey);
	}
}

// custom font helper
function updateCustomFontInputDiv() {
	customFontInput.value = localStorage.getItem("customFont");
	customFontInputDiv.style.display = fontSelector.value == "custom"? "block" : "none";
	(fontSelector.value == "custom"? fontSettingsRow : fontSelector).after(customFontInputDiv);
}

// translation
function setLanguage(language) {
	localStorage.setItem("language", language);

	reloadLocale().then(function() {
		languageWarnings.innerHTML = "";
		languageSelectorDiv.style.marginBottom = 0;
		if (locale.warnings.length > 0) {
			for (const warning of locale.warnings) {
				let template = document.getElementById(warning == "incomplete"? "langWarningLink" : "langWarning").content.firstElementChild.cloneNode(true);
				template.querySelector(".warningText").textContent = locale.settings.general.languageWarnings[warning];
				template.querySelector(".warningNoteIcon").setAttribute("aria-label", locale.settings.general.languageWarningName);
				languageWarnings.appendChild(template);
				languageWarnings.appendChild(document.createElement("br"));
			}
			languageSelectorDiv.style.marginBottom = languageWarnings.clientHeight + 5 + "px";
		}

		title.textContent = locale.settings.title;

		generalHeading.textContent = locale.settings.general.title;
		languageSelectorLabel.textContent = locale.settings.general.language;
		partnerChoiceLabel.textContent = locale.settings.general.partnerChoice;
		closePreviewToggleLabel.textContent = locale.settings.general.autoClosePreview;
		alwaysShowCardButtonsToggleLabel.textContent = locale.settings.general.alwaysShowCardButtons;

		profileHeading.textContent = locale.settings.profile.title;
		usernameLabel.textContent = locale.settings.profile.username;
		usernameInput.placeholder = locale.settings.profile.usernamePlaceholder;
		cardBackLabel.textContent = locale.settings.profile.cardBackLink;
		customCardBack.placeholder = locale.settings.profile.cardBackLinkPlaceholder;

		profilePictureLabel.textContent = locale.settings.profile.profilePicture.label;
		profilePictureButton.textContent = locale.settings.profile.profilePicture.button;
		profilePictureDialogHeader.textContent = locale.settings.profile.profilePicture.header;
		profilePicturesCategorizedBtn.textContent = locale.settings.profile.profilePicture.categoriesTab;
		profilePicturesAllBtn.textContent = locale.settings.profile.profilePicture.allCardsTab;
		profilePictureCloseBtn.textContent = locale.settings.profile.profilePicture.close;
		for (const categoryHeading of Array.from(document.querySelectorAll(".profilePictureCategoryName"))) {
			categoryHeading.textContent = locale.settings.profile.profilePicture.categories[categoryHeading.dataset.category];
		}

		customizationHeading.textContent = locale.settings.customization.title;
		fieldLabelToggleLabel.textContent = locale.settings.customization.fieldLabels;
		cardBackToggleLabel.textContent = locale.settings.customization.disableCardBacks;
		fieldLeftToggleLabel.textContent = locale.settings.customization.leftField;
		themeSelectorLabel.textContent = locale.settings.customization.theme;
		Array.from(themeSelector.children).forEach(theme => {
			theme.textContent = locale.settings.customization.themes[theme.value];
		});
		menuCardsToggleLabel.textContent = locale.settings.customization.mainMenuCards;

		accessibilityHeading.textContent = locale.settings.accessibility.title;
		fontSelectorLabel.textContent = locale.settings.accessibility.font;
		Array.from(fontSelector.children).forEach(font => {
			font.textContent = locale.settings.accessibility.fonts[font.value];
		});
		customFontLabel.textContent = locale.settings.accessibility.customFont;
		customFontInput.placeholder = locale.settings.accessibility.customFontPlaceholder;

		autoHeading.textContent = locale.settings.auto.title;
		passOnOnlyOptionToggleLabel.textContent = locale.settings.auto.passOnOnlyOption;
		passInDrawPhaseToggleLabel.textContent = locale.settings.auto.passInDrawPhase;
		passInEndPhaseToggleLabel.textContent = locale.settings.auto.passInEndPhase;
		passOnStackTwoToggleLabel.textContent = locale.settings.auto.passOnStackTwo;

		hotkeysHeading.textContent = locale.settings.hotkeys.title;
		hotkeyShowYourDiscardLabel.textContent = locale.settings.hotkeys.showYourDiscardPile;
		hotkeyShowOpponentDiscardLabel.textContent = locale.settings.hotkeys.showOpponentDiscardPile;
		hotkeyShowYourExileLabel.textContent = locale.settings.hotkeys.showYourExileZone;
		hotkeyShowOpponentExileLabel.textContent = locale.settings.hotkeys.showOpponentExileZone;
		hotkeyShowDeckLabel.textContent = locale.settings.hotkeys.searchYourDeck;
		hotkeySelectTokenLabel.textContent = locale.settings.hotkeys.tokenSelector;
		hotkeyShowFieldLabel.textContent = locale.settings.hotkeys.showField;
		hotkeyDestroyTokenLabel.textContent = locale.settings.hotkeys.destroyGrabbedToken;
		hotkeyChatLabel.textContent = locale.settings.hotkeys.writeChatMessage;
		hotkeyDrawCardLabel.textContent = locale.settings.hotkeys.drawCard;
		hotkeyShuffleDeckLabel.textContent = locale.settings.hotkeys.shuffleDeck;
		hotkeyShowDeckTopLabel.textContent = locale.settings.hotkeys.showDeckTop;
		hotkeyPreviewHandLabel.textContent = locale.settings.hotkeys.previewHandCard;
		resetDefaultHotkeys.textContent = locale.settings.hotkeys.resetHotkeys;

		advancedHeading.textContent = locale.settings.advanced.title;
		websocketUrlLabel.textContent = locale.settings.advanced.websocketUrl;
		websocketUrlInput.title = locale.settings.advanced.websocketUrlTitle;
		cardImageUrlLabel.textContent = locale.settings.advanced.cardImageUrl;
		cardImageUrlInput.title = locale.settings.advanced.cardImageUrlTitle;
		cardDataApiUrlLabel.textContent = locale.settings.advanced.cardDataApiUrl;
		cardDataApiUrlInput.title = locale.settings.advanced.cardDataApiUrlTitle;
		devModeToggleLabel.textContent = locale.settings.advanced.devMode;

		relabelAllHotkeys();
		refetchCardData();

		document.documentElement.lang = locale.code;
		document.documentElement.removeAttribute("aria-busy");
	});
}

// load settings
languageSelector.value = localStorage.getItem("language");
partnerChoiceToggle.checked = localStorage.getItem("partnerChoiceToggle") === "true";
closePreviewToggle.checked = localStorage.getItem("autoClosePreview") === "true";
alwaysShowCardButtonsToggle.checked = localStorage.getItem("alwaysShowCardButtons") === "true";

usernameInput.value = localStorage.getItem("username");
customCardBack.value = localStorage.getItem("cardBack");

fieldLabelToggle.checked = localStorage.getItem("fieldLabelToggle") === "true";
cardBackToggle.checked = localStorage.getItem("cardBackToggle") === "true";
fieldLeftToggle.checked = localStorage.getItem("fieldLeftToggle") === "true";
themeSelector.value = localStorage.getItem("theme");
menuCardsToggle.checked = localStorage.getItem("mainMenuCards") === "true";

fontSelector.value = localStorage.getItem("font");
updateCustomFontInputDiv();

passOnOnlyOptionToggle.checked = localStorage.getItem("passOnOnlyOption") === "true";
passInDrawPhaseToggle.checked = localStorage.getItem("passInDrawPhase") === "true";
passInEndPhaseToggle.checked = localStorage.getItem("passInEndPhase") === "true";
passOnStackTwoToggle.checked = localStorage.getItem("passOnStackTwo") === "true";

websocketUrlInput.value = localStorage.getItem("websocketUrl");
cardImageUrlInput.value = localStorage.getItem("cardImageUrl");
cardDataApiUrlInput.value = localStorage.getItem("cardDataApiUrl");

setLanguage(languageSelector.value);
validateHotkeys();

// event listeners
languageSelector.addEventListener("change", function() {
	setLanguage(this.value);
});
partnerChoiceToggle.addEventListener("change", function() {
	localStorage.setItem("partnerChoiceToggle", this.checked);
});
closePreviewToggle.addEventListener("change", function() {
	localStorage.setItem("autoClosePreview", this.checked);
});
alwaysShowCardButtonsToggle.addEventListener("change", function() {
	localStorage.setItem("alwaysShowCardButtons", this.checked);
});

usernameInput.addEventListener("change", function() {
	localStorage.setItem("username", this.value);
});
customCardBack.addEventListener("change", function() {
	localStorage.setItem("cardBack", this.value);
});

fieldLabelToggle.addEventListener("change", function() {
	localStorage.setItem("fieldLabelToggle", this.checked);
});
fieldLeftToggle.addEventListener("change", function() {
	localStorage.setItem("fieldLeftToggle", this.checked);
});
cardBackToggle.addEventListener("change", function() {
	localStorage.setItem("cardBackToggle", this.checked);
});
themeSelector.addEventListener("change", function() {
	applyTheme(this.value);
});
menuCardsToggle.addEventListener("change", function() {
	localStorage.setItem("mainMenuCards", this.checked);
});

fontSelector.addEventListener("change", function() {
	applyFont(this.value);
	updateCustomFontInputDiv();
});
customFontInput.addEventListener("change", function() {
	fonts.custom = this.value;
	applyFont("custom");
	localStorage.setItem("customFont", this.value);
});

passOnOnlyOptionToggle.addEventListener("change", function() {
	localStorage.setItem("passOnOnlyOption", this.checked);
});
passInDrawPhaseToggle.addEventListener("change", function() {
	localStorage.setItem("passInDrawPhase", this.checked);
});
passInEndPhaseToggle.addEventListener("change", function() {
	localStorage.setItem("passInEndPhase", this.checked);
});
passOnStackTwoToggle.addEventListener("change", function() {
	localStorage.setItem("passOnStackTwo", this.checked);
});

websocketUrlInput.addEventListener("change", function() {
	localStorage.setItem("websocketUrl", this.value);
});
cardImageUrlInput.addEventListener("change", function() {
	localStorage.setItem("cardImageUrl", this.value);
});
cardDataApiUrlInput.addEventListener("change", function() {
	localStorage.setItem("cardDataApiUrl", this.value);
});
devModeToggle.addEventListener("change", function() {
	localStorage.setItem("devMode", this.checked);
});

// for hotkeys
resetDefaultHotkeys.addEventListener("click", function() {
	localStorage.setItem("hotkeys", JSON.stringify(hotkeyDefaults));
	relabelAllHotkeys();
	validateHotkeys();
});

let editingHotkey = "";
Array.from(document.querySelectorAll(".keybind")).forEach(button => {
	button.addEventListener("click", function() {
		editingHotkey = button.id;
		button.classList.remove("invalidHotkey");
		button.textContent = locale.settings.hotkeys.pressKey;
	});
});

// sets and saves a hotkey
async function setHotkey(name, newHotkey) {
	let hotkeys = JSON.parse(localStorage.getItem("hotkeys"));
	hotkeys[name] = newHotkey;
	localStorage.setItem("hotkeys", JSON.stringify(hotkeys));
	document.getElementById(editingHotkey).textContent = await hotkeyToString(newHotkey);
}

// actually setting hotkeys
document.addEventListener("keydown", function(e) {
	if (editingHotkey == "") {
		return;
	}
	switch (e.code) {
		case "Escape": {
			setHotkey(
				idToHotkey(editingHotkey),
				{
					"keyCode": "",
					"ctrl": false,
					"shift": false,
					"alt": false
				}
			);
			editingHotkey = "";
			break;
		}
		case "ShiftLeft":
		case "ShiftRight":
		case "ControlLeft":
		case "ControlRight":
		case "AltLeft":
		case "AltRight": {
			document.getElementById(editingHotkey).textContent = (e.ctrlKey? locale.settings.hotkeys.keyCtrl + " + " : "") + (e.shiftKey? locale.settings.hotkeys.keyShift + " + " : "") + (e.altKey? locale.settings.hotkeys.keyAlt + " + " : "");
			return;
		}
		default: {
			setHotkey(
				idToHotkey(editingHotkey),
				{ // Order of properties is important for comparing for equality
					"keyCode": e.code,
					"ctrl": e.ctrlKey,
					"shift": e.shiftKey,
					"alt": e.altKey
				}
			).then(validateHotkeys);

			editingHotkey = "";
			break;
		}
	}
});

document.addEventListener("keyup", function(e) {
	if (editingHotkey == "") {
		return;
	}
	switch (e.code) {
		case "ShiftLeft":
		case "ShiftRight":
		case "ControlLeft":
		case "ControlRight":
		case "AltLeft":
		case "AltRight": {
			document.getElementById(editingHotkey).textContent = (e.ctrlKey? locale.settings.hotkeys.keyCtrl + " + " : "") + (e.shiftKey? locale.settings.hotkeys.keyShift + " + " : "") + (e.altKey? locale.settings.hotkeys.keyAlt + " + " : "");
			if (document.getElementById(editingHotkey).textContent == "") {
				document.getElementById(editingHotkey).textContent = locale.settings.hotkeys.pressKey;
			}
			return;
		}
	}
});