import * as gameUI from "./gameUI.mjs";
import * as generalUI from "./generalUI.mjs";
import * as cardLoader from "../../scripts/cardLoader.mjs";
import * as localeExtensions from "../../scripts/localeExtensions.mjs";
import localize from "../../scripts/locale.mjs";
import {Game} from "../../rulesEngine/src/game.mjs";
import {GameState} from "./gameState.mjs";
import {BoardState} from "./boardState.mjs";
import {SpectateRandom} from "./spectateRandom.mjs";
import {callSpectatee, parseNetZone} from "./netcode.mjs";
import {Card} from "../../rulesEngine/src/card.mjs";
import { getCounterSlotIndex } from "./manualUI.mjs";

export class SpectateInitState extends GameState {
	#queuedUpMessages = []; // messages that will need to be re-dispatched to the next state once it's started
	#isQueueingMessages = false;
	constructor() {
		super();

		game = new Game();
		localeExtensions.extendGame(game);
		game.rng = new SpectateRandom();

		callSpectatee();
	}

	receiveMessage(command, message, player) {
		switch (command) {
			case "playerData": {
				for (const [i, pd] of Object.entries(JSON.parse(message))) {
					playerData[i].name = pd.name;
					playerData[i].profilePicture = pd.profilePicture;
					playerData[i].deck = pd.deck;
					playerData[i].language = pd.language;
				}
				generalUI.init();
				gameUI.showBlackoutMessage(localize("game.spectation.waitingForGameToStart"));
				gameDiv.hidden = false;
				mainGameArea.hidden = false;
				gameUI.init();

				callingWindow.postMessage({type: "gameStarted"});
				return true;
			}
			case "initReplay": {
				const initMessage = JSON.parse(message);
				game.setReplay(initMessage.replay);

				new BoardState(true);
				if (initMessage.started) {
					gameState.doStartGame(false);
				}
				return true;
			}
			case "initManual": {
				this.#isQueueingMessages = true;
				const gameInfo = JSON.parse(message);
				const cardPromises = gameInfo.cards.sort((a, b) => a.index - b.index).map(card => {
					return new Promise(resolve => {
						cardLoader.getManualCdf(card.id).then(cdf => {
							card.cdf = cdf;
							resolve(card);
						});
					});
				});
				Promise.all(cardPromises).then(cards => {
					generalUI.init();
					gameDiv.hidden = false;

					new BoardState(false);

					for (const cardInfo of cards) {
						const card = new Card(game.players[cardInfo.player], cardInfo.cdf);
						const zone = parseNetZone(cardInfo.zone, player);
						zone.add(card, cardInfo.index);
						card.hiddenFor = cardInfo.hiddenFor.map(playerId => game.players[playerId]);
						gameUI.insertCard(zone, cardInfo.index);
					}
					for (const playerInfo of gameInfo.players) {
						game.players[playerInfo.index].life = playerInfo.life;
						game.players[playerInfo.index].mana = playerInfo.mana;
						if (playerInfo.heldCardZone) {
							gameState.controller.playerInfos[playerInfo.index].setHeld(parseNetZone(playerInfo.heldCardZone, player).get(playerInfo.heldCardIndex));
						}
					}
					for (const [i, counterList] of gameInfo.counters.entries()) {
						for (const amount of counterList) {
							const counter = gameUI.addCounter(getCounterSlotIndex(i, player));
							gameUI.setCounter(counter, amount);
						}
					}

					gameState.doStartGame(false);
					for (const [command, message, player] of this.#queuedUpMessages) {
						gameState.receiveMessage(command, message, player);
					}
				});
				return true;
			}
			default: {
				if (this.#isQueueingMessages) {
					this.#queuedUpMessages.push([command, message, player]);
					return true;
				}
			}
		}
		return false;
	}
}