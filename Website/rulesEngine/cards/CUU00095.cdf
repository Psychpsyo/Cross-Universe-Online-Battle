id: CUU00095
cardType: unit
name: CUU00095
level: 7
types: Water, Demon, Psychic
attack: 600
defense: 700

o: fast
turnLimit: 1
condition: thisCard.zone = field
$discards = DISCARD(SELECT(any, [from you.hand]))
APPLY(thisCard, {defense += COUNT($discards.discarded) * 100}, endOfTurn)