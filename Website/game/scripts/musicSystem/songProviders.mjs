// These classes all provide a different way of playing battle music
// That was until I found out that playing stuff from Spotify or Youtube
// is annoying due to their API restrictions.

class SongProvider {
	start(fadeDuration) {}
	stop(fadeDuration) {}
}

class UrlSongProvider extends SongProvider {
	constructor(link) {
		super();
		this.audio = new Audio(link);
		this.audio.loop = true;
		this.audio.volume = 0;
		this.volumeTarget = 0;
		this.animating = false;
		this.lastAnimTimestamp = null;
		this.fadeSpeed = 1;
	}
	start(fadeDuration) {
		this.audio.play();
		this.fadeVolumeTo(1, fadeDuration);
	}
	stop(fadeDuration) {
		this.fadeVolumeTo(0, fadeDuration);
	}

	fadeVolumeTo(newVolume, fadeDuration) {
		this.volumeTarget = newVolume;
		const volumeDistance = this.volumeTarget - this.audio.volume;
		this.fadeSpeed = Math.max(volumeDistance / fadeDuration, volumeDistance) * 1000; // *1000 converts seconds to milliseconds
		requestAnimationFrame(this.animateVolume.bind(this));
		this.animating = true;
	}
	animateVolume(currentTime) {
		// to not do stupid things on the first frame
		if (!this.lastAnimTimestamp) {
			this.lastAnimTimestamp = currentTime;
			requestAnimationFrame(this.animateVolume.bind(this));
			return;
		}

		// actual stuff
		const delta = this.lastAnimTimestamp - currentTime;
		this.lastAnimTimestamp = currentTime;

		this.audio.volume = Math.max(Math.min(this.audio.volume + this.fadeSpeed * delta, 1), 0);
		if (this.audio.volume === this.volumeTarget || Math.sign(this.fadeSpeed) !== Math.sign(this.audio.volume - this.volumeTarget)) {
			this.audio.volume = this.volumeTarget;
			if (this.volumeTarget === 0) {
				this.audio.stop();
			}
		} else {
			requestAnimationFrame(this.animateVolume.bind(this));
		}
	}
}

export const songProviders = {
	"url": UrlSongProvider
};