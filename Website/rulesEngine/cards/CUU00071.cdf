id: CUU00071
cardType: unit
name: CUU00071
level: 0
types: Water, Dark
attack: 0
defense: 0
o: trigger
mandatory: no
after: COUNT([from destroyed where self = thisCard]) > 0
SUMMON(SELECT(1, [from you.deck where level < 5 & types = Fish & cardType = unit]), you.field, yes)