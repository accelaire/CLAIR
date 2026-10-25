-- Remet en « ’ » les apostrophes des ordres du jour de séance AN restées en U+0092.
--
-- `syncSeancesODJ` complète l'ordre du jour des séances publiques depuis le CSV
-- `seances_publique_excel.csv` de l'Assemblée, annoncé en latin1 mais écrit en
-- windows-1252 : l'apostrophe typographique y est l'octet 0x92. Sous Node 20,
-- `new TextDecoder('latin1')` décodait cet octet en U+0092, un caractère de
-- contrôle que le navigateur n'affiche pas (« l urgence »). Node 24 applique le
-- standard Encoding, pour qui `latin1` désigne windows-1252, et rend « ’ ».
--
-- Le changement de Node ne répare pas les lignes déjà écrites : le CSV ne couvre
-- que les séances à venir, et 15 des 18 séances touchées le 25/10/2026 (du 28/05
-- au 29/10) ont depuis été passées en « Supprimé » par l'Assemblée, état que la
-- synchro des réunions saute. Personne ne les réécrira.
--
-- U+0092 n'a aucun sens dans un texte : le remplacer partout dans ces deux
-- colonnes est sans risque. Seule cette valeur de la plage 0x80-0x9F apparaît
-- dans les réunions. Idempotent : une fois remplacées, les lignes ne sont plus
-- reprises.

UPDATE "reunions"
SET "odj_resume" = replace("odj_resume", chr(146), '’'),
    "odj_complet" = replace("odj_complet", chr(146), '’')
WHERE strpos("odj_resume", chr(146)) > 0
   OR strpos("odj_complet", chr(146)) > 0;
