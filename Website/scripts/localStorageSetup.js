localStorage.setItem("autoClosePreview", localStorage.getItem("autoClosePreview") ?? "false");
localStorage.setItem("cardBack", localStorage.getItem("cardBack") ?? "");
localStorage.setItem("cardBackToggle", localStorage.getItem("cardBackToggle") ?? false);
localStorage.setItem("fieldLabelToggle", localStorage.getItem("fieldLabelToggle") ?? true);
localStorage.setItem("language", localStorage.getItem("language") ?? (navigator.language.startsWith("ja")? "ja" : "en"));
localStorage.setItem("partnerChoiceToggle", localStorage.getItem("partnerChoiceToggle") ?? false);
localStorage.setItem("username", localStorage.getItem("username") ?? "");


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
