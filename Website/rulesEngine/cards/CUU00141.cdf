id: CUU00141
cardType: unit
name: CUU00141
level: 10
types: Fire, Demon, Myth
attack: 0
defense: 800
o: optional
turnLimit: 1
DISCARD(opponent.DECKTOP?(COUNT([from field])))
o: static
applyTo: thisCard
modifier: {attack += COUNT([from opponent.discard]) * 100}