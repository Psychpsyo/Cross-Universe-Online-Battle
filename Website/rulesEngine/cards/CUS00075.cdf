id: CUS00075
cardType: continuousSpell
name: CUS00075
level: 1
types: Fire
o: fast
turnLimit: 1
cost:
EXILE(SELECT(1, [from yourDiscard where types = Fire]))
exec:
EXILE(SELECT(1, [from opponentDiscard]))