id: CUI00095
cardType: standardItem
name: CUI00095
level: 4
types: Earth, Myth
o: deploy
condition: you.life > 1999
cost:
LIFE(-(you.life / 2))
exec:
SUMMON([from you.deck, you.hand, you.discard where name = CUU00101], you.field, no)
DESTROY([from field])