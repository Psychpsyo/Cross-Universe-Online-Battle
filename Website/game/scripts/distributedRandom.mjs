// This random generator class is used by AutomaticController to ensure that both player's games
// get identical random numbers that can't be influenced by either player by implementing
// a commit-then-reveal protocol.

import {CURandom} from "../../rulesEngine/src/random.mjs";
import {netSend, youAre} from "./netcode.mjs";

export class DistRandom extends CURandom {
	constructor() {
		super();
		this.values = [];
		this.valueKeys = [];
		this.cyphertexts = [];
		this.cypherKeys = [];

		this.cyphertextReceiver = new EventTarget();
		this.cypherKeyReceiver = new EventTarget();
	}
	async nextInt(range) {
		return (await this.nextInts([range]))[0];
	}

	async nextInts(ranges) {
		await this.prepareValues(ranges.length);

		// wait for opponent cyphertext
		let cyphertext = this.cyphertexts.shift();
		if (cyphertext === undefined) {
			cyphertext = await new Promise(resolve => {
				this.cyphertextReceiver.addEventListener("textReceived", function() {
					resolve(this.cyphertexts.shift());
				}.bind(this), {once: true});
			});
		}

		// send own decryption key now that the opponent has entered the commitment
		netSend("[distRandKey]" + u8tos(new Uint8Array(await crypto.subtle.exportKey("raw", this.valueKeys.shift()))));

		let cypherKey = await this.receiveKey();
		let view = new DataView(await crypto.subtle.decrypt({name: "AES-CTR", counter: new Uint8Array(16), length: 64}, cypherKey, cyphertext));
		if (view.getFloat64(ranges.length * 8) != 0) {
			throw new Error("Random value has been altered!");
		}

		return this.values.shift().map((value, i) => Math.floor((value + view.getFloat64(i * 8)) * ranges[i]) % ranges[i]);
	}

	async nextPlayerIndex(game) {
		let player = await this.nextInt(game.players.length);
		if (youAre == 1) {
			player = (player + 1) % game.players.length;
		}
		return player;
	}

	async prepareValues(amount) {
		let key = await crypto.subtle.generateKey({name: "AES-CTR", length: 256}, true, ["encrypt", "decrypt"]);
		this.valueKeys.push(key);

		let valueList = [];
		let view = new DataView(new ArrayBuffer(amount * 64 + 64));
		for (let i = 0; i < amount; i++) {
			view.setFloat64(i * 8, Math.random());
			valueList.push(view.getFloat64(i * 8));
		}
		this.values.push(valueList);

		netSend("[distRandValue]" + u8tos(new Uint8Array(await crypto.subtle.encrypt({name: "AES-CTR", counter: new Uint8Array(16), length: 64}, key, view))));
	}

	async receiveKey() {
		let key = this.cypherKeys.shift();
		if (key === undefined) {
			key = await new Promise(resolve => {
				this.cypherKeyReceiver.addEventListener("keyReceived", function() {
					resolve(this.cypherKeys.shift());
				}.bind(this), {once: true});
			});
		}
		return key;
	}

	importCyphertext(stringValue) {
		this.cyphertexts.push(stou8(stringValue));
		this.cyphertextReceiver.dispatchEvent(new CustomEvent("textReceived"));
	}

	async importCypherKey(stringKey) {
		let key = await crypto.subtle.importKey("raw", stou8(stringKey), {name: "AES-CTR", counter: new Uint8Array(16), length: 256}, true, ["encrypt", "decrypt"]);
		this.cypherKeys.push(key);
		this.cypherKeyReceiver.dispatchEvent(new CustomEvent("keyReceived"));
		return
	}
}

// Uint8Array <=> String conversion
function stou8(string) {
	return new Uint8Array(string.split("").map(char => char.charCodeAt(0)));
}
function u8tos(array) {
	return String.fromCharCode.apply(null, array);
}