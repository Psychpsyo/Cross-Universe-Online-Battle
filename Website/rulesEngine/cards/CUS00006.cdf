id: CUS00006
cardType: standardSpell
name: CUS00006
level: 2
types: Fire
o: cast
$discards = DISCARD(DECKTOP?(4))
opponent.DAMAGE(COUNT([from $discards.cards where types = Fire]))