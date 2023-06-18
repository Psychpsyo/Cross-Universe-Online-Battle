id: CUU00044
cardType: unit
name: CUU00044
level: 2
types: Earth, Machine
attack: 200
defense: 200
o: optional
turnLimit: 1
cost:
DISCARD(SELECT(1, [from yourHand]))
exec:
opponent.DAMAGE(50)