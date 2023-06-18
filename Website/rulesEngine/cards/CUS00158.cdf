id: CUS00158
cardType: standardSpell
name: CUS00158
level: 1
types: Light
o: cast
cost:
DISCARD(SELECT(1, [from yourHand where level > 3 & types = Light]))
exec:
DESTROY(SELECT(1, [from field where cardType = spell | cardType = item]))