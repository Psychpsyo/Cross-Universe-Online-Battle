id: CUS00073
cardType: standardSpell
name: CUS00073
level: 1
types:

o: cast
$cards = RETURN([from you.hand], deck);
DRAW(COUNT($cards.returned));