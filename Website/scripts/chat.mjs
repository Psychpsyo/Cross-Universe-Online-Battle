// This file defines the chat-box custom element
import {locale} from "./locale.mjs";

const allEmoji = ["card", "haniwa", "candle", "dice", "medusa", "barrier", "contract", "rei", "trooper", "gogo", "gogo_mad", "wingL", "wingR", "knight"];
class ChatBox extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		const header = document.createElement("header");
		this.messageArea = document.createElement("div");
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

		this.appendChild(header);
		this.appendChild(this.messageArea);
		this.appendChild(this.inputField);
	}

	// displays a message in chat. extraContent is an html element to be included in the message
	// type can be undefined or either "notice", "warning", "error" or "success"
	putMessage(message, type, extraContent) {
		const messageDiv = document.createElement("div");

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

		if (extraContent) messageDiv.appendChild(extraContent);

		if (type) {
			messageDiv.classList.add(type);
		}
		this.messageArea.appendChild(messageDiv);
		this.messageArea.scrollTop = this.messageArea.scrollHeight - this.messageArea.clientHeight;
	}

	// empties the chat
	clear() {
		this.messageArea.textContent = "";
	}
}
customElements.define("chat-box", ChatBox);