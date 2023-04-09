// general
localStorage.setItem("autoClosePreview", localStorage.getItem("autoClosePreview") ?? "false");
localStorage.setItem("cardBack", localStorage.getItem("cardBack") ?? "");
localStorage.setItem("cardBackToggle", localStorage.getItem("cardBackToggle") ?? false);
localStorage.setItem("customFont", localStorage.getItem("customFont") ?? "");
localStorage.setItem("fieldLabelToggle", localStorage.getItem("fieldLabelToggle") ?? true);
localStorage.setItem("fieldLeftToggle", localStorage.getItem("fieldLeftToggle") ?? false);
localStorage.setItem("language", localStorage.getItem("language") ?? (navigator.language.startsWith("ja")? "ja" : "en"));
localStorage.setItem("partnerChoiceToggle", localStorage.getItem("partnerChoiceToggle") ?? false);
localStorage.setItem("username", localStorage.getItem("username") ?? "");

// themes
var themes = {
	"default": {
		"background": null,
		"backgroundY": "center",
		"fieldDropShadow": false,
		"shadowColor": "#0005",
		"textShadow": "none"
	},
	"worldTree": {
		"background": "https://crossuniverse.jp/wp-content/uploads/2018/08/ホームページ背景2.jpg",
		"backgroundY": "top",
		"fieldDropShadow": true,
		"shadowColor": "rgba(0, 0, 0, 0.7)",
		"textShadow": "2px 2px 2px black"
	},
	"deepSea": {
		"background": "https://crossuniverse.jp/wp-content/uploads/2018/08/6501dd551fcd4880fce262e4993896a8.png",
		"backgroundY": "10%",
		"fieldDropShadow": true,
		"shadowColor": "rgba(0, 0, 0, 0.7)",
		"textShadow": "2px 2px 2px black"
	}
}
function applyTheme(theme) {
	localStorage.setItem("theme", theme);
	document.documentElement.style.setProperty("--theme-background", "url(" + (themes[theme].background != null? '"' + themes[theme].background + '"' : "") + ")");
	document.documentElement.style.setProperty("--theme-background-y", themes[theme].backgroundY);
	document.documentElement.style.setProperty("--theme-field-filter", themes[theme].fieldDropShadow? "drop-shadow(0 0 2vh rgba(0, 0, 0, 0.5))" : "");
	document.documentElement.style.setProperty("--theme-shadow", themes[theme].shadowColor);
	document.documentElement.style.setProperty("--theme-text-shadow", themes[theme].textShadow);
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
