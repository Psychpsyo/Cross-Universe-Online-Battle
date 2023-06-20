id: CUI00006
cardType: standardItem
name: CUI00006
level: 1
types:
o: deploy
SUMMON(SELECT([1, 2, 3, 4, 5], [from you.hand where cardType = unit & types = [from you.partnerZone].types]), you.field, yes)