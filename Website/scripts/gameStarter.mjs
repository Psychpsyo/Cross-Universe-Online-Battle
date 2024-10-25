let resolveStartPromise = null; // function to resolve the promise returned by startGame()
let resolveReadyPromise = null; // function to resolve the gameFrameReady promise
let startingGameSettings = null; // An object, containing the game parameters for the currently starting game
let nextGameType = null; // indicates what sort of game will be started next, and if a game is in progress

export let gameFrameReady = null; // promise that fulfills once the game is ready

// starts a game and returns a promise that resolves when the game is over.
export async function startGame(isCaller, options = {}) {
	return new Promise((resolve, reject) => {
		if (nextGameType) {
			reject();
			return;
		}
		nextGameType = "connect";
		startingGameSettings = {
			isCaller: isCaller,
			options: options
		}
		resolveStartPromise = resolve;
		gameFrameReady = new Promise(resolve => {
			resolveReadyPromise = resolve;
		});
		gameFrame.contentWindow.location.replace(location.href.substring(0, location.href.lastIndexOf("/")) + "/game/index.html");
		loadingIndicator.classList.add("active");
	});
}

// starts spectating a game and returns a promise that resolves when the user stops spectating.
export async function spectate() {
	return new Promise((resolve, reject) => {
		if (nextGameType) {
			reject();
			return;
		}
		nextGameType = "spectate";
		startingGameSettings = {
			options: {}
		};
		resolveStartPromise = resolve;
		gameFrameReady = new Promise(resolve => {
			resolveReadyPromise = resolve;
		});
		gameFrame.contentWindow.location.replace(location.href.substring(0, location.href.lastIndexOf("/")) + "/game/index.html");
		loadingIndicator.classList.add("active");
	});
}

let replayToLoad = null;
export async function loadReplay(replay) {
	return new Promise((resolve, reject) => {
		if (nextGameType) {
			reject();
			return;
		}
		nextGameType = "replay";
		replayToLoad = replay;
		resolveStartPromise = resolve;
		gameFrameReady = new Promise(resolve => {
			resolveReadyPromise = resolve;
		});
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
			resolveReadyPromise();
			switch (nextGameType) {
				case "replay": {
					gameFrame.contentWindow.postMessage({
						type: nextGameType,
						data: replayToLoad
					});
					replayToLoad = null;
					break;
				}
				case "spectate": {
					startingGameSettings.options.type = nextGameType
					gameFrame.contentWindow.postMessage(startingGameSettings.options);
					startingGameSettings = null;
					break;
				}
				case "connect": {
					// repurpose the passed-in options into the startGame message
					startingGameSettings.options.type = nextGameType;
					startingGameSettings.options.isCaller = startingGameSettings.isCaller;
					gameFrame.contentWindow.postMessage(startingGameSettings.options);
					startingGameSettings = null;
					break;
				}
			}
			nextGameType = null;
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
			gameFrameReady = null;
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