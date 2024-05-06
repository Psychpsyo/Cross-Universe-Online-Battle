// general
localStorage.setItem("alwaysShowCardButtons", localStorage.getItem("alwaysShowCardButtons") ?? true);
localStorage.setItem("autoClosePreview", localStorage.getItem("autoClosePreview") ?? false);
localStorage.setItem("autoWarning", localStorage.getItem("autoWarning") ?? true);
localStorage.setItem("cardBack", localStorage.getItem("cardBack") ?? "");
localStorage.setItem("hideOpponentCardBacks", localStorage.getItem("hideOpponentCardBacks") ?? true);
localStorage.setItem("cardDataApiUrl", localStorage.getItem("cardDataApiUrl") ?? "");
localStorage.setItem("cardImageUrl", localStorage.getItem("cardImageUrl") ?? "");
localStorage.setItem("compactMode", localStorage.getItem("compactMode") ?? false);
localStorage.setItem("customCards", localStorage.getItem("customCards") ?? "[]");
localStorage.setItem("customFont", localStorage.getItem("customFont") ?? "");
localStorage.setItem("devMode", localStorage.getItem("devMode") ?? false);
localStorage.setItem("fieldLabelToggle", localStorage.getItem("fieldLabelToggle") ?? true);
localStorage.setItem("fieldLeftToggle", localStorage.getItem("fieldLeftToggle") ?? false);
localStorage.setItem("language", localStorage.getItem("language") ?? (navigator.language.startsWith("ja")? "ja" : "en"));
localStorage.setItem("loadingScreenHints", localStorage.getItem("loadingScreenHints") ?? true);
localStorage.setItem("lobbyServerUrl", localStorage.getItem("lobbyServerUrl") ?? "");
localStorage.setItem("mainMenuCards", localStorage.getItem("mainMenuCards") ?? true);
localStorage.setItem("opponentCardLanguage", localStorage.getItem("opponentCardLanguage") ?? true);
localStorage.setItem("partnerChoiceToggle", localStorage.getItem("partnerChoiceToggle") ?? false);
localStorage.setItem("passInBattlePhase", localStorage.getItem("passInBattlePhase") ?? true);
localStorage.setItem("passInDrawPhase", localStorage.getItem("passInDrawPhase") ?? true);
localStorage.setItem("passInEndPhase", localStorage.getItem("passInEndPhase") ?? true);
localStorage.setItem("passOnOwnBlocks", localStorage.getItem("passOnOwnBlocks") ?? true);
localStorage.setItem("passOnStackTwo", localStorage.getItem("passOnStackTwo") ?? true);
localStorage.setItem("previewCardLanguage", localStorage.getItem("previewCardLanguage") ?? false);
localStorage.setItem("profilePicture", localStorage.getItem("profilePicture") ?? ["U00004", "U00009", "U00031", "U00039", "U00047", "U00049", "U00053", "U00105", "U00121", "U00194", "U00212"][Math.floor(Math.random() * 8)]);
localStorage.setItem("usePrivateInfoForAutopass", localStorage.getItem("usePrivateInfoForAutopass") ?? true);
localStorage.setItem("username", localStorage.getItem("username") ?? "");
localStorage.setItem("websocketUrl", localStorage.getItem("websocketUrl") ?? "");

