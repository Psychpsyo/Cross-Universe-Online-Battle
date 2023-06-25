id: CUU00105
cardType: unit
name: CUU00105
level: 2
types: Earth, Rock, Figure
attack: 200
defense: 100
o: trigger
mandatory: yes
after: COUNT([from destroyed where self = thisCard]) > 0
DAMAGE(100) & opponent.DAMAGE(100)