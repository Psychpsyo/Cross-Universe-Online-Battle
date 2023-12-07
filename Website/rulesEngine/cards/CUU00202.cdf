id: CUU00202
cardType: unit
name: CUU00202
level: 7
types: Water, Earth, Fish, Ghost
attack: 700
defense: 400

o: trigger
mandatory: no
after: COUNT([from summoned(dueTo: effect, by: self != thisCard) where self = thisCard & zone = discard]) > 0
DESTROY(SELECT(1, [from field where cardType = [spell, item]]));
opponent.DAMAGE(100);