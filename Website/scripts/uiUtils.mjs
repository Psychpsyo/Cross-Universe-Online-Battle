import {locale} from "/scripts/locale.mjs";

// copy buttons (they show "Copied!" after being clicked)
function showCopied() {
	this.textContent = locale.general.buttonCopied;
}
function resetButton() {
	setTimeout(function() {
		if (typeof this !== "undefined" && !this.matches(":hover")) {
			this.textContent = this.dataset.originalText;
		}
	}.bind(this), 500);
}

export function makeCopyButton(button, originalText) {
	button.addEventListener("mouseleave", resetButton);
	button.addEventListener("blur", resetButton);
	button.addEventListener("click", showCopied);
	button.dataset.originalText = originalText;
}