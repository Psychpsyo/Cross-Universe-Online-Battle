Array.from(document.getElementsByTagName("dialog")).forEach(elem => {
	elem.addEventListener("click", function(e) {
		if (e.target === elem) {
			elem.close();
		}
	});
});