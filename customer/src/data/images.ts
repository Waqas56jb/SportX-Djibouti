/**
 * Editorial photography for marketing sections (Unsplash, football & teamwear only).
 * Every id below has been checked by eye for relevance. Replace with SPORTX / WOLF
 * campaign photography when available — `SmartImage` only needs a base URL.
 * Product photos come from the API (catalogue), not from this file.
 */
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80`;

export const IMG = {
  // Scenes
  heroNightTraining: unsplash('1761225091881-0d3bda9f6d5a'),
  stadiumFloodlit: unsplash('1522778119026-d647f0596c20'),
  stadiumNight: unsplash('1706675780107-7c43cc487928'),
  stadiumPitch: unsplash('1676746424139-77f8bd8922a8'),
  cornerFlag: unsplash('1676746610993-fa0c050d1f6d'),
  pitchSunset: unsplash('1540379708242-14a809bef941'),
  kickSky: unsplash('1560272564-c83b66b1ad12'),
  kickOrangeBoot: unsplash('1774344191089-0b6c9da56830'),
  jugglingSunset: unsplash('1505250469679-203ad9ced0cb'),
  goalkeeperSave: unsplash('1774201427012-fd1eb39deddb'),
  headerDuel: unsplash('1774201427166-a6bd297020f5'),
  playerVoltKit: unsplash('1641280173256-0ac1b2f4cd78'),
  ballOnLine: unsplash('1693683223591-59fb0ec0ce86'),

  // Teams & kits
  teamWalkout: unsplash('1598881034666-6d3443d4b1bc'),
  teamRedKits: unsplash('1588333313104-1778f102e5ff'),
  teamHuddleStripes: unsplash('1752681304960-bd4e018a04bb'),
  teamHuddleYellow: unsplash('1641159009736-8a5fd4e52fef'),
  teamBlueMatch: unsplash('1571080096581-53aefc318ac3'),
  jerseyBlackGold: unsplash('1689624291789-7b402a15915a'),

  // Product-led
  bootsOrangeCorner: unsplash('1529900748604-07564a03e7a6'),
  bootsBlackBall: unsplash('1511886929837-354d827aae26'),
  bootOnBall: unsplash('1524015368236-bbf6f72545b6'),
  turfShoes: unsplash('1768696082264-44f14594ca2c'),
  poloCoach: unsplash('1625910513520-bed0389ce32f'),
  poloModel: unsplash('1625910513399-c9fcba54338c'),
  poloBlack: unsplash('1625910513413-c23b8bb81cba'),
  teeBlack: unsplash('1610502778270-c5c6f4c7d575'),
  teesStack: unsplash('1562157873-818bc0726f68'),
  shortsAction: unsplash('1779659821784-5498b5ff84dd'),
  tracksuitTeam: unsplash('1760736699270-d1bc09a6509f'),
  socksGrip: unsplash('1757656557239-48500ba4fd20'),
  socksCleats: unsplash('1774346865420-ac98ef6cb531'),
  socksMatch: unsplash('1789925941480-aebc24c038af'),
  backpackPitch: unsplash('1616066753769-b46d9d825331'),
  backpackBlack: unsplash('1581605405669-fcdf81165afa'),
  ballsTrio: unsplash('1551958219-acbc608c6377'),
  gkGloves: unsplash('1760177379284-b68471fdd217'),
} as const;

export type ImageKey = keyof typeof IMG;
