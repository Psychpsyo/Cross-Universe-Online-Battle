id: CUS00079
cardType: standardSpell
name: CUS00079
level: 2
types:
o: cast
turnLimit: 1
condition: COUNT([from exile]) > 5
EXILE([from field where cardType = [spell, item]])
EXILE(DECKTOP(5)) & EXILE(opponent.DECKTOP(5))