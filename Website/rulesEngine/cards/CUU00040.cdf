id: CUU00040
cardType: unit
name: CUU00040
level: 1
types: Wind, Bird
attack: 100
defense: 0
o: optional
turnLimit: 1
exec:
SUMMON(SELECT(1, [from yourHand where cardType = unit & types = Wind]), yourField, yes)