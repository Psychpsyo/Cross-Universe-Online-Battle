id: CUU00264
cardType: unit
name: CUU00264
level: 2
types: Water, Plant, Bug
attack: 100
defense: 100
o: trigger
mandatory: no
after: COUNT([from declared where self = thisCard]) > 0
APPLY(thisCard, {attack += 100}, forever)