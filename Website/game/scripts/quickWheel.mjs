
import {locale} from "../../scripts/locale.mjs";
import {netSend} from "./netcode.mjs";

const outerRadius = 50;
const innerRadius = 15;
const contents = locale.chat.quickWheel;

//--- SVG helper functions --------------------------------------------

// generates a string "X,Y" for a given angle and distance from 0,0
// The segment angle & distance are used to push the entire segment outwards
function arcPos(angle, distance, segmentAngle = 0, segmentDistance = 0) {
	let x = Math.cos(angle) * distance + Math.cos(segmentAngle) * segmentDistance;
	let y = Math.sin(angle) * distance + Math.sin(segmentAngle) * segmentDistance;
	return `${x},${y}`;
}
// creates an SVG path in the shape of an arc segment around the origin
function makeArcSegment(start, end) {
	const segmentAngle = (start + end) / 2;
	const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
	arc.setAttributeNS(null, "d", `
	M ${arcPos(start, outerRadius-1, segmentAngle, 1)}
	A 50,50 0 0,1 ${arcPos(end, outerRadius-1, segmentAngle, 1)}
	L ${arcPos(end, innerRadius-1, segmentAngle, 1)}
	A 15,15 0 0,0 ${arcPos(start, innerRadius-1, segmentAngle, 1)}
	Z
	`);
	return arc;
}
// gets the difference in 2 circle's circumference, given their radii
function circleDiff(largeRadius, smallRadius) {
	return (Math.PI * largeRadius - Math.PI * smallRadius) * 2;
}

//--- Actual setup code starts here -----------------------------------

{
	const quickWheel = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	quickWheel.id = "quickWheel";
	quickWheel.setAttribute("viewBox", "-50 -50 100 100");

	const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "g");
	const centerCircleSize = innerRadius - circleDiff(outerRadius, outerRadius-1) / contents.length;
	const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	const hoverCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	bgCircle.setAttributeNS(null, "r", centerCircleSize);
	hoverCircle.setAttributeNS(null, "r", centerCircleSize);
	hoverCircle.classList.add("hoverIndicator");
	centerCircle.appendChild(bgCircle);
	centerCircle.appendChild(hoverCircle);
	quickWheel.appendChild(centerCircle);

	document.body.appendChild(quickWheel);
}

// fill quick wheel
const segmentSize = Math.PI*2 / contents.length;
let arcProgress = -Math.PI/2 - segmentSize / 2;
for (const option of contents) {
	const segment = document.createElementNS("http://www.w3.org/2000/svg", "g");
	segment.dataset.message = option;
	const background = makeArcSegment(arcProgress, arcProgress + segmentSize);
	const arc = makeArcSegment(arcProgress, arcProgress + segmentSize);
	arc.classList.add("hoverIndicator");

	const label = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
	label.setAttributeNS(null, "width", 30);
	label.setAttributeNS(null, "height", 30);
	label.setAttributeNS(null, "x", Math.cos(arcProgress + segmentSize / 2) * 32.5 - 15);
	label.setAttributeNS(null, "y", Math.sin(arcProgress + segmentSize / 2) * 32.5 - 15);
	const labelSpan = document.createElement("span")
	labelSpan.textContent = option;
	label.appendChild(labelSpan);

	segment.appendChild(background);
	segment.appendChild(arc);
	segment.appendChild(label);

	segment.addEventListener("mouseup", function(e) {
		if (e.button !== 1) return;
		netSend("chat", this.dataset.message);
		chat.putMessage(playerData[1].name + locale["chat"]["colon"] + this.dataset.message);
	});

	quickWheel.appendChild(segment);
	arcProgress += segmentSize;
}

// where the wheel was last opened
let wheelX = 0;
let wheelY = 0;

window.addEventListener("mousedown", e => {
	if (e.button !== 1) return;

	wheelX = e.clientX;
	wheelY = e.clientY
	quickWheel.style.top = wheelY + "px";
	quickWheel.style.left = wheelX + "px";
	quickWheel.classList.add("shown");

	e.preventDefault();
});
window.addEventListener("mouseup", e => {
	if (e.button !== 1) return;
	quickWheel.classList.remove("shown");
});
window.addEventListener("blur", () => quickWheel.classList.remove("shown"));