id: CUU00214
cardType: unit
name: CUU00214
level: 2
types: Dark, Demon
attack: 100
defense: 200

o: trigger
mandatory: no
after: COUNT([from discarded where self = thisCard & zone = [hand, field]]) > 0
DISCARD(SELECT(1, [from you.deck where level < 7 & types = Warrior]))