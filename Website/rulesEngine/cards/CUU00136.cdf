id: CUU00136
cardType: unit
name: CUU00136
level: 5
types: Fire, Wind, Ghost
attack: 400
defense: 500
o: optional
turnLimit: 1
condition: thisCard.zone = field
$exiles = EXILE(SELECT([1, 2, 3], [from you.discard]))
APPLY(thisCard, {attack += COUNT($exiles.exiled) * 100}, endOfTurn)
DAMAGE(100)