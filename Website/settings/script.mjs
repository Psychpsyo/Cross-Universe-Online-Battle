import {reloadLocale, locale} from "../scripts/locale.mjs";

const profilePictureModule = import("./profilePictureSelector.mjs");
const hotkeyModule = import("./hotkeys.mjs");
hotkeyModule.then(({validateHotkeys}) => validateHotkeys());
async function editHotkey() {
	(await hotkeyModule).editHotkey();
}

const languageNames = {
	en: "🇬🇧 English",
	ja: "🇯🇵 日本語",
	de: "🇩🇪 Deutsch"
};

const settings = {
	general: [
		{
			id: "language",
			type: "language",
			options: ["en", "ja", "de"]
		},
		{
			id: "partnerChoiceToggle",
			type: "toggle"
		},
		{
			id: "autoClosePreview",
			type: "toggle"
		},
		{
			id: "alwaysShowCardButtons",
			type: "toggle"
		},
		{
			id: "loadingScreenHints",
			type: "toggle"
		}
	],
	profile: [
		{
			id: "username",
			type: "text",
			maxLength: 100
		},
		{
			id: "profilePicture",
			type: "profilePicture"
		},
		{
			id: "cardBack",
			type: "text"
		}
	],
	customization: [
		{
			id: "fieldLabelToggle",
			type: "toggle"
		},
		{
			id: "hideOpponentCardBacks",
			type: "toggle"
		},
		{
			id: "opponentCardLanguage",
			type: "toggle"
		},
		{
			id: "previewCardLanguage",
			type: "toggle"
		},
		{
			id: "fieldLeftToggle",
			type: "toggle"
		},
		{
			id: "theme",
			type: "dropdown",
			options: ["default", "light", "worldTree", "deepSea", "hotdog"]
		},
		{
			id: "mainMenuCards",
			type: "toggle"
		}
	],
	accessibility: [
		{
			id: "font",
			type: "dropdown",
			options: ["default", "atkinsonHyperlegible", "openDyslexic", "comicSans", "custom"]
		},
		{
			id: "customFont",
			type: "text"
		}
	],
	hotkeys: [
		{
			id: "showYourDiscard",
			type: "button",
			action: editHotkey
		},
		{
			id: "showOpponentDiscard",
			type: "button",
			action: editHotkey
		},
		{
			id: "showYourExile",
			type: "button",
			action: editHotkey
		},
		{
			id: "showOpponentExile",
			type: "button",
			action: editHotkey
		},
		{
			id: "showDeck",
			type: "button",
			action: editHotkey
		},
		{
			id: "searchDeck",
			type: "button",
			action: editHotkey
		},
		{
			id: "selectToken",
			type: "button",
			action: editHotkey
		},
		{
			id: "showField",
			type: "button",
			action: editHotkey
		},
		{
			id: "destroyToken",
			type: "button",
			action: editHotkey
		},
		{
			id: "chat",
			type: "button",
			action: editHotkey
		},
		{
			id: "drawCard",
			type: "button",
			action: editHotkey
		},
		{
			id: "shuffleDeck",
			type: "button",
			action: editHotkey
		},
		{
			id: "showDeckTop",
			type: "button",
			action: editHotkey
		},
		{
			id: "zoom",
			type: "button",
			action: editHotkey
		},
		{
			id: "previewHand",
			type: "button"
		},
		{
			id: "resetHotkeys",
			type: "centerButton",
			action: async function() {(await hotkeyModule).resetHotkeys()}
		}
	],
	deckMaker: [
		{
			id: "compactMode",
			type: "toggle"
		},
		{
			id: "autoWarning",
			type: "toggle"
		}
	],
	auto: [
		{
			id: "usePrivateInfoForAutopass",
			type: "toggle"
		},
		{
			id: "passInDrawPhase",
			type: "toggle"
		},
		{
			id: "passInEndPhase",
			type: "toggle"
		},
		{
			id: "passInBattlePhase",
			type: "toggle"
		},
		{
			id: "passOnOwnBlocks",
			type: "toggle"
		},
		{
			id: "passOnStackTwo",
			type: "toggle"
		}
	],
	advanced: [
		{
			id: "websocketUrl",
			type: "text"
		},
		{
			id: "lobbyServerUrl",
			type: "text"
		},
		{
			id: "cardImageUrl",
			type: "text"
		},
		{
			id: "cardDataApiUrl",
			type: "text"
		},
		{
			id: "devMode",
			type: "toggle"
		},
		{
			id: "startDebugGame",
			type: "centerButton",
			action: () => {
				import("./debugGame.mjs").then(({startDebugGame}) => startDebugGame());
			},
			isDevOption: true
		}
	]
};

