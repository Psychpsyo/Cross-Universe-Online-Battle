id: CUS00089
cardType: standardSpell
name: CUS00089
level: 2
types: Light, Landmine
o: cast
after: COUNT([from summoned where owner = opponent]) > 0
APPLY([from opponent.field], {attack = 0}, endOfTurn)