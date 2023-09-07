if (!Array.prototype.toReversed) {
	Array.prototype.toReversed = function() {
		return [...this].reverse();
	}
}

if (!Array.prototype.toSorted) {
	Array.prototype.toSorted = function() {
		return [...this].sort();
	}
}

if (!Object.groupBy) {
	Object.groupBy = function(items, callbackFn) {
		let object = {};
		for (let i = 0; i < items.length; i++) {
			let group = callbackFn(items[i], i);
			if (!object[group]) {
				object[group] = [];
			}
			object[group].push(items[i]);
		}
		return object;
	}
}