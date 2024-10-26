// This file contains localeInfos to extend objects in the rules engine with.
import localize from "./locale.mjs"
import {perspectives} from "./localeConstants.mjs";

export function extendGame(game) {
	for (const player of game.players) {
		player.localeInfo = playerExtension;
		player.deckZone.localeInfo = zoneExtension;
		player.handZone.localeInfo = zoneExtension;
		player.unitZone.localeInfo = zoneExtension;
		player.spellItemZone.localeInfo = zoneExtension;
		player.partnerZone.localeInfo = zoneExtension;
		player.discardPile.localeInfo = zoneExtension;
		player.exileZone.localeInfo = zoneExtension;
	}
}

function playerExtension() {
	if (!localPlayer) {
		return {
			text: playerData[this.index].name,
			amount: 1,
			perspective: perspectives.THIRD_PERSON,
			isProperName: true
		};
	}
	const isYou = this === localPlayer;
	return {
		text: localize(`game.players.${isYou? "you" : "opponent"}`),
		amount: 1,
		perspective: perspectives[isYou? "SECOND_PERSON" : "THIRD_PERSON"],
		isProperName: false
	};
}

export function zoneExtension() {
	const isYou = this === localPlayer;
	return {
		text: localize(`game.zones.${this.type}`, this.player),
		amount: 1,
		perspective: perspectives[isYou? "SECOND_PERSON" : "THIRD_PERSON"],
		isProperName: !localPlayer
	};
}