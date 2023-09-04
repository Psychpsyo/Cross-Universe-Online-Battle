id: CUS00132
cardType: standardSpell
name: CUS00132
level: 2
types: Fire

o: cast
DAMAGE(100)
DRAW(1)

o: trigger
mandatory: yes
after: COUNT([from discarded where self = thisCard & zone = [hand, deck]]) > 0
condition: [from you.partnerZone].types = Fire
DAMAGE(100)
DRAW(1) & opponent.DRAW(1)