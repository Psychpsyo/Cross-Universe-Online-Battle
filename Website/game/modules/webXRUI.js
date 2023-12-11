import * as THREE from "three";
import {VRButton} from "three/addons/webxr/VRButton.js";
import {XRControllerModelFactory} from 'three/addons/webxr/XRControllerModelFactory';
import WebXRPolyfill from "webxr-polyfill";
import {getCardImageFromID} from "/modules/cardLoader.js";

const polyfill = new WebXRPolyfill();
const textureLoader = new THREE.TextureLoader();

// THREEjs scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

// start VR
const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x000000, 1);
document.body.appendChild(VRButton.createButton(renderer));
renderer.xr.enabled = true;

renderer.setAnimationLoop(function () {
	renderer.render(scene, camera);
});

// add light
scene.add(new THREE.AmbientLight("white"));

// set up controllers
function controllerGrabStart() {
	console.log("started grab", this);
}
function controllerGrabEnd() {
	console.log("stopped grab", this);
}
const controllerModelFactory = new XRControllerModelFactory();
const grips = [];
for (let i = 0; i < 2; i++) {
	const grip = renderer.xr.getControllerGrip(i);
	grip.add(controllerModelFactory.createControllerModel(grip));
	scene.add(grip);
	grips.push(grip);

	renderer.xr.getController(i).addEventListener("selectstart", controllerGrabStart);
	renderer.xr.getController(i).addEventListener("selectend", controllerGrabEnd);
}

// place the main game board
const fieldMesh = new THREE.Mesh(
	new THREE.PlaneGeometry(1308 / 1024, 1),
	new THREE.MeshBasicMaterial({map: textureLoader.load("/images/field.jpg"), side: THREE.DoubleSide})
);
scene.add(fieldMesh);
fieldMesh.rotation.x = Math.PI / 2;


// card-related stuff
let cardProxies = [];
const cardBackTexture = textureLoader.load("/images/cardBack.jpg");
cardBackTexture.wrapS = THREE.RepeatWrapping;
cardBackTexture.repeat.x = - 1;
const cardBackMaterial = new THREE.MeshBasicMaterial({map: cardBackTexture, side: THREE.BackSide});
const cardFrontMaterials = {};
async function getCardFrontMaterial(cardId) {
	if (!cardFrontMaterials[cardId]) {
		cardFrontMaterials[cardId] = new THREE.MeshBasicMaterial({map: textureLoader.load(getCardImageFromID(cardId)), side: THREE.FrontSide});
	}
	return cardFrontMaterials[cardId];
}
const cardGeometry = new THREE.PlaneGeometry(0.12, 0.12 * 1185 / 813);
cardGeometry.clearGroups();
cardGeometry.addGroup(0, Infinity, 0);
cardGeometry.addGroup(0, Infinity, 1);

class CardProxy3D {
	constructor(cardId) {
		this.cardId = cardId;
		this.mesh = new THREE.Mesh(cardGeometry, [cardBackMaterial, null]);
		getCardFrontMaterial(cardId).then((material => {
			this.mesh.material[1] = material;
		}).bind(this));
		cardProxies.push(this);
	}
}

let testCard = new CardProxy3D("U00161");
scene.add(testCard.mesh);
testCard.mesh.rotation.x = Math.PI / 2;
testCard.mesh.position.y = .01;
