id: CUS00044
cardType: standardSpell
name: CUS00044
level: 5
types:
o: cast
DRAW(2)
o: trigger
mandatory: yes
after: COUNT([from discarded where self = thisCard & zone = [hand, deck]]) > 0
DRAW(1)