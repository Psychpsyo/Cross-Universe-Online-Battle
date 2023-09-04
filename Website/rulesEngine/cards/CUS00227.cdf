id: CUS00227
cardType: standardSpell
name: CUS00227
level: 0
types: Demon

o: cast
after: COUNT([from destroyed where types = Demon & zone = you.field]) > 1 & SUM([from destroyed where types = Demon & zone = you.field].level) > 7
SUMMON(SELECT(1, [from you.hand, you.deck, you.discard where name = CUU00204]), you.unitZone, no)