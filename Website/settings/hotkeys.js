import {locale} from "/modules/locale.js";

// currently edited hotkey
let editingHotkey = "";

// Exports
export function editHotkey() {
	editingHotkey = this.id.substring(0, this.id.length - 6);
	this.classList.remove("invalidHotkey");
	this.textContent = locale.settings.hotkeys.pressKey;
}

export function resetHotkeys() {
	localStorage.setItem("hotkeys", JSON.stringify(hotkeyDefaults));
	relabelAllHotkeys();
	validateHotkeys();
}

// coloring repeat hotkeys in red
export function validateHotkeys() {
	let seenHotkeys = [];
	for (const [name, hotkey] of Object.entries(JSON.parse(localStorage.getItem("hotkeys")))) {
		if (hotkey.keyCode === "") {
			continue;
		}
		document.getElementById(name + "Button").classList.remove("invalidHotkey");
		// check for an unmodified number row hotkey
		if (hotkey.keyCode.startsWith("Digit") && !hotkey.ctrl && !hotkey.shift && !hotkey.alt) {
			document.getElementById(name + "Button").classList.add("invalidHotkey");
			break;
		}
		let stringHotkey = JSON.stringify(hotkey);
		for (const seenHotkey of seenHotkeys) {
			if (stringHotkey === seenHotkey) {
				document.getElementById(name + "Button").classList.add("invalidHotkey");
				break;
			}
		}
		seenHotkeys.push(stringHotkey);
	}
}

export async function relabelAllHotkeys() {
	for (const [name, hotkey] of Object.entries(JSON.parse(localStorage.getItem("hotkeys")))) {
		document.getElementById(name + "Button").textContent = await hotkeyToString(hotkey);
	}
}


// converts a hotkey object to that hotkey's on-button string representation
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

// sets and saves a hotkey
async function setHotkey(name, newHotkey) {
	let hotkeys = JSON.parse(localStorage.getItem("hotkeys"));
	hotkeys[name] = newHotkey;
	localStorage.setItem("hotkeys", JSON.stringify(hotkeys));
	document.getElementById(editingHotkey + "Button").textContent = await hotkeyToString(newHotkey);
}


// actually setting hotkeys
document.addEventListener("keydown", function(e) {
	if (editingHotkey == "") {
		return;
	}
	switch (e.code) {
		case "Escape": {
			setHotkey(
				editingHotkey,
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
			document.getElementById(editingHotkey + "Button").textContent = (e.ctrlKey? locale.settings.hotkeys.keyCtrl + " + " : "") + (e.shiftKey? locale.settings.hotkeys.keyShift + " + " : "") + (e.altKey? locale.settings.hotkeys.keyAlt + " + " : "");
			return;
		}
		default: {
			setHotkey(
				editingHotkey,
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
			document.getElementById(editingHotkey + "Button").textContent = (e.ctrlKey? locale.settings.hotkeys.keyCtrl + " + " : "") + (e.shiftKey? locale.settings.hotkeys.keyShift + " + " : "") + (e.altKey? locale.settings.hotkeys.keyAlt + " + " : "");
			if (document.getElementById(editingHotkey + "Button").textContent == "") {
				document.getElementById(editingHotkey + "Button").textContent = locale.settings.hotkeys.pressKey;
			}
			return;
		}
	}
});