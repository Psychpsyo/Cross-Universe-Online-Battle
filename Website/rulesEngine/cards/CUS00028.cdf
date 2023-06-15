id: CUS00028
cardType: standardSpell
name: CUS00028
level: 0
types:
o: cast
cost:
$unit = SELECT(1, [unit from discard])
exec:
SUMMON($unit, yourField, yes)