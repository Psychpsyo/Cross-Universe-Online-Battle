id: CUI00015
cardType: equipableItem
name: CUI00015
level: 2
types: Earth
o: static
applyTo: equippedUnit
condition: thisCard.zone = field
modifier: {attack += 200}
o: optional
condition: thisCard.zone = field & equippedUnit.types = Earth
cost:
DISCARD(thisCard)
exec:
DESTROY(SELECT(1, [from opponent.field where cardType = [spell, item]]))