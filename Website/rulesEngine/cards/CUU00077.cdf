id: CUU00077
cardType: unit
name: CUU00077
level: 4
types: Fire, Water, Rock
attack: 100
defense: 500
o: trigger
mandatory: yes
after: COUNT([from destroyed where self = thisCard]) > 0
DISCARD(DECKTOP?(2))