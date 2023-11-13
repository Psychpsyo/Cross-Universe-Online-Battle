id: CUI00030
cardType: standardItem
name: CUI00030
level: 1
types: Dark, Book
turnLimit: 1

o: deploy
$discards = DISCARD(SELECT(any, [from you.hand]));
GAINMANA(COUNT($discards.discarded));