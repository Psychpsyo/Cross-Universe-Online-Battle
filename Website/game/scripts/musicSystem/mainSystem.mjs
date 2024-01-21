import {songProviders} from "./songProviders.mjs";

const musicData = await fetch("../data/musicRules.json").then(async response => await response.json());

let states = {}; // all available music states
let rules = []; // the currently active music rules
let songs = {}; // all available song providers

let currentState = null; // name of the current music state

export function evalRules() {
	const lastState = currentState;
	for (const rule of rules) {
		if (!rule.condition || isMet(rule.condition)) {
			currentState = states[rule.state];
			break;
		}
	}

	if (lastState?.song != currentState.song) {
		const fadeDurations = [];
		if (currentState.fadeIn) fadeDurations.push(currentState.fadeIn);
		if (lastState?.fadeOut) fadeDurations.push(lastState.fadeOut);
		const avgFadeDuration = fadeDurations.reduce((l, c) => l + c) / fadeDurations.length;
		songs[lastState?.song]?.stop(avgFadeDuration);
		songs[currentState.song]?.start(avgFadeDuration);
	}
}

export function initFromDeck(deck) {
	// load defaults
	// TODO: load default songs from user settings
	states = musicData.defaultStates;
	loadRules(musicData.defaultRules, musicData.defaultRuleSet);
	if (!(deck._extra?.music)) return;

	// load songs from deck
	if ("songs" in deck._extra.music) {
		loadSongs(deck._extra.music.songs);
	}
	// load states from deck
	if ("states" in deck._extra.music) {
		for (const state of deck._extra.music.states) {
			states[state] = deck._extra.music.states[state];
		}
	}
	// load rules from deck
	if ("rules" in deck._extra.music) {
		loadRules(deck._extra.music.rules, musicData.defaultRuleSet);
	}
}

function loadSongs(newSongs) {
	for (const song in newSongs) {
		const songType = newSongs[song].substring(0, newSongs[song].indexOf(":"));
		const songData = newSongs[song].substring(newSongs[song].indexOf(":") + 1);
		songs[song] = new songProviders[songType](songData);
	}
}

// handles include statements from a given rule set while loading rules
function loadRules(newRules, ruleSet) {
	rules = [];
	for (const rule of newRules) {
		if (rule.include) {
			rules = rules.concat(ruleSet[rule.include]);
		} else {
			rules.push(rule);
		}
	}
	rules.push({state: "base"});
}

function isMet(condition) {
	return false;
}

