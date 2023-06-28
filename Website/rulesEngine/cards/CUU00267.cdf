id: CUU00267
cardType: unit
name: CUU00267
level: 2
types: Dark, Plant
attack: 0
defense: 0
o: trigger
mandatory: no
after: COUNT([from summoned where self = thisCard]) > 0
$exiles = EXILE(SELECT([1, 2, 3], [from you.discard]))
GAINLIFE(COUNT($exiles.cards) * 100)
o: optional
turnLimit: 1
condition: thisCard.zone = field
DISCARD(thisCard)
APPLY(SELECT(1, [from opponent.field]), {defense -= 200}, endOfTurn)