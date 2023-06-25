id: CUU00171
cardType: unit
name: CUU00171
level: 3
types: Fire, Earth, Rock, Figure
attack: 100
defense: 300
o: trigger
mandatory: yes
after: COUNT([from destroyed where self = thisCard]) > 0
DISCARD(DECKTOP?(3))