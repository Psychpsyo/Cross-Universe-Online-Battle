id: CUS00019
cardType: continuousSpell
name: CUS00019
level: 1
types: Water
o: fast
condition: currentTurn = yourTurn & COUNT([from yourUnitZone]) = 0
SUMMON(SELECT(1, [from yourDiscard where level > 0]), yourField, yes)