id: CUU00126
cardType: unit
name: CUU00126
level: 1
types: Water
attack: 100
defense: 0
o: trigger
mandatory: yes
after: COUNT([from discarded where self = thisCard]) > 0
GAINLIFE(50)