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