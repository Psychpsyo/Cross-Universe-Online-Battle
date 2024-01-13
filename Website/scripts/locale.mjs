async function getLocale() {
	let english = fetch("../data/locales/en.json").then(async response => await response.json());
	let local = fetch("../data/locales/" + localStorage.getItem("language") + ".json").then(async response => await response.json());
	await Promise.all([english, local]);

	return replaceMissingKeys(await local, await english);
}

function replaceMissingKeys(local, english) {
	for (const [key, value] of Object.entries(english)) {
		if (!local[key]) {
			local[key] = value;
			continue;
		}
		if (typeof value == "object" && !Array.isArray(value)) {
			replaceMissingKeys(local[key], value);
		}
	}
	return local;
}

export let locale = await getLocale();
export async function reloadLocale() {
	locale = await getLocale();
}