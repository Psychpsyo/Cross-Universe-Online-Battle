// ensures that settings get reloaded and all that
window.addEventListener("pageshow", () => {
	let navEvents = performance.getEntriesByType("navigation");
	if (navEvents.at(-1).type === "back_forward") {
		location.reload();
	}
});