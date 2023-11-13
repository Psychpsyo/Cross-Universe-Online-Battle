id: CUI00108
cardType: standardItem
name: CUI00108
level: 0
types:

o: cast
SUMMON(SELECT(1, [from you.hand, you.discard where name = [CUU00211, CUU00277]]), you.unitZone, yes);

o: trigger
mandatory: no
after: COUNT([from discarded where self = thisCard & zone = hand]) > 0
MOVE(SELECT(1, [from you.deck where name = [CUU00211, CUU00277]]), you.hand);