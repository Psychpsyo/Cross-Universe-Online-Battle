import { perspectives } from "../localeConstants.mjs";

// list of all uninflected articles
const articles = ["der", "die", "das", "dein", "mein", "sein", "ihr"];

// hissing sounds for word endings
const hisses = ["s", "ß", "z", "x"];

// checks if a word is a diminutive form
function isDiminutive(word) {
	return word.endsWith("chen") || word.endsWith("lein");
}

// used by DER(), DIE() and DAS()
function addArticle(word, article) {
	if (word.isProperName || articles.includes(word.text.split(" ")[0])) {
		return word;
	}
	return `${article} ${word.text}`;
}

// Adds the article "der" to the word
// Usage: DAS(Auto)
export function DAS(word) {
	return addArticle(word, "das");
}

// Puts the term into dative case.
// Usage: DATIV(dein Hund)
export function DATIV(term) {
	const words = term.text.split(" ");
	if (articles.includes(words[0])) {
		words[0] = {
			der: "dem",
			die: "der",
			das: "dem",
			dein: "deinem",
			mein: "meinem",
			sein: "seinem",
			ihr: "ihrem"
		}[words[0]];
	}
	return words.join(" ");
}

// Adds the article "der" to the word
// Usage: DER(Baum)
export function DER(word) {
	return addArticle(word, "der");
}

// Adds the article "das" to the word
// Usage: DIE(Mütze)
export function DIE(word) {
	return addArticle(word, "die");
}

// Puts the term into genitive case.
// Usage: GENITIV(dein Hund)
export function GENITIV(term) {
	const words = term.text.split(" ");
	if (articles.includes(words[0])) {
		words[0] = {
			der: "des",
			die: "der",
			das: "des",
			dein: "deines",
			mein: "meines",
			sein: "seines",
			ihr: "ihres"
		}[words[0]];
	}
	// handle the last word
	if (hisses.includes(words.at(-1).at(-1))) {
		words[words.length-1] = `${words.at(-1)}es`;
	} else if (["en", "em", "el", "er"].includes(words.at(-1).substring(words.at(-1).length-2)) || isDiminutive(words.at(-1))) {
		words[words.length-1] = `${words.at(-1)}s`;
	} else {
		words[words.length-1] = `${words.at(-1)}es`;
	}
	return words.join(" ");
}

// Turns "du" into "dein" or "Jonas" into "Jonas'".
// Usage: *POSSESSIV(Jonas)
export function POSSESSIV(owner, object) {
	if (articles.includes(owner.text.split(" ")[0])) {
		return `${object.text} ${GENITIV(owner)}`;
	}
	let gender = "das";
	let objectWords = object.text.split(" ");
	if (articles.includes(objectWords[0])) {
		gender = objectWords[0];
		objectWords.shift();
	}
	return {
		text:`${{
			der: {
				du: "dein"
			},
			die: {
				du: "deine"
			},
			das: {
				du: "dein"
			}
		}[gender][owner.text] ?? `${owner.text}${hisses.includes(owner.text.at(-1))? "'" : "s"}`} ${objectWords.join(" ")}`,
		amount: object.amount,
		perspective: owner.perspective,
		isProperName: owner.isProperName
	};
}

// Formats present simple verbs.
// Usage: *PRAESENS(bist|ist|#ACTOR)
export function PRAESENS(mainVerb, withS, actor) {
	if ([perspectives.FIRST_PERSON, perspectives.SECOND_PERSON].includes(actor.perspective)) {
		return mainVerb.text;
	}
	return actor.amount === 1? withS.text : mainVerb.text;
}

// Swaps something's name out for a personal pronoun, if necessary.
// Usage: {#PERSON} redet gerade von {*PRONOUN(#SUBJECT|#PERSON|sich selbst)}
export function PRONOMEN(object, priorOccurance, replacementPronoun) {
	if (object.identity === priorOccurance.identity) return replacementPronoun;
	return object.text;
}

// Upper-cases the first letter of the phrase.
// Usage: *SATZ(ich gehe ins Geschäft)
export function SATZ(phrase) {
	return phrase.text[0].toUpperCase() + phrase.text.substring(1);
}