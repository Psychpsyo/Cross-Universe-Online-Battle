id: CUI00034
cardType: continuousItem
name: CUI00034
level: 0
types: Earth, Plant, Structure
o: optional
turnLimit: 2
condition: thisCard.zone = field
cost:
LOSELIFE(200)
exec:
SUMMON(TOKENS(1, [CUT00008, CUT00019], CUT00008, 1, [Earth, Plant], 100, 100), you.unitZone, yes)