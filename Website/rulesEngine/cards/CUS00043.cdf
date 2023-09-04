id: CUS00043
cardType: standardSpell
name: CUS00043
level: 1
types:

o: cast
$exiles = EXILE(SELECT([1, 2, 3], [from you.discard where cardType = spell]))
GAINMANA(COUNT($exiles.exiled))