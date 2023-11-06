import {AI} from "/rulesEngine/aiSystems/ai.js";
import {getAutoResponse} from "/modules/autopass.js";
import {getCardInfo} from "/modules/cardLoader.js";
import {locale} from "/modules/locale.js";
import {putChatMessage} from "/modules/generalUI.js";

function cardinalToOrdinal(num) {
	if ([11, 12, 13].includes(num % 100)) {
		return num + "th";
	}
	return num + ["th", "st", "nd", "rd", "th"][Math.min(num % 10, 4)];
}

// generates a short text representation of a card like 'Haniwa Soldier', Lv1 unit (100 attack / 100 defense)
async function generateShortCardText(card) {
	let cardText = "'" + (await getCardInfo(card.cardId)).name + "', Lv" + card.values.level + " " + locale[card.values.cardTypes[0] + "CardDetailType"];
	if (card.values.cardTypes.includes("unit")) {
		cardText += " (" + card.values.attack + " attack/" + card.values.defense + " defense)";
	}
	return cardText;
}

// generates a complete text representation of a card
async function generateFullCardText(card) {
	let cardText = await generateShortCardText(card);
	cardText += "\n" + (card.values.types.length > 0? "Types: " + card.values.types.map(type => locale.types[type]).join(", ") : "(typeless)") + "\n";
	let cardInfo = await getCardInfo(card.cardId);
	if (cardInfo.effects.length > 0) {
		cardText += "Abilities:\n" + cardInfo.effectsPlain;
	}
	return cardText;
}

class Choice {
	constructor(label, response) {
		this.label = label;
		this.response = response;
	}
}

