id: CUU00051
cardType: unit
name: CUU00051
level: 1
types: Earth, Warrior
attack: 100
defense: 100
o: trigger
mandatory: no
after: COUNT([from retired where self = thisCard]) > 0
DRAW(2)