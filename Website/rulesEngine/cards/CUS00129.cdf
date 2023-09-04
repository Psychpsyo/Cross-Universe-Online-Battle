id: CUS00129
cardType: standardSpell
name: CUS00129
level: 0
types:
deckLimit: 1

o: cast
$destruction = DESTROY(SELECT(1, [from you.field where cardType = unit]))
opponent.DAMAGE($destruction.destroyed.baseLevel * 50)