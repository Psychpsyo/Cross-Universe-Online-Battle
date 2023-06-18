// general
localStorage.setItem("alwaysShowCardButtons", localStorage.getItem("alwaysShowCardButtons") ?? true);
localStorage.setItem("autoClosePreview", localStorage.getItem("autoClosePreview") ?? false);
localStorage.setItem("cardBack", localStorage.getItem("cardBack") ?? "");
localStorage.setItem("cardBackToggle", localStorage.getItem("cardBackToggle") ?? false);
localStorage.setItem("customCards", localStorage.getItem("customCards") ?? "[]");
localStorage.setItem("customFont", localStorage.getItem("customFont") ?? "");
localStorage.setItem("fieldLabelToggle", localStorage.getItem("fieldLabelToggle") ?? true);
localStorage.setItem("fieldLeftToggle", localStorage.getItem("fieldLeftToggle") ?? false);
localStorage.setItem("language", localStorage.getItem("language") ?? (navigator.language.startsWith("ja")? "ja" : "en"));
localStorage.setItem("mainMenuCards", localStorage.getItem("mainMenuCards") ?? true);
localStorage.setItem("partnerChoiceToggle", localStorage.getItem("partnerChoiceToggle") ?? false);
localStorage.setItem("passInDrawPhase", localStorage.getItem("passInDrawPhase") ?? true);
localStorage.setItem("passInEndPhase", localStorage.getItem("passInEndPhase") ?? true);
localStorage.setItem("passOnStackTwo", localStorage.getItem("passOnStackTwo") ?? true);
localStorage.setItem("passOnOnlyOption", localStorage.getItem("passOnOnlyOption") ?? true);
localStorage.setItem("username", localStorage.getItem("username") ?? "");

// themes
var themes = {
	"default": {
		"backgroundColor": "#333",
		"background": null,
		"backgroundY": "center",
		"fieldDropShadow": false,
		"shadowColor": "#0005",
		"dialogBackground": "#000c",
		"textShadow": "none",
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
		"dialogBackground": "white",
		"textShadow": "none",
		"textColor": "#000",
		"disabledTextColor": "#0008",
		"disabledBackgroundColor": "#ccc",
		"borderColor": "#888",
		"buttonHoverColor": "#00f3"
	},
	"worldTree": {
		"backgroundColor": "black",
		"background": "https://crossuniverse.jp/wp-content/uploads/2018/08/ホームページ背景2.jpg",
		"backgroundY": "top",
		"fieldDropShadow": true,
		"shadowColor": "rgba(0, 0, 0, 0.7)",
		"dialogBackground": "#000c",
		"textShadow": "2px 2px 2px black",
		"textColor": "#eee",
		"disabledTextColor": "#eee8",
		"disabledBackgroundColor": "#222",
		"borderColor": "#eee",
		"buttonHoverColor": "#fff3"
	},
	"deepSea": {
		"backgroundColor": "black",
		"background": "https://crossuniverse.jp/wp-content/uploads/2018/08/6501dd551fcd4880fce262e4993896a8.png",
		"backgroundY": "10%",
		"fieldDropShadow": true,
		"shadowColor": "rgba(0, 0, 0, 0.7)",
		"dialogBackground": "#000c",
		"textShadow": "2px 2px 2px black",
		"textColor": "#eee",
		"disabledTextColor": "#eee8",
		"disabledBackgroundColor": "#222",
		"borderColor": "#eee",
		"buttonHoverColor": "#fff3"
	}
}
function applyTheme(theme) {
	localStorage.setItem("theme", theme);
	document.documentElement.style.setProperty("--theme-background-color", themes[theme].backgroundColor);
	document.documentElement.style.setProperty("--theme-background", "url(" + (themes[theme].background != null? '"' + themes[theme].background + '"' : "") + ")");
	document.documentElement.style.setProperty("--theme-background-y", themes[theme].backgroundY);
	document.documentElement.style.setProperty("--theme-field-filter", themes[theme].fieldDropShadow? "drop-shadow(0 0 2vh rgba(0, 0, 0, 0.5))" : "");
	document.documentElement.style.setProperty("--theme-shadow", themes[theme].shadowColor);
	document.documentElement.style.setProperty("--theme-dialog-background-color", themes[theme].dialogBackground);
	document.documentElement.style.setProperty("--theme-text-shadow", themes[theme].textShadow);
	document.documentElement.style.setProperty("--theme-text-color", themes[theme].textColor);
	document.documentElement.style.setProperty("--theme-disabled-text-color", themes[theme].disabledTextColor);
	document.documentElement.style.setProperty("--theme-disabled-background-color", themes[theme].disabledBackgroundColor);
	document.documentElement.style.setProperty("--theme-border-color", themes[theme].borderColor);
	document.documentElement.style.setProperty("--theme-button-hover-color", themes[theme].buttonHoverColor);
}
applyTheme(localStorage.getItem("theme") ?? "default");

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
		"ctrl": false,
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
