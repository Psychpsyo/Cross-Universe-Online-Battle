id: CUU00053
cardType: unit
name: CUU00053
level: 1
types: Earth, Rock, Figure
attack: 100
defense: 100
o: trigger
mandatory: yes
after: COUNT([from destroyed where self = thisCard]) > 0
DAMAGE(100) & opponent.DAMAGE(100)