id: CUS00046
cardType: standardSpell
name: CUS00046
level: 10
types: Dark

o: cast
$destructions = DESTROY([from opponent.field where cardType = unit]);
opponent.DAMAGE(SUM($destructions.destroyed.level) * 50);