id: CUU00115
cardType: unit
name: CUU00115
level: 7
types: Light, Illusion, Rock
attack: 0
defense: 700

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Light]));
exec:
SUMMON?(TOKENS(5, [CUT00004, CUT00005, CUT00006, CUT00007], CUT00004, 0, [Illusion, Warrior], 100, 0), you.unitZone, yes);