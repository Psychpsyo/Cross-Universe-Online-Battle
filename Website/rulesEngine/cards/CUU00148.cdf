id: CUU00148
cardType: unit
name: CUU00148
level: 7
types: Dark, Wind, Bug, Curse
attack: 600
defense: 700
o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]))
exec:
APPLY([from unitZone where types != Curse], {level -= 1}, forever)
APPLY([from unitZone where types != Curse], {attack -= 100, defense -= 100}, forever)
APPLY([from unitZone where types != Curse], {types += Curse}, forever)