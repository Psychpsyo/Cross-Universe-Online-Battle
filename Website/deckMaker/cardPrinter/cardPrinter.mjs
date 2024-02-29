{ // setup
const styleElem = document.createElement("style");
styleElem.textContent = `
#cardPrinterDiv {
	display: none;
}

@media print {
	* {
		background: white !important;
	}
	html, body {
		display: block;
	}
	body > :not(#cardPrinterDiv) {
		display: none !important;
	}

	#cardPrinterDiv {
		display: grid;
  		grid-template-columns: repeat(auto-fill, var(--card-width));
		justify-content: center;
		gap: 1pt;
	}

	#cardPrinterDiv > img {
		width: var(--card-width);
		break-inside: avoid;
	}
}

@page {
	margin: 1cm;
}`;
document.head.appendChild(styleElem);

const cardPrinterDiv = document.createElement("div");
cardPrinterDiv.id = "cardPrinterDiv";
document.body.appendChild(cardPrinterDiv);
}

export function setCards(images, width = "6.3cm") {
	cardPrinterDiv.innerHTML = "";
	if (width instanceof Number) {
		width = width + "cm";
	}
	cardPrinterDiv.style.setProperty("--card-width", width);
	for (let image of images) {
		if (!(image instanceof Image)) {
			const src = image;
			image = document.createElement("img");
			image.src = src;
		}
		cardPrinterDiv.appendChild(image);
	}
}