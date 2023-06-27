id: CUU00157
cardType: unit
name: CUU00157
level: 3
types: Dark, Mage, Warrior
attack: 300
defense: 200
o: optional
turnLimit: 1
condition: thisCard.zone = field
$exile = EXILE(SELECT(1, [from you.hand where cardType = spell]))
APPLY(thisCard, {attack += $exile.exiled.level * 50, defense += $exile.exiled.level * 50}, endOfOpponentNextTurn)