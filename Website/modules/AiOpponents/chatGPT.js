import {AI} from "/rulesEngine/aiSystems/ai.js";
import {getAutoResponse} from "/modules/autopass.js";
import {getCardInfo} from "/modules/cardLoader.js";
import {locale} from "/modules/locale.js";

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
					mainQuestion = "You must choose some cards, how would you like to do it?";
					giveRecap = false;
					choices.push(new Choice("Give up", {type: option.type, value: null}));
					// TODO: figure this out.
					break;
				}
				case "choosePlayer": {
					mainQuestion = "Select a player for that.";
					giveRecap = false;
					choices.push(new Choice("Yourself", {type: option.type, value: this.player.index}));
					choices.push(new Choice("Your opponent", {type: option.type, value: this.player.next().index}));
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
					choices.push(new Choice("Pass priority", {type: option.type}));
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
			moveExplanation += "You are playing a card game and must make a move.\n";
			moveExplanation += "You have " + this.player.mana + " mana and " + this.player.life + " life.\n";
			moveExplanation += "There is " + this.player.deckZone.cards.length + " cards in your deck.\n";
		}
		moveExplanation += mainQuestion + "\n";
		for (let i = 0; i < choices.length; i++) {
			moveExplanation += (i + 1) + ". " + choices[i].label + "\n";
		}
		moveExplanation += "Please respond with only a number between 1 and " + choices.length + " and nothing else.";
		return choices[parseInt(this.askChatGPT(moveExplanation)) - 1].response;
	}

	askChatGPT(question) {
		let response = prompt(question);
		console.log(question);
		return response;
	}
}