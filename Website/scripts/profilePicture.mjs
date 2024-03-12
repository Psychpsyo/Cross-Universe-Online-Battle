import {getCardImageFromID} from "./cardLoader.mjs";

export const cardAlignmentInfo = await fetch("./data/profilePictureInfo.json").then(async response => await response.json());

class ProfilePicture extends HTMLElement {
	constructor() {
		super();
	}

	setIcon(cardId, flip = null) {
		this.style.backgroundImage = "url('" + getCardImageFromID(cardId) + "')";
		if (cardAlignmentInfo[cardId]?.left) {
			this.style.backgroundPositionX = cardAlignmentInfo[cardId].left + "%";
		}

		if (flip !== null) {
			if ((flip && (!cardAlignmentInfo[cardId]?.flip && !cardAlignmentInfo[cardId]?.neverFlip)) ||
				(!flip && cardAlignmentInfo[cardId]?.flip)) {
				this.style.transform = "scaleX(-1)";
			}
		}
	}
}
customElements.define("profile-picture", ProfilePicture);