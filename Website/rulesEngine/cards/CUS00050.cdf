id: CUS00050
cardType: standardSpell
name: CUS00050
level: 5
types: Dark, Landmine

o: cast
after: declared.owner = opponent
$destructions = DESTROY([from field where cardType = unit]);
DAMAGE(SUM([from $destructions.destroyed where owner = opponent].level) * 50);