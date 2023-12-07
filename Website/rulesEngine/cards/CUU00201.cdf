id: CUU00201
cardType: unit
name: CUU00201
level: 1
types: Dark, Warrior, Ghost, Curse
attack: 100
defense: 100
deckLimit: any

o: trigger
mandatory: no
after: COUNT([from summoned(dueTo: effect, by: self != thisCard) where self = thisCard & zone = discard]) > 0
APPLY(thisCard, {attack += 100});