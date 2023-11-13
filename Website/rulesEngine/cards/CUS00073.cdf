id: CUS00073
cardType: standardSpell
name: CUS00073
level: 1
types:

o: cast
$cards = MOVE([from you.hand], you.deck);
DRAW(COUNT($cards.moved));