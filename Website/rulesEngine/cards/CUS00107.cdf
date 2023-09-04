id: CUS00107
cardType: continuousSpell
name: CUS00107
level: 0
types: Fire

o: trigger
mandatory: no
turnLimit: 2
after: COUNT([from discarded where types = Fire & zone = you.deck]) > 0
SUMMON(TOKENS(1, CUT00009, CUT00009, 0, Fire, 0, 0), you.unitZone, yes)