export class ChatGPT extends AI {
	constructor(player, apiKey) {
		super(player);
		this.doDialogue = true;
		this.opponent = this.player.next();
		this.apiKey = apiKey;
		this.gptModel = "gpt-3.5-turbo-instruct";

		this.socket = new WebSocket("ws://dorf.quest:8766");
		this.socket.addEventListener("open", (() => {
			this.socket.send(JSON.stringify({"n_ctx": 4096}));
		}).bind(this));
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
						choices.push(new Choice("Cast " + await generateShortCardText(spell), {type: option.type, value: spell.index}));
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
					let chosenSlot = 0;
					for (let i = 0; i < option.eligibleSlots.length; i++) {
						if (Math.abs(option.eligibleSlots[i] - 2) < Math.abs(option.eligibleSlots[chosenSlot] - 2)) {
							chosenSlot = i;
						}
					}
					return {type: option.type, value: chosenSlot};
				}
				case "deployItem": {
					for (const item of option.eligibleItems) {
						choices.push(new Choice("Deploy " + await generateShortCardText(item), {type: option.type, value: item.index}));
					}
					break;
				}
				case "doAttackDeclaration": {
					choices.push(new Choice("Declare an attack", {type: option.type}));
					break;
				}
				case "doFight": {
					choices.push(new Choice("Do the fight", {type: option.type}));
					break;
				}
				case "doRetire": {
					for (const unit of option.eligibleUnits) {
						if (unit.zone.type !== "partner") {
							choices.push(new Choice("Retire units from the field (discarding them to regain their levels in mana)", {type: option.type}));
							break;
						}
					}
					break;
				}
				case "doStandardDraw": {
					choices.push(new Choice("Draw a card", {type: option.type}));
					break;
				}
				case "doStandardSummon": {
					for (const unit of option.eligibleUnits) {
						choices.push(new Choice("Summon " + await generateShortCardText(unit), {type: option.type, value: unit.index}));
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
		if (choices.length === 1) {
			console.log("The AI only had one choice to pick from so it is being made automatically.");
			return choices[0].response;
		}

		// construct AI prompt
		let moveExplanation = "Q:\n";
		if (giveRecap) {
			// basic game state
			moveExplanation += "It is " + (this.player === game.currentTurn().player? "your" : "your opponent's") + " turn in a card game.\n";
			moveExplanation += "You have " + this.player.mana + " mana and " + this.player.life + " life.\n";
			moveExplanation += "Your opponent has " + this.opponent.mana + " mana and " + this.opponent.life + " life.\n";
			moveExplanation += "There is " + this.player.deckZone.cards.length + " cards in your deck and " + this.opponent.deckZone.cards.length + " in their's.\n";

			// hand cards
			moveExplanation += this.player.handZone.cards.length > 0? "\n\nThese are the cards in your hand:\n" : "You have no cards in hand.";
			for (const card of this.player.handZone.cards) {
				moveExplanation += "- " + await generateFullCardText(card) + "\n";
			}
			// your field
			moveExplanation += "\n\nOn your field there are these cards:\n- Your partner, " + await generateFullCardText(this.player.partnerZone.cards[0]) + "\n";
			for (const card of this.player.unitZone.cards.concat(this.player.spellItemZone.cards)) {
				if (card) {
					moveExplanation += "- " + await generateFullCardText(card) + "\n";
				}
			}
			// opponent field
			moveExplanation += "\n\nOn the opponent's field there are these cards:\n- Their partner, " + await generateFullCardText(this.player.next().partnerZone.cards[0]) + "\n";
			for (const card of this.player.next().unitZone.cards.concat(this.player.next().spellItemZone.cards)) {
				if (card) {
					moveExplanation += "- " + await generateFullCardText(card) + "\n";
				}
			}
		}
		moveExplanation += "\n\n" + mainQuestion + "\n";
		for (let i = 0; i < choices.length; i++) {
			moveExplanation += (i + 1) + ". " + choices[i].label + "\n";
		}
		moveExplanation += this.getFinalPromt(choices.length);

		// ask chatGPT
		let gptResponse = await this.askChatGPT(moveExplanation);
		let gptChoice = choices[gptResponse.choice - 1];

		// do additional, more specific query if needed
		if (gptChoice.response.type === "doAttackDeclaration") {
			let option = optionList.find(opt => opt.type === "doAttackDeclaration");
			moveExplanation = "Q:\nWhich of your units should attack?\n";
			for (let i = 0; i < option.eligibleUnits.length; i++) {
				const unit = option.eligibleUnits[i];
				moveExplanation += (i + 1) + ". Level " + unit.values.level + " '" + (await getCardInfo(unit.cardId)).name + "' (" + unit.values.attack + " attack, " + unit.values.defense + " defense)\n";
			}
			moveExplanation += this.getFinalPromt(option.eligibleUnits.length);
			gptResponse = await this.askChatGPT(moveExplanation);
			gptChoice.response.response.value = [gptResponse.choice - 1];
		} else if (gptChoice.response.type === "doRetire") {
			let option = optionList.find(opt => opt.type === "doRetire");
			moveExplanation = "Q:\nWhich of your units should retire?\n";
			for (let i = 0; i < option.eligibleUnits.length; i++) {
				const unit = option.eligibleUnits[i];
				moveExplanation += (i + 1) + ". Level " + unit.values.level + " '" + (await getCardInfo(unit.cardId)).name + "' (" + unit.values.attack + " attack, " + unit.values.defense + " defense)\n";
			}
			moveExplanation += this.getFinalPromt(option.eligibleUnits.length);
			gptResponse = await this.askChatGPT(moveExplanation);
			gptChoice.response.value = [gptResponse.choice - 1];
		}

		if (gptResponse.comment) {
			putChatMessage(players[this.player.index].name + locale["chat"]["colon"] + gptResponse.comment);
		}

		return gptChoice.response;
	}

	async askChatGPT(question) {
		console.log("Asking the AI:\n" + question);
		this.socket.send(JSON.stringify({
			"prompt": question,
			"max_tokens": 4096,
			"stop": ["Q:"]
		}));
		let responseText = await new Promise(resolve => {
			this.socket.addEventListener("message", e => {
				resolve(JSON.parse(e.data).choices[0].text);
			});
		});
		console.log("The AI said:\n" + responseText);
		const numbers = responseText.match(/\[\d+\]/);
		let response = {choice: parseInt(numbers[numbers.length - 1].substring(1))};
		// TODO: fill response.comment
		return response;
	}

	getFinalPromt(choiceCount) {
		return "A:\n(I will now lay out my thoughts and then I will make my choice by writing the option's number is square brackets like so: [x])";
	}
}