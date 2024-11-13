// interpreter
// expr pretty much just wraps the to-be-interpreted string in an object for it to be 'mutable'
function interpret(expr, context, terminator) {
	const ident = expr.s[0];
	expr.s = expr.s.substring(1);
	switch (ident) {
		case "#": { // a variable
			const varName = expr.s.substring(0, expr.s.search(terminator));
			expr.s = expr.s.substring(varName.length);
			return getVar(varName, context);
		}
		case "*": { // a function
			const functionName = expr.s.substring(0, expr.s.indexOf("("));
			expr.s = expr.s.substring(functionName.length + 1);
			const parameters = [];
			while (true) {
				parameters.push(interpret(expr, context, /(?<!\\)[\|\)]/));
				if (expr.s[0] === ")") break;
				expr.s = expr.s.substring(1);
			}
			expr.s = expr.s.substring(1);
			return toValue(localeFunctions[functionName](...parameters));
		}
		case "\\": { // string with escaped initial character
			ident = expr.s[1];
			if (["#", "*"].includes(expr.s[1])) expr.s = expr.s.substring(1);
			// falls through to regular string handling
		}
		default: { // just a string
			const section = expr.s.substring(0, expr.s.search(terminator));
			expr.s = expr.s.substring(section.length);
			// the escape sequences \\, \|, \) and \}
			return {text: ident + section.replaceAll(/\\\\|\\\||\\}|\\\)/g, (seq) => seq.substring(1))};
		}
	}
}
function getVar(varName, context) {
	let result;
	// non-object is a direct variable text
	if (typeof context !== "object") {
		result = {text: context.toString()};
	} else if ("localeInfo" in context) {
		result = toValue(context);
	} else if (Object.keys(context)[0] === Object.keys(context)[0].toLowerCase()) {
		// lower-case key means this is not a variable holder but rather a direct variable
		result = context;
	} else {
		// otherwise grab the right element from the context
		result = toValue(context[varName]);
	}
	return {...result, identity: varName};
}
function toValue(thing) {
	if (typeof thing === "object") {
		switch (typeof thing.localeInfo) {
			case "function":
				return thing.localeInfo();
			case "object":
				return thing.localeInfo;
		}
		return thing;
	}
	return {text: thing.toString()};
}

// the actual localize function
export default function localize(localeKey, insert) {
	try {
		const path = localeKey.split(".");
		let current = locale;
		for (const part of path) {
			current = current[part];
			if (current === undefined) return "";
		}
		// variable-inserting code blocks
		const expr = {s: current};
		current = "";
		let nextBlockAt = expr.s.search(/(?<!\\){/);
		while (nextBlockAt !== -1) {
			// handle escape sequences as they get pulled out of the string \\ and \{
			current += expr.s.substring(0, nextBlockAt).replaceAll(/\\\\|\\{|/g, (seq) => seq.substring(1));
			expr.s = expr.s.substring(nextBlockAt + 1);
			current += interpret(expr, insert, /(?<!\\)}/).text;
			expr.s = expr.s.substring(1);
			nextBlockAt = expr.s.search(/(?<!\\){/);
		}
		current += expr.s.replaceAll(/\\\\|\\{|/g, (seq) => seq.substring(1));
		return current;
	} catch (e) {
		console.error(`Error while localizing ${localeKey} with insert these inserts:`, insert, `The error was:\n${e}`);
		return localeKey;
	}
};

// setup
async function getLocale() {
	const english = fetch("./data/locales/en.json").then(async response => await response.json());
	const local = fetch("./data/locales/" + localStorage.getItem("language") + ".json").then(async response => await response.json());
	await Promise.all([english, local]);
	return replaceMissingKeys(await local, await english);
}
function replaceMissingKeys(local, english) {
	for (const [key, value] of Object.entries(english)) {
		if (!local[key]) {
			local[key] = value;
			continue;
		}
		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				if (!local[key][i]) {
					local[key][i] = value[i];
				}
			}
			continue;
		}
		if (typeof value === "object") {
			replaceMissingKeys(local[key], value);
		}
	}
	return local;
}

export let locale = Object.freeze(await getLocale());
let localeFunctions = {...await import(`./localeFunctions/en.mjs`), ...await import(`./localeFunctions/${localStorage.getItem("language")}.mjs`)};
export async function reloadLocale() {
	locale = Object.freeze(await getLocale());
	localeFunctions = {...await import(`./localeFunctions/en.mjs`), ...await import(`./localeFunctions/${localStorage.getItem("language")}.mjs`)};
}