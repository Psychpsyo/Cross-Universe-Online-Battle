id: CUU00271
cardType: unit
name: CUU00271
level: 2
types: Light
attack: 0
defense: 0
o: trigger
mandatory: yes
after: COUNT([from targeted where self = thisCard]) > 0
DRAW(1)
o: trigger
mandatory: yes
after: COUNT([from destroyed where self = thisCard]) > 0
LOSELIFE(300)