// This file defines the chat-box custom element
import {deckToCardIdList, decodeDeckCode} from "./deckUtils.mjs";
import {locale} from "./locale.mjs";
import localize from "./locale.mjs";
import * as cardLoader from "./cardLoader.mjs"

class ChatIntegration {
	constructor() {}

	// checks if a message is an eligible integration and, if so, returns the extraContent to be included.
	integrateMessage(message) {
		return null;
	}
}
class ImageIntegration extends ChatIntegration {
	constructor(name, regex) {
		super();
		this.name = name;
		this.regex = regex;
	}

	integrateMessage(message) {
		const match = message.match(this.regex);
		if (!match) return null;

		const image = document.createElement("img");
		image.alt = localize("chat.externalImage", this.name);
		image.classList.add("chatImage");
		image.src = message;
		return image;
	}
}
class DeckIntegration extends ChatIntegration {
	constructor() {
		super();
	}

	integrateMessage(message) {
		if (!message.startsWith("deck:")) return null;

		const deck = decodeDeckCode(message.substring(5).trim());
		// if this does not parse as a valid deck, do not integrate anything
		if (!deck) return null;

		const deckElement = document.createElement("div");
		deckElement.classList = "chatDeck";
		for (const cardId of deckToCardIdList(deck)) {
			const img = document.createElement("img");
			img.src = cardLoader.getCardImageFromID(cardId, "tiny");
			img.alt = "";
			deckElement.appendChild(img);
		}
		deckElement.addEventListener("click", () => {
			deckSelector.openForDeck(deck, {allowDownload: true});
		})
		return deckElement;
	}
}

const chatIntegrations = [
	new ImageIntegration("Tenor", new RegExp("^https://media\.tenor\.com\/.+$", "i")),
	new ImageIntegration("Discord", new RegExp("^https://cdn.discordapp.com/attachments/.+\.(avif|gif|jpg|jpeg|png|webm).+$", "i")),
	new ImageIntegration("Imgur", new RegExp("^https://i\.imgur\.com/.+$", "i")),
	new DeckIntegration()
];

const allEmoji = ["card", "haniwa", "candle", "dice", "medusa", "barrier", "contract", "rei", "trooper", "gogo", "gogo_mad", "wingL", "wingR", "knight"];
class ChatBox extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		const header = document.createElement("header");
		this.messageArea = document.createElement("div");
		this.messageArea.classList.add("chatMessageArea");
		this.infoBar = document.createElement("div");
		this.infoBar.classList.add("chatInfoBar");
		this.inputField = document.createElement("input");

		header.textContent = locale.chat.title;
		this.inputField.placeholder = locale.chat.enterMessage;

		this.inputField.maxLength = 10_000;
		this.inputField.addEventListener("keydown", e => e.stopPropagation());
		this.inputField.addEventListener("keyup", function(e) {
			if (e.code == "Enter" && this.value != "") {
				if (this.parentElement.dispatchEvent(new MessageEvent("message", {data: this.value}))) {
					this.value = "";
				}
			}
			if (e.code == "Escape") {
				this.blur();
			}
		});
		this.inputField.addEventListener("paste", function(e) {
			const pasted = e.clipboardData.getData("text").trim();
			const deck = decodeDeckCode(pasted);
			if (deck && (this.value.trim() === "" || (this.selectionStart === 0 && this.selectionEnd === this.value.length))) {
				e.preventDefault();
				this.value = `deck:${pasted}`;
			}
		});

		this.appendChild(header);
		this.appendChild(this.messageArea);
		this.messageArea.appendChild(this.infoBar);
		this.appendChild(this.inputField);
	}

	// Displays a message in chat. extraContent is an html element to be included in the message.
	// type can be undefined or either "notice", "warning", "error" or "success"
	putMessage(message, type, extraContent) {
		const messageDiv = document.createElement("div");
		messageDiv.classList.add("msg");

		while (message.indexOf(":") != -1) {
			if (message.indexOf(":", message.indexOf(":") + 1) == -1) {
				break;
			}
			let foundEmoji = message.substring(message.indexOf(":") + 1, message.indexOf(":", message.indexOf(":") + 1));
			if (allEmoji.includes(foundEmoji)) {
				messageDiv.appendChild(document.createTextNode(message.substring(0, message.indexOf(":"))));
				let emojiImg = document.createElement("img");
				emojiImg.src = "images/emoji/" + foundEmoji + ".png";
				emojiImg.classList.add("emoji");
				emojiImg.alt = ":" + foundEmoji + ":";
				emojiImg.title = ":" + foundEmoji + ":";
				emojiImg.draggable = false;
				messageDiv.appendChild(emojiImg);
				message = message.substring(message.indexOf(":", message.indexOf(":") + 1) + 1);
			} else {
				messageDiv.appendChild(document.createTextNode(message.substring(0, message.indexOf(":", message.indexOf(":") + 1))));
				message = message.substring(message.indexOf(":", message.indexOf(":") + 1));
			}
		}
		messageDiv.appendChild(document.createTextNode(message));

		if (extraContent) {
			// Always insert a <br> in case extraContent is an inline element.
			// An example of this is images appended to chat messages.
			messageDiv.appendChild(document.createElement("br"));
			messageDiv.appendChild(extraContent);
		}

		if (type) {
			messageDiv.classList.add(type);
		}
		this.messageArea.appendChild(messageDiv);
		this.messageArea.scrollTop = this.messageArea.scrollHeight - this.messageArea.clientHeight;
	}

	putPlayerMessage(username, message) {
		message = message.substring(0, 10_000);
		let extraContent;

		for (const integration of chatIntegrations) {
			extraContent = integration.integrateMessage(message);
			if (extraContent) {
				message = "";
				break;
			};
		}

		this.putMessage(`${username}${localize("chat.colon")}${message}`, undefined, extraContent);
	}

	// empties the chat
	clear() {
		this.messageArea.textContent = "";
		this.messageArea.appendChild(this.infoBar);
	}
}
customElements.define("chat-box", ChatBox);