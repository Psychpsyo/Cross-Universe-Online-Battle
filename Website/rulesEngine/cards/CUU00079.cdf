id: CUU00079
cardType: unit
name: CUU00079
level: 1
types: Dark, Bug, Curse
attack: 0
defense: 100
o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from unitZone, spellItemZone where types != Curse])
exec:
APPLY($unit, {level -= 1})
APPLY($unit, {types += Curse})