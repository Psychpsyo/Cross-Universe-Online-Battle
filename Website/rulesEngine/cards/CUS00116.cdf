id: CUS00116
cardType: standardSpell
name: CUS00116
level: 0
types: Gravity
o: cast
condition: COUNT([from discard]) > 14
cost:
LIFE(-(you.life / 2))
exec:
DESTROY([from field])