id: CUS00031
cardType: standardSpell
name: CUS00031
level: 1
types:

o: cast
cost:
LOSELIFE(50);
exec:
$unit = MOVE(SELECT(1, [from you.deck where cardType = unit]), you.hand);
DAMAGE($unit.moved.level * 50);