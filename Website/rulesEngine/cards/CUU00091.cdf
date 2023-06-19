id: CUU00091
cardType: unit
name: CUU00091
level: 3
types: Electric, Earth, Bug
attack: 300
defense: 300
o: optional
turnLimit: 1
cost:
DISCARD(SELECT(1, [from you.hand]))
exec:
DESTROY(SELECT(1, [from field where defense = 0]))
o: trigger
mandatory: yes
duringPhase: endPhase
turnLimit: 1
DAMAGE(50) & opponent.DAMAGE(50)