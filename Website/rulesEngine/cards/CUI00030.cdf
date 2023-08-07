id: CUI00030
cardType: standardItem
name: CUI00030
level: 1
types: Dark, Book
o: deploy
turnLimit: 1
$discards = DISCARD(SELECT(any, [from you.hand]))
GAINMANA(COUNT($discards.discarded))