for (const [id, options] of Object.entries(settings)) {
	let section = document.createElement("section");
	section.id = id;
	let title = document.createElement("h2");
	title.id = id + "Title"
	section.setAttribute("aria-labelledBy", title.id);
	let block = document.createElement("div");
	block.id = id + "Block";
	block.classList.add("settingsBlock");
	section.appendChild(title);
	section.appendChild(block);
	sectionHolder.appendChild(section);

	for (const setting of options) {
		let settingElem;
		switch (setting.type) {
			case "toggle": {
				settingElem = newToggle(setting);
				break;
			}
			case "text": {
				settingElem = newTextInput(setting);
				break;
			}
			case "dropdown": {
				settingElem = newDropdown(setting);
				break;
			}
			case "button": {
				settingElem = newButton(setting);
				break;
			}
			case "profilePicture": {
				settingElem = newProfilePictureButton(setting);
				break;
			}
			case "centerButton": {
				settingElem = document.createElement("button");
				settingElem.id = setting.id + "Button";
				if (setting.action) {
					settingElem.addEventListener("click", setting.action);
				}
				break;
			}
			case "language": {
				settingElem = newDropdown(setting);
				settingElem.querySelector("select").addEventListener("change", function() {
					setLanguage(this.value);
				});
				settingElem.id = "languageSelectorDiv";
				const warningDiv = document.createElement("div");
				warningDiv.id = "languageWarnings";
				settingElem.appendChild(warningDiv);
				break;
			}
		}
		if (setting.isDevOption) {
			settingElem.classList.add("devOption");
		}
		block.appendChild(settingElem);
	}
}
if (localStorage.getItem("devMode") !== "true") {
	document.body.classList.add("hideDevOptions")
}
themeSelector.addEventListener("change", function() {
	applyTheme(this.value);
});
fontSelector.parentElement.id = "fontSettingsRow";
customFontInput.parentElement.id = "customFontInputDiv";
fontSelector.addEventListener("change", function() {
	applyFont(this.value);
	updateCustomFontInputDiv();
});
customFontInput.addEventListener("change", function() {
	fonts.custom = this.value;
	applyFont("custom");
});
updateCustomFontInputDiv();
setLanguage(languageSelector.value);

for (const name of Object.keys(JSON.parse(localStorage.getItem("hotkeys")))) {
	document.getElementById(name + "Button").classList.add("keybind");
}
previewHandButton.classList.add("keybind");
previewHandButton.disabled = true;

function updateCustomFontInputDiv() {
	customFontInput.value = localStorage.getItem("customFont");
	customFontInputDiv.style.display = fontSelector.value == "custom"? "block" : "none";
	(fontSelector.value == "custom"? fontSettingsRow : fontSelector).after(customFontInputDiv);
}

