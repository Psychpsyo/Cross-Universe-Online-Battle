// used to track the speed of the cursors
let lastMyCursorX = 0;
let lastMyCursorY = 0;
let lastOppCursorX = 0;
let lastOppCursorY = 0;

let lastFrame = performance.now();

// measure when the mouse moves
document.addEventListener("mousemove", function(e) {
	fieldRect = document.getElementById("field").getBoundingClientRect();
	myCursorX = (e.clientX - fieldRect.left - fieldRect.width / 2) / fieldRect.height;
	myCursorY = (e.clientY - fieldRect.top) / fieldRect.height;
	
	dragCard.style.left = myCursorX * fieldRect.height + fieldRect.width / 2 + "px";
	dragCard.style.top = myCursorY * fieldRect.height + "px";
});


function animate(currentTime) {
	let delta = currentTime - lastFrame;
	lastFrame = currentTime;
	
	// opponent cursor movement / smoothing
	if (!opponentCursor.hidden) {
		oppCursorX += (oppCursorTargetX - oppCursorX) / 5;
		oppCursorY += (oppCursorTargetY - oppCursorY) / 5;
	}
	let fieldRect = document.getElementById("field").getBoundingClientRect();
	opponentCursor.style.left = (oppCursorX * fieldRect.height + fieldRect.width / 2) + "px";
	opponentCursor.style.top = oppCursorY * fieldRect.height + "px";
	
	// animate cards
	let myCursorXVel = myCursorX - lastMyCursorX;
	let myCursorYVel =  lastMyCursorY - myCursorY;
	let oppCursorXVel = oppCursorX - lastOppCursorX;
	let oppCursorYVel = lastOppCursorY - oppCursorY;
	
	dragCard.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (myCursorXVel > 0? Math.min(Math.PI / 3, myCursorXVel * 100) : Math.max(Math.PI / -3, myCursorXVel * 100)) + "rad) rotateX(" + (myCursorYVel > 0? Math.min(Math.PI / 3, myCursorYVel * 100) : Math.max(Math.PI / -3, myCursorYVel * 100)) + "rad)";
	
	if (opponentCursor.src.endsWith("images/opponentCursor.png")) {
		opponentCursor.style.transform = "translate(-50%,-50%) rotate(180deg)";
	} else {
		opponentCursor.style.transform = "translate(-50%,-50%) perspective(300px) rotateY(" + (oppCursorXVel > 0? Math.min(Math.PI / 3, oppCursorXVel * 100) : Math.max(Math.PI / -3, oppCursorXVel * 100)) + "rad) rotateX(" + (oppCursorYVel > 0? Math.min(Math.PI / 3, oppCursorYVel * 100) : Math.max(Math.PI / -3, oppCursorYVel * 100)) + "rad) rotateZ(180deg)";
	}
	
	lastMyCursorX = myCursorX;
	lastMyCursorY = myCursorY;
	lastOppCursorX = oppCursorX;
	lastOppCursorY = oppCursorY;
	
	requestAnimationFrame(animate);
}

animate();