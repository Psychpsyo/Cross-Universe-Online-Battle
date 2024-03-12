let resolveStartPromise = null;

let startingGameSettings = null; // An object, containing the game parameters for the currently starting game
// starts a game and returns a promise that resolves when the game is over.
export async function startGame(isCaller, options = {}) {
	return new Promise((resolve, reject) => {
		if (replayToLoad || resolveStartPromise) {
			reject();
		}
		startingGameSettings = {
			isCaller: isCaller,
			options: options
		}
		resolveStartPromise = resolve;
		gameFrame.contentWindow.location.replace(location.href.substring(0, location.href.lastIndexOf("/")) + "/game/index.html");
		loadingIndicator.classList.add("active");
	});
}

let replayToLoad = null;
export async function* loadReplay(replay) {
	return new Promise((resolve, reject) => {
		if (startingGameSettings || resolveStartPromise) {
			reject();
		}
		replayToLoad = replay;
		resolveStartPromise = resolve;
		gameFrame.contentWindow.location.replace(location.href.substring(0, location.href.lastIndexOf("/")) + "/game/index.html");
		loadingIndicator.classList.add("active");
	});
}

const unloadWarning = new AbortController();

// receiving messages from the iframe
window.addEventListener("message", e => {
	if (e.source !== gameFrame.contentWindow) return;

	switch (e.data.type) {
		case "ready": {
			if (replayToLoad) {
				gameFrame.contentWindow.postMessage({
					type: "replay",
					data: replayToLoad
				});
				replayToLoad = null;

			} else {
				// repurpose the passed-in options into the connect message
				startingGameSettings.options.type = "connect";
				startingGameSettings.options.isCaller = startingGameSettings.isCaller;
				gameFrame.contentWindow.postMessage(startingGameSettings.options);
				startingGameSettings = null;
			}
			break;
		}
		case "gameStarted": {
			loadingIndicator.classList.remove("active");

			// prevent user from accidently leaving the site
			window.addEventListener("beforeunload", e => {
				e.preventDefault();
				e.returnValue = "";
			}, {signal: unloadWarning.signal});

			preGame.style.display = "none";
			gameFrame.style.visibility = "visible";
			break;
		}
		case "playerWon":
		case "gameDrawn": {
			unloadWarning.abort();
			break;
		}
		case "leaveGame": {
			unloadWarning.abort();
			resolveStartPromise();
			resolveStartPromise = null;
			gameFrame.style.visibility = "hidden";
			preGame.style.display = "flex";
			gameFrame.contentWindow.location.replace("about:blank");
			break;
		}
	}
});