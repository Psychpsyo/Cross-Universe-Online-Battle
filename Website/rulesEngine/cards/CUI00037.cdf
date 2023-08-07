id: CUI00037
cardType: standardItem
name: CUI00037
level: 0
types: Book
o: deploy
turnLimit: 1
$unit = SELECT(1, [from you.deck where level < 5 & cardType = unit])
SHUFFLE()
MOVE($unit, you.deckTop)