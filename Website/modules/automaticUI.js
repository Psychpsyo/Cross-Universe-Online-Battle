// this file holds all the code needed for UI that is required during automatic games.

export function init() {
	Array.from(document.querySelectorAll(".manualOnly")).forEach(elem => elem.remove());
}