window.addEventListener("pageshow", () => {
	let navEvents = performance.getEntriesByType("navigation");
	if (navEvents[navEvents.length - 1].type === "back_forward") {
		location.reload();
	}
});