id: CUU00121
cardType: unit
name: CUU00121
level: 0
types: Ice, Spirit
attack: 0
defense: 0
o: static
applyTo: thisCard
modifier: {attack += COUNT([from you.field where self != thisCard & name = CUU00121]) * 100, defense += COUNT([from you.field where self != thisCard & name = CUU00121]) * 100}