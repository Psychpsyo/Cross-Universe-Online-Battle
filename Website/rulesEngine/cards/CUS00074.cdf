id: CUS00074
cardType: standardSpell
name: CUS00074
level: 4
types:

o: cast
$discards = DISCARD([from opponent.hand]);
opponent.DRAW(COUNT($discards.discarded));