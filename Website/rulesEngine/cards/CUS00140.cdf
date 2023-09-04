id: CUS00140
cardType: standardSpell
name: CUS00140
level: 6
types:

o: cast
$destructions = DESTROY([from you.field])
opponent.DAMAGE(COUNT($destructions.destroyed) * 100)