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
	let keyName = locale["settings"]["keys"][hotkey.keyCode];
	if ("keyboard" in navigator) {
		// Keyboard API works on Chrome already, but not in Firefox. :(
		// My own system is used in addition to it since, even on Chrome, the API has far from all the keys.
		keyName = keyName ?? (await navigator.keyboard.getLayoutMap()).get(hotkey.keyCode);
	}
	keyName = keyName ?? "?";
	keyName = keyName[0].toUpperCase() + keyName.substring(1);
	return (hotkey.ctrl? locale["settings"]["keyCtrl"] + " + " : "") + (hotkey.shift? locale["settings"]["keyShift"] + " + " : "") + (hotkey.alt? locale["settings"]["keyAlt"] + " + " : "") + keyName;
}
// colors repeat hotkeys in red
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

// translation
let locale = {};
function setLanguage(language) {
	localStorage.setItem("language", language);
	
	fetch("../data/locales/" + language + ".json")
	.then(response => {
		return response.json()
	})
	.then(jsonData => {
		locale = jsonData;
		
		languageWarnings.innerHTML = "";
		languageSelectorDiv.style.marginBottom = 0;
		if (locale.warnings.length > 0) {
			for (const warning of locale.warnings) {
				let template = document.getElementById(warning == "incomplete"? "langWarningLink" : "langWarning").content.firstElementChild.cloneNode(true);;
				template.querySelector(".warningText").textContent = locale["settings"]["languageWarnings"][warning];
				languageWarnings.appendChild(template);
				languageWarnings.appendChild(document.createElement("br"));
			}
			languageSelectorDiv.style.marginBottom = languageWarnings.clientHeight + 5 + "px";
		}
		
		title.textContent = locale["settings"]["title"];
		
		generalHeading.textContent = locale["settings"]["general"];
		languageSelectorLabel.textContent = locale["settings"]["language"];
		partnerChoiceLabel.textContent = locale["settings"]["partnerChoice"];
		closePreviewToggleLabel.textContent = locale["settings"]["autoClosePreview"];
		
		profileHeading.textContent = locale["settings"]["profile"];
		usernameLabel.textContent = locale["settings"]["username"];
		cardBackLabel.textContent = locale["settings"]["cardBackLink"];
		
		customizationHeading.textContent = locale["settings"]["customization"];
		fieldLabelToggleLabel.textContent = locale["settings"]["fieldLabels"];
		cardBackToggleLabel.textContent = locale["settings"]["disableCardBacks"];
		themeSelectorLabel.textContent = locale["settings"]["theme"];
		Array.from(themeSelector.children).forEach(theme => {
			theme.textContent = locale["settings"]["themes"][theme.value];
		});
		
		hotkeysHeading.textContent = locale["settings"]["hotkeys"];
		hotkeyShowYourDiscardLabel.textContent = locale["settings"]["showYourDiscardPile"];
		hotkeyShowOpponentDiscardLabel.textContent = locale["settings"]["showOpponentDiscardPile"];
		hotkeyShowYourExileLabel.textContent = locale["settings"]["showYourExileZone"];
		hotkeyShowOpponentExileLabel.textContent = locale["settings"]["showOpponentExileZone"];
		hotkeyShowDeckLabel.textContent = locale["settings"]["searchYourDeck"];
		hotkeySelectTokenLabel.textContent = locale["settings"]["tokenSelector"];
		hotkeyShowFieldLabel.textContent = locale["settings"]["showField"];
		hotkeyDestroyTokenLabel.textContent = locale["settings"]["destroyGrabbedToken"];
		hotkeyChatLabel.textContent = locale["settings"]["writeChatMessage"];
		hotkeyDrawCardLabel.textContent = locale["settings"]["drawCard"];
		hotkeyShuffleDeckLabel.textContent = locale["settings"]["shuffleDeck"];
		hotkeyShowDeckTopLabel.textContent = locale["settings"]["showDeckTop"];
		hotkeyPreviewHandLabel.textContent = locale["settings"]["previewHandCard"];
		resetDefaultHotkeys.textContent = locale["settings"]["resetHotkeys"];
		
		relabelAllHotkeys();
	});
}

// load settings
languageSelector.value = localStorage.getItem("language");
partnerChoiceToggle.checked = localStorage.getItem("partnerChoiceToggle") === "true";
closePreviewToggle.checked = localStorage.getItem("autoClosePreview") === "true";

usernameInput.value = localStorage.getItem("username");
customCardBack.value = localStorage.getItem("cardBack");

fieldLabelToggle.checked = localStorage.getItem("fieldLabelToggle") === "true";
cardBackToggle.checked = localStorage.getItem("cardBackToggle") === "true";
fieldLeftToggle.checked = localStorage.getItem("fieldLeftToggle") === "true";
themeSelector.value = localStorage.getItem("theme");

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
		button.textContent = locale["settings"]["pressKey"];
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
			document.getElementById(editingHotkey).textContent = (e.ctrlKey? locale["settings"]["keyCtrl"] + " + " : "") + (e.shiftKey? locale["settings"]["keyShift"] + " + " : "") + (e.altKey? locale["settings"]["keyAlt"] + " + " : "");
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
			document.getElementById(editingHotkey).textContent = (e.ctrlKey? locale["settings"]["keyCtrl"] + " + " : "") + (e.shiftKey? locale["settings"]["keyShift"] + " + " : "") + (e.altKey? locale["settings"]["keyAlt"] + " + " : "");
			if (document.getElementById(editingHotkey).textContent == "") {
				document.getElementById(editingHotkey).textContent = locale["settings"]["pressKey"];
			}
			return;
		}
	}
});