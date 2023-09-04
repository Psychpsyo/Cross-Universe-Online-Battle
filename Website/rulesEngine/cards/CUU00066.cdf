id: CUU00066
cardType: unit
name: CUU00066
level: 1
types: Wind, Warrior
attack: 100
defense: 100

o: trigger
mandatory: no
after: COUNT([from discarded where self = thisCard & zone = hand]) > 0
SUMMON([from discard where self = thisCard], you.unitZone, yes)