id: CUI00048
cardType: continuousItem
name: CUI00048
level: 4
types: Fire, Book, Structure

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]))
exec:
$views = you.VIEW(DECKTOP(3)) & opponent.VIEW(you.DECKTOP(3))
$selected = SELECT(1, $views.viewed)
MOVE($selected, you.hand)
DISCARD($views.viewed - $selected)
DAMAGE(200)

o: trigger
mandatory: yes
after: COUNT([from discarded where self = thisCard & zone = field]) > 0
MOVE([from you.discard where name != CUI00048], you.deck)
EXILE(thisCard)