async function setLanguage(language) {
	localStorage.setItem("language", language);
	await reloadLocale();
	profilePictureModule.then(({refetchCardData}) => refetchCardData());

	title.textContent = locale.settings.title;
	headerBackButton.title = locale.general.buttonBack;
	headerBackButtonImg.alt = locale.general.buttonBack;

	for (const [id, options] of Object.entries(settings)) {
		document.getElementById(id + "Title").textContent = locale.settings[id].title;
		for (const setting of options) {
			switch (setting.type) {
				case "toggle": {
					document.getElementById(setting.id + "Label").textContent = locale.settings[id][setting.id] ?? "";
					break;
				}
				case "text": {
					document.getElementById(setting.id + "Label").textContent = locale.settings[id][setting.id] ?? "";
					if (locale.settings[id][setting.id + "Placeholder"]) {
						document.getElementById(setting.id + "Input").placeholder = locale.settings[id][setting.id + "Placeholder"];
					}
					if (locale.settings[id][setting.id + "Title"]) {
						document.getElementById(setting.id + "Input").title = locale.settings[id][setting.id + "Title"];
					}
					break;
				}
				case "dropdown": {
					document.getElementById(setting.id + "Label").textContent = locale.settings[id][setting.id] ?? "";
					for (const option of Array.from(document.getElementById(setting.id + "Selector").children)) {
						option.textContent = locale.settings[id][setting.id + "Options"][option.value];
					}
					break;
				}
				case "button": {
					if (document.getElementById(setting.id + "Label")) {
						document.getElementById(setting.id + "Label").textContent = locale.settings[id][setting.id] ?? "";
					}
					document.getElementById(setting.id + "Button").textContent = locale.settings[id][setting.id + "Button"] ?? "";
					break;
				}
				case "profilePicture": {
					if (document.getElementById(setting.id + "Label")) {
						document.getElementById(setting.id + "Label").textContent = locale.settings[id][setting.id] ?? "";
					}
					document.getElementById(setting.id + "Button").style.setProperty("--change-label", "'" + locale.settings[id][setting.id + "Button"] + "'");
					break;
				}
				case "centerButton": {
					document.getElementById(setting.id + "Button").textContent = locale.settings[id][setting.id] ?? "";
					break;
				}
				case "language": {
					document.getElementById(setting.id + "Label").textContent = locale.settings[id][setting.id] ?? "";
					for (const option of Array.from(document.getElementById(setting.id + "Selector").children)) {
						option.textContent = languageNames[option.value];
					}
					break;
				}
			}
		}
	}

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

	profilePictureDialogHeader.textContent = locale.settings.profile.profilePictureMenu.header;
	profilePicturesCategorizedBtn.textContent = locale.settings.profile.profilePictureMenu.categoriesTab;
	profilePicturesAllBtn.textContent = locale.settings.profile.profilePictureMenu.allCardsTab;
	profilePictureCloseBtn.textContent = locale.settings.profile.profilePictureMenu.close;
	for (const categoryHeading of Array.from(document.querySelectorAll(".profilePictureCategoryName"))) {
		categoryHeading.textContent = locale.settings.profile.profilePictureMenu.categories[categoryHeading.dataset.category];
	}

	hotkeyModule.then(({relabelAllHotkeys}) => relabelAllHotkeys());

	websocketUrlInput.placeholder = "wss://battle.crossuniverse.net:443/ws/";
	lobbyServerUrlInput.placeholder = "wss://battle.crossuniverse.net:443/lobbies/";
	cardImageUrlInput.placeholder = "https://crossuniverse.net/images/cards/";
	cardDataApiUrlInput.placeholder = "https://crossuniverse.net/cardInfo/";

	document.documentElement.lang = locale.code;
	document.documentElement.removeAttribute("aria-busy");
}

function newToggle(setting) {
	let holder = document.createElement("div");
	let input = document.createElement("input");
	input.type = "checkbox";
	input.id = setting.id + "Box";
	input.checked = localStorage.getItem(setting.id) === "true";
	input.addEventListener("change", function() {
		localStorage.setItem(setting.id, this.checked);
		if (setting.id === "devMode") {
			document.body.classList.toggle("hideDevOptions");
		}
	});
	let label = document.createElement("label");
	label.id = setting.id + "Label";
	label.htmlFor = input.id;
	holder.appendChild(input);
	holder.appendChild(document.createTextNode(" "));
	holder.appendChild(label);
	return holder;
}

function newTextInput(setting) {
	const holder = document.createElement("div");
	const input = document.createElement("input");
	input.type = "text";
	input.id = setting.id + "Input";
	input.value = localStorage.getItem(setting.id);
	if (setting.maxLength) {
		input.maxLength = setting.maxLength;
	}
	input.addEventListener("change", function() {
		localStorage.setItem(setting.id, this.value);
	});
	const label = document.createElement("label");
	label.id = setting.id + "Label";
	label.htmlFor = input.id;
	holder.appendChild(label);
	holder.appendChild(input);
	return holder;
}

function newDropdown(setting) {
	let holder = document.createElement("div");
	let select = document.createElement("select");
	select.id = setting.id + "Selector";
	for (const elem of setting.options) {
		let option = document.createElement("option");
		option.value = elem;
		select.appendChild(option);
	}
	select.value = localStorage.getItem(setting.id);
	let label = document.createElement("label");
	label.id = setting.id + "Label";
	label.htmlFor = select.id;
	holder.appendChild(label);
	holder.appendChild(select);
	return holder;
}

function newButton(setting) {
	let holder = document.createElement("div");
	let button = document.createElement("button");
	button.id = setting.id + "Button";
	button.classList.add("settingsInput");
	if (setting.action) {
		button.addEventListener("click", setting.action);
	}
	let label = document.createElement("label");
	label.id = setting.id + "Label";
	label.htmlFor = button.id;
	holder.appendChild(label);
	holder.appendChild(button);
	return holder;
}

function newProfilePictureButton(setting) {
	let holder = document.createElement("div");
	let button = document.createElement("button");
	button.id = setting.id + "Button";
	button.classList.add("settingsInput");
	button.classList.add("profilePictureBtn");
	button.addEventListener("click", () => profilePictureDialog.showModal());
	let img = document.createElement("img");
	img.id = "profilePictureImage";
	button.appendChild(img);
	let label = document.createElement("label");
	label.id = setting.id + "Label";
	label.htmlFor = button.id;
	holder.appendChild(label);
	holder.appendChild(button);
	return holder;
}