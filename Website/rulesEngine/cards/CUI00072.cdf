id: CUI00072
cardType: continuousItem
name: CUI00072
level: 2
types: Illusion, Ghost, Structure

o: optional
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from you.field where types = Figure & cardType = unit]);
exec:
$discard = DISCARD(SELECT(1, [from you.hand where types = Ghost & cardType = unit]));
APPLY([from $unit where cardType = unit], {attack += $discard.discarded.level * 50}, endOfTurn);

o: static
applyTo: [from you.field where baseTypes = Figure & cardType = unit]
condition: thisCard.zone = field
modifier: {abilities += CUI00072:2:1}

[o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {baseAttack = baseLevel * 100}