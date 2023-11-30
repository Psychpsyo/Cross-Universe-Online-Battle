id: CUI00012
cardType: equipableItem
name: CUI00012
level: 1
types: Shield

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {defense += 100}

o: trigger
mandatory: yes
after: [from discarded where zone = deck + field] = thisCard
RETURN(thisCard, baseOwner.deck);