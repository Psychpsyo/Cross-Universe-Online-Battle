id: CUI00050
cardType: standardItem
name: CUI00050
level: 1
types: Curse
o: deploy
cost:
$unit = SELECT(1, [from unitZone where cardType = unit])
exec:
APPLY($unit, {attack -= 300, defense -= 300})
APPLY($unit, {level += 2})