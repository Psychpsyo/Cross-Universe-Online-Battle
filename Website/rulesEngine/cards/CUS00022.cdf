id: CUS00022
cardType: standardSpell
name: CUS00022
level: 0
types:

o: cast
$type = SELECTTYPE(allTypes);
$cards = SELECT(any, [from you.hand where types = $type]);
MOVE($cards, deck);
MOVE(SELECT(1, [from you.deck where types = $type & level = COUNT($cards)]), hand);