async function getLocale() {
	let english = fetch("./data/locales/en.json").then(async response => await response.json());
	let local = fetch("./data/locales/" + localStorage.getItem("language") + ".json").then(async response => await response.json());
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

export let locale = await getLocale();
export async function reloadLocale() {
	locale = await getLocale();
}