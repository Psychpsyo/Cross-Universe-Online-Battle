id: CUS00067
cardType: standardSpell
name: CUS00067
level: 3
types: Electric, Landmine
o: cast
condition: COUNT([from unitZone]) > 3
after: COUNT([from declared where owner = opponent]) > 0
DISCARD(SELECT(1, [from you.hand]))
DESTROY([from field where cardType = unit])