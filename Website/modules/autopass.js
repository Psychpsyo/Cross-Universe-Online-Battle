// This module exports the shouldAutoPass() function which the automatic simulator uses to figure out
// whether or not to automatically pass priority to the other player, given a set of input requests.

import * as phases from "/rulesEngine/phases.js";

let ctrlHeld = false;

window.addEventListener("keydown", function(e) {
    if (e.key == "Control") {
        ctrlHeld = true;
    }
});
window.addEventListener("keyup", function(e) {
    if (e.key == "Control") {
        ctrlHeld = false;
    }
});
window.addEventListener("blur", function(e) {
    ctrlHeld = false;
});

export function shouldAutoPass(requests) {
    if (ctrlHeld || !requests.find(request => request.type == "pass")) {
        return false;
    }
    let importantRequests = 0;
    for (let request of requests) {
        if (isImportant(request)) {
            importantRequests++;
        }
    }
    return importantRequests == 0;
}

function isImportant(request) {
    if (request.type == "pass") {
        return false;
    }
    if (request.type == "doRetire" &&
        request.eligibleUnits.length == 1 &&
        request.eligibleUnits[0].zone.type == "partner"
    ) {
        return false;
    }
    
    let currentPhase = game.currentPhase();
    if (currentPhase instanceof phases.DrawPhase) {
        return false;
    }
    if (currentPhase instanceof phases.EndPhase) {
        return false;
    }
    return true;
}
