import "../Website/scripts/profilePicture.mjs";
function reset() {
	flipped.checked = false;
	slider.value = 50;
	cardId.value = "U00001";
}
function update() {
	if (neverFlip.checked) flipped.checked = false;
	flipped.disabled = neverFlip.checked;
	const neededProps = [];
	if (neverFlip.checked) neededProps.push('"neverFlip": true');
	if (flipped.checked) neededProps.push('"flip": true');
	if (slider.value !== "50") neededProps.push(`"left": ${slider.value}`);
	output.textContent = `"${cardId.value}": {${neededProps.join(", ")}},`;
	preview.setIcon(cardId.value, flipped.checked);
	preview.style.backgroundPositionX = slider.value + "%";
}
flipped.addEventListener("input", update);
neverFlip.addEventListener("input", update);
slider.addEventListener("input", update);
cardId.addEventListener("input", update);
plus.addEventListener("click", () => {
	slider.value = parseFloat(slider.value) + 0.1;
	update();
});
minus.addEventListener("click", () => {
	slider.value = parseFloat(slider.value) - 0.1;
	update();
});
nextCard.addEventListener("click", () => {
	cardId.value = `${cardId.value[0]}${String(parseInt(cardId.value.substring(1)) + 1).padStart(5, "0")}`;
	update();
});
resetBtn.addEventListener("click", reset);

reset();
update();