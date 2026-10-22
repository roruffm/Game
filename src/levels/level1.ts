// Level 1 – Das verlorene Schaf (Lk 15,3–7)
//
// Start in the fold on the left. The way out climbs onto the plateau and runs east
// to the ravine where the sheep is stuck. Carrying the sheep you jump lower, so the
// way home is the cave below the plateau. Its gate only opens from the inside.
// Legend: see level.ts.

import { parseLevel } from './level';

export const LEVEL1_MAP = `
RR........................................................................................................................................................................
RR........................................................................................................................................................................
RR........................................................................................................................................................................
RR........................................................................................................................................................................
RR........................................................................................................................................................................
RR........................................................................................................................................................................
RR...............................................................................................................1........................................................
RR........................................2...............................................................................................................................
RR.....................................................................................W..................................................................................
RR.................................................................4................######......................==............................................b.....b.....
RR.......................................b..........................................######...............................................................#################
RR....................................########.................................b....######..b............................................................#################
RR....................................########.................==..==.......########RRRRRR######.............==..........................................#################
RR.................W..T..b.....b..W...########.W.......bC..W..TTTTTTTT...W..########RRRRRR######.........................................................RRRRRRRRRRRRRRRRR
RR.........RRRRR############..########RRRRRRRR####..################################RRRRRR######.b.C.W.............b..T...T..W..C..b....W................RRRRRRRRRRRRRRRRR
RR..............############TT########RRRRRRRR####TT########################RRRRRRRRRRRRRRRRRRRR########...###############################...............RRRRRRRRRRRRRRRRR
RR..............######################RRRRRRRR##############################RRRRRRRRRRRRRRRRRRRR########TTT###############################...............RRRRRRRRRRRRRRRRR
RR...=====......RRRRRRRRRRRR##RRRRRRRRRRRRRRRRRRRR##RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR##########################################...............RRRRRRRRRRRRRRRRR
RR..............G,,,,,,,,,,,,,RRRR,,,,,,,RRRRRRRRR##RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR###RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...............RRRRRRRRRRRRRRRRR
RR..............G,,,,,,,,,,,,,,,,,,,,,,,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR###RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...............RRRRRRRRRRRRRRRRR
RR........====..G,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RR,,,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...............RRRRRRRRRRRRRRRRR
RR.hNhbhN.HH.CP.G,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..3............RRRRRRRRRRRRRRRRR
RR##############RRRRRRRRRRRRRR,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RRRRRRRRR,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR=====..........RRRRRRRRRRRRRRRRR
RR##############RRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,t,,,,,,,,,,,,,,,,,,,,,,,,,,5,,,,,,,,,,,,,,,,,,,,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...............RRRRRRRRRRRRRRRRR
RR##############RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RRRRRRRRRRRRRRRRRRRRRRRRRR...............RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,,,,,C,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RR,,,,,RRRRRRRRR...............RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,,,,t,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,RRRRRRRR...............RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,,,,,,,C,,,,,,,,,,,,,,,,,,,,,,,,,,,...............RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,,t,,,,,,,,,,,,,,,,,,,,...............RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,t,,,,,,,,,,,...............RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,,,,,,...C..b.T..S.W.RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR###############RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR###############RRRRRRRRRRRRRRRRR
RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR###############RRRRRRRRRRRRRRRRR
`;

export const level1 = parseLevel(LEVEL1_MAP);
