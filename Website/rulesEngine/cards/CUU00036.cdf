id: CUU00036
cardType: unit
name: CUU00036
level: 5
types: Light, Earth, Plant
attack: 0
defense: 500
o: optional
turnLimit: 1
condition: thisCard.zone = field
$reveals = REVEAL(SELECT(any, [from you.hand where types = Light & cardType = unit]))
GAINLIFE(COUNT($reveals.revealed) * 50)