// themes
var themes = {
	"default": {
		"backgroundColor": "#333",
		"background": null,
		"backgroundY": "center",
		"fieldDropShadow": false,
		"shadowColor": "#0005",
		"shadowBlur": "0",
		"dialogBackground": "#000c",
		"textShadow": "none",
		"textColor": "#eee",
		"disabledTextColor": "#eee8",
		"disabledBackgroundColor": "#222",
		"borderColor": "#eee",
		"buttonHoverColor": "#fff3"
	},
	"worldTree": {
		"backgroundColor": "black",
		"background": "https://crossuniverse.net/images/background.jpg",
		"backgroundY": "top",
		"fieldDropShadow": true,
		"shadowColor": "rgba(0, 0, 0, 0.7)",
		"shadowBlur": "2px",
		"dialogBackground": "#000c",
		"textShadow": "0 0 .2em black, 0 0 .2em black, .07em .07em .13em black, .07em .07em .13em black",
		"textColor": "#eee",
		"disabledTextColor": "#eee8",
		"disabledBackgroundColor": "#222",
		"borderColor": "#eee",
		"buttonHoverColor": "#fff3"
	},
	"deepSea": {
		"backgroundColor": "black",
		"background": "https://crossuniverse.net/images/backgroundDark.jpg",
		"backgroundY": "10%",
		"fieldDropShadow": true,
		"shadowColor": "rgba(0, 0, 0, 0.7)",
		"shadowBlur": "2px",
		"dialogBackground": "#000c",
		"textShadow": "0 0 .2em black, 0 0 .2em black, .07em .07em .13em black, .07em .07em .13em black",
		"textColor": "#eee",
		"disabledTextColor": "#eee8",
		"disabledBackgroundColor": "#222",
		"borderColor": "#eee",
		"buttonHoverColor": "#fff3"
	},
	"light": {
		"backgroundColor": "white",
		"background": null,
		"backgroundY": "center",
		"fieldDropShadow": false,
		"shadowColor": "#0002",
		"shadowBlur": "0",
		"dialogBackground": "white",
		"textShadow": "none",
		"textColor": "#000",
		"disabledTextColor": "#0008",
		"disabledBackgroundColor": "#ccc",
		"borderColor": "#888",
		"buttonHoverColor": "#00f3"
	}
}
function applyTheme(theme) {
	localStorage.setItem("theme", theme);
	document.documentElement.style.setProperty("--theme-background-color", themes[theme].backgroundColor);
	document.documentElement.style.setProperty("--theme-background", "url(" + (themes[theme].background != null? '"' + themes[theme].background + '"' : "") + ")");
	document.documentElement.style.setProperty("--theme-background-y", themes[theme].backgroundY);
	document.documentElement.style.setProperty("--theme-field-filter", themes[theme].fieldDropShadow? "drop-shadow(0 0 2vh rgba(0, 0, 0, 0.5))" : "");
	document.documentElement.style.setProperty("--theme-shadow", themes[theme].shadowColor);
	document.documentElement.style.setProperty("--theme-shadow-blur", themes[theme].shadowBlur);
	document.documentElement.style.setProperty("--theme-dialog-background-color", themes[theme].dialogBackground);
	document.documentElement.style.setProperty("--theme-text-shadow", themes[theme].textShadow);
	document.documentElement.style.setProperty("--theme-text-color", themes[theme].textColor);
	document.documentElement.style.setProperty("--theme-disabled-text-color", themes[theme].disabledTextColor);
	document.documentElement.style.setProperty("--theme-disabled-background-color", themes[theme].disabledBackgroundColor);
	document.documentElement.style.setProperty("--theme-border-color", themes[theme].borderColor);
	document.documentElement.style.setProperty("--theme-button-hover-color", themes[theme].buttonHoverColor);
}
applyTheme(localStorage.getItem("theme") ?? "worldTree");

// accessibility
var fonts = {
	"default": "游ゴシック",
	"atkinsonHyperlegible": "Atkinson Hyperlegible",
	"openDyslexic": "OpenDyslexic",
	"comicSans": "Comic Sans MS",
	"custom": localStorage.getItem("customFont")
}
function applyFont(font) {
	localStorage.setItem("font", font);
	document.documentElement.style.setProperty("--custom-font", fonts[font]);
}
applyFont(localStorage.getItem("font") ?? "default");

// hotkeys
let hotkeyDefaults = {
	"showYourDiscard": {
		"keyCode": "KeyD",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"showOpponentDiscard": {
		"keyCode": "KeyD",
		"ctrl": false,
		"shift": true,
		"alt": false
	},
	"showYourExile": {
		"keyCode": "KeyE",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"showOpponentExile": {
		"keyCode": "KeyE",
		"ctrl": false,
		"shift": true,
		"alt": false
	},
	"showDeck": {
		"keyCode": "KeyS",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"searchDeck": {
		"keyCode": "KeyS",
		"ctrl": false,
		"shift": true,
		"alt": false
	},
	"selectToken": {
		"keyCode": "KeyT",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"showField": {
		"keyCode": "KeyF",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"destroyToken": {
		"keyCode": "KeyX",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"chat": {
		"keyCode": "KeyC",
		"ctrl": false,
		"shift": false,
		"alt": false
	},
	"drawCard": {
		"keyCode": "KeyA",
		"ctrl": false,
		"shift": true,
		"alt": false
	},
	"shuffleDeck": {
		"keyCode": "KeyS",
		"ctrl": true,
		"shift": true,
		"alt": false
	},
	"showDeckTop": {
		"keyCode": "KeyV",
		"ctrl": false,
		"shift": true,
		"alt": false
	}
}

// if hotkeys exists already, there might be new ones that need to be added
if (localStorage.getItem("hotkeys")) {
	hotkeys = JSON.parse(localStorage.getItem("hotkeys"));
	for (const [name, hotkey] of Object.entries(hotkeyDefaults)) {
		if (!(name in hotkeys)) {
			hotkeys[name] = hotkey;
		}
	}
	localStorage.setItem("hotkeys", JSON.stringify(hotkeys));
} else {
	localStorage.setItem("hotkeys", JSON.stringify(hotkeyDefaults));
}

//position the menu on the right if that option is enabled
if (localStorage.getItem("fieldLeftToggle") == "true") {
	document.documentElement.classList.add("leftField");
}