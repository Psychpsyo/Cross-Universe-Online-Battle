import {AI} from "/rulesEngine/aiSystems/ai.js";
import {getAutoResponse} from "/modules/autopass.js";
import {getCardInfo} from "/modules/cardLoader.js";
import {locale} from "/modules/locale.js";
import {putChatMessage} from "/modules/generalUI.js";

const unitZoneSlots = ["Leftmost slot", "Left of center", "In the middle", "Right of center", "Rightmost slot"];
const spellItemZoneSlots = ["Leftmost slot", "Left of partner", "Right of partner", "Rightmost slot"];

function cardinalToOrdinal(num) {
	if ([11, 12, 13].includes(num % 100)) {
		return num + "th";
	}
	return num + ["th", "st", "nd", "rd", "th"][Math.min(num % 10, 4)];
}

class Choice {
	constructor(label, response) {
		this.label = label;
		this.response = response;
	}
}

export class ChatGPT extends AI {
	constructor(player) {
		super(player);
		this.doDialogue = true;
		this.opponent = this.player.next();
	}

	async selectMove(optionList) {
		// Do auto-passing
		let autoResponse = getAutoResponse(optionList);
		if (autoResponse) {
			console.log("Autopass made a choice for the AI.");
			return autoResponse;
		}

		// enumerate all choices for the AI.
		let choices = [];
		let mainQuestion = "Your options are:";
		let giveRecap = true;
		for (const option of optionList) {
			switch (option.type) {
				case "activateFastAbility":
				case "activateOptionalAbility":
				case "activateTriggerAbility": {
					for (let i = 0; i < option.eligibleAbilities.length; i++) {
						const ability = option.eligibleAbilities[i];
						choices.push(new Choice("Activate the " + cardinalToOrdinal(ability.index + 1) + " ability of  '" + (await getCardInfo(ability.card.cardId)).name + "'", {type: option.type, value: i}));
					}
					break;
				}
				case "castSpell": {
					for (const spell of option.eligibleSpells) {
						choices.push(new Choice("Cast '" + (await getCardInfo(spell.cardId)).name + "' (Lv" + spell.values.level + ")", {type: option.type, value: spell.index}));
					}
					break;
				}
				case "chooseAbilityOrder": {
					mainQuestion = "You must order some abilities, how would you like to do it?";
					giveRecap = false;
					choices.push(new Choice("Choose ability order automatically", {type: option.type, value: Array.from(Array(option.cards.length).keys())}));
					break;
				}
				case "chooseCards": {
					giveRecap = false;
					if (option.validAmounts.length === 1 && option.validAmounts[0] === 1) {
						switch (option.reason) {
							case "selectAttackTarget": {
								mainQuestion = "Select the target for your attack.";
								break;
							}
							case "handTooFull": {
								mainQuestion = "Your hand is too full, which card do you want to discard?";
								break;
							}
							default: {
								if (option.reason.startsWith("cardEffect:")) {
									mainQuestion = "Select a card for the effect of '" + (await getCardInfo(option.reason.split(":")[1])).name + "'";
								} else if (option.reason.startsWith("equipTarget:")) {
									mainQuestion = "Select a unit to equip with '" + (await getCardInfo(option.reason.split(":")[1])).name + "'";
								} else if (option.reason.startsWith("cardEffectMove:")) {
									mainQuestion = "Select a card to move with the effect of '" + (await getCardInfo(option.reason.split(":")[1])).name + "'";
								} else {
									mainQuestion = "Select a card for that.";
								}
							}
						}
						for (let i = 0; i < option.from.length; i++) {
							choices.push(new Choice("'" + (await getCardInfo(option.from[i].cardId)).name + "' (Lv" + option.from[i].values.level + ")", {type: option.type, value: [i]}));
						}
					} else {
						return null; // TODO: figure out how multi-card choices work
					}
					break;
				}
				case "choosePlayer": {
					mainQuestion = "Select a player for that.";
					giveRecap = false;
					choices.push(new Choice("Yourself", {type: option.type, value: this.player.index}));
					choices.push(new Choice("Your opponent", {type: option.type, value: this.opponent.index}));
					break;
				}
				case "chooseType": {
					mainQuestion = "Choose a type for that.";
					giveRecap = false;
					for (let i = 0; i < option.from.length; i++) {
						choices.push(new Choice(locale.types[option.from[i]], {type: option.type, value: i}));
					}
					break;
				}
				case "chooseZoneSlot": {
					mainQuestion = "Pick a zone slot for that.";
					giveRecap = false;
					let names = option.zone.type === "unit"? unitZoneSlots : spellItemZoneSlots;
					for (let i = 0; i < option.eligibleSlots.length; i++) {
						choices.push(new Choice(names[option.eligibleSlots[i]], {type: option.type, value: i}));
					}
					break;
				}
				case "deployItem": {
					for (const item of option.eligibleItems) {
						choices.push(new Choice("Deploy '" + (await getCardInfo(item.cardId)).name + "' (Lv" + item.values.level + ")", {type: option.type, value: item.index}));
					}
					break;
				}
				case "doAttackDeclaration": {
					break;
				}
				case "doFight": {
					choices.push(new Choice("Do the fight", {type: option.type}));
					break;
				}
				case "doRetire": {
					break;
				}
				case "doStandardDraw": {
					choices.push(new Choice("Draw a card", {type: option.type}));
					break;
				}
				case "doStandardSummon": {
					for (const unit of option.eligibleUnits) {
						choices.push(new Choice("Summon '" + (await getCardInfo(unit.cardId)).name + "' (Lv" + unit.values.level + ")", {type: option.type, value: unit.index}));
					}
					break;
				}
				case "enterBattlePhase": {
					mainQuestion = "Would you like to enter the battle phase?";
					choices.push(new Choice("Enter battle phase", {type: option.type, value: true}));
					choices.push(new Choice("Skip battle phase", {type: option.type, value: false}));
					break;
				}
				case "orderCards": {
					mainQuestion = "You must order some cards for that, how would you like to do it?";
					giveRecap = false;
					choices.push(new Choice("Order the cards automatically", {type: option.type, value: Array.from(Array(option.cards.length).keys())}));
					break;
				}
				case "pass": {
					let optionLabel = game.currentStack().blocks.length === 0? "Do nothing" : "Don't respond";
					choices.push(new Choice(optionLabel, {type: option.type}));
					break;
				}
			}
		}
		if (choices.length === 0) {
			// TODO: Remove this once impossible.
			alert("The AI bricked and has 0 choices!");
			return null;
		}
		if (choices.length === 1) {
			console.log("The AI only had one choice to pick from so it is being made automatically.");
			return choices[0].response;
		}

		// construct AI prompt
		let moveExplanation = "";
		if (giveRecap) {
			// basic game state
			moveExplanation += "It is " + (this.player === game.currentTurn().player? "your" : "your opponent's") + " turn in a card game and you can make a move.\n";
			moveExplanation += "You have " + this.player.mana + " mana and " + this.player.life + " life.\n";
			moveExplanation += "Your opponent has " + this.opponent.mana + " mana and " + this.opponent.life + " life.\n";
			moveExplanation += "There is " + this.player.deckZone.cards.length + " cards in your deck and " + this.opponent.deckZone.cards.length + " in your opponent's.\n";

			// hand cards
			moveExplanation += this.player.handZone.cards.length > 0? "These are the cards in your hand:\n" : "You have no cards in hand.";
			for (let card of this.player.handZone.cards) {
				moveExplanation += "- " + (await getCardInfo(card.cardId)).name + "', level " + card.values.level + " " + locale[card.values.cardTypes[0] + "CardDetailType"] + "\n";
				moveExplanation += (card.values.types.length > 0? "Types: " + card.values.types.map(type => locale.types[type]).join(", ") : "(typeless)") + "\n";
				moveExplanation += (await getCardInfo(card.cardId)).effectsPlain + "\n\n";
			}
		}
		moveExplanation += mainQuestion + "\n";
		for (let i = 0; i < choices.length; i++) {
			moveExplanation += (i + 1) + ". " + choices[i].label + "\n";
		}
		moveExplanation += "Please respond with only a number between 1 and " + choices.length + " and nothing else. (not even punctuation)"
		if (this.doDialogue) {
			moveExplanation += "\nYou may then follow it up with something related to say to your opponent, encased in quotes in the style of someone in an anime."
		}
		let gptResponse = this.askChatGPT(moveExplanation);
		if (gptResponse.comment) {
			putChatMessage(players[this.player.index].name + locale["chat"]["colon"] + gptResponse.comment);
		}
		return choices[gptResponse.choice - 1].response;
	}

	askChatGPT(question) {
		let responseText = prompt(question).split("\"");
		let response = {choice: parseInt(responseText[0])};
		if (responseText.length > 1) {
			response.comment = responseText[1];
		}
		return response;
	}
}
