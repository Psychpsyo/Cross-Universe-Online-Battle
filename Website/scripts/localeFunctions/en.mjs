import { perspectives } from "../localeConstants.mjs";

// list of all articles
const articles = ["the", "your", "my", "his", "her", "its"];

// Turns "you" into "your" or "John" into "John's".
// Usage: *POSSESSIVE(John)
export function POSSESSIVE(actor) {
	return {
		"you": "your",
	}[actor.text] ?? `${actor.text}'s`;
}

// Formats present simple verbs.
// Usage: *PRESENT_SIMPLE(go|goes|#ACTOR)
export function PRESENT_SIMPLE(mainVerb, withS, actor) {
	if ([perspectives.FIRST_PERSON, perspectives.SECOND_PERSON].includes(actor.perspective)) {
		return mainVerb.text;
	}
	return actor.amount === 1? withS.text : mainVerb.text;
}

// Swaps something's name out for a pronoun, if necessary.
// Usage: {#PERSON} is talking about {*PRONOUN(#SUBJECT|#PERSON|themself)}
export function PRONOUN(object, priorOccurance, replacementPronoun) {
	if (object.identity === priorOccurance.identity) return replacementPronoun;
	return object.text;
}

// Upper-cases the first letter of the phrase.
// Usage: *SENTENCE(i go to the store)
export function SENTENCE(phrase) {
	return phrase.text[0].toUpperCase() + phrase.text.substring(1);
}

// Adds "the" to the word
// Usage: THE(card)
export function THE(word) {
	if (word.isProperName || articles.includes(word.text.split(" ")[0])) {
		return word;
	}
	return `the ${word}`;
}

// Converts the phrase to title case
// Usage: *TITLE(book contents)
export function TITLE(phrase) {
	return phrase.text.replaceAll(/(?<=^| |-)[A-Za-z]+/g, match => match[0].toUpperCase() + match.substring(1));
}