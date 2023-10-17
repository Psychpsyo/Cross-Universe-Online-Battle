id: CUS00094
cardType: standardSpell
name: CUS00094
level: 2
types:

o: cast
both.DRAW(1)

o: trigger
mandatory: yes
after: COUNT([from discarded where self = thisCard & zone = hand]) > 0
both.DRAW(1)