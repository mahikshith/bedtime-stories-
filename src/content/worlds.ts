import type { World } from '../engine/types';

/**
 * Eighteen worlds. Each contributes a lexicon to the shared narrative skeleton
 * plus signature paragraphs so no two worlds read alike.
 *
 * Every world ends with a "Real Window": one true fact drawn from a public-domain
 * government or museum archive. Fantasy first, then one true thing.
 */
export const WORLDS: World[] = [
  {
    id: 'starfall',
    name: 'Starfall Station',
    emoji: '🚀',
    blurb: 'A drifting station where the night shift counts falling stars.',
    palette: ['#0b1026', '#2b3a8f', '#8fb4ff'],
    lexicon: {
      places: ['the observation ring', 'the quiet docking bay', 'the greenhouse module', 'the long window corridor', 'the sleeping garden'],
      guides: ['a patient station cat', 'the night-shift engineer', 'a small repair drone', 'the station librarian'],
      wonders: ['a slow river of stars', 'an aurora folding like silk', 'a comet trailing quiet light', 'a moon rising sideways', 'a field of drifting seeds'],
      obstacles: ['a door that had forgotten how to open', 'a light that kept blinking', 'a corridor that curved the wrong way', 'a very shy alarm'],
      gentleThings: ['a warm blanket from the laundry chute', 'a mug of something steaming', 'a humming vent', 'a soft handrail', 'a window seat'],
      sounds: ['the hum of the station', 'a distant chime', 'the whisper of air', 'a slow metallic tick', 'the breath of the engines'],
      treasures: ['a pebble of moon glass', 'a folded star chart', 'a tiny brass key', 'a jar of captured light'],
    },
    signatures: {
      wonder: [
        'Outside the window, Earth turned over slowly, like someone rolling to their comfortable side.',
        'The stars did not twinkle out here. They simply stayed, patient and bright, the way good things do.',
      ],
      settle: [
        'The station hummed its long, low note, the one it had been humming since before anyone was born.',
        'Somewhere below, a whole blue world was going quiet, one lit window at a time.',
      ],
    },
    realWindow: {
      title: 'Sunsets on the Space Station',
      fact: 'Astronauts on the International Space Station orbit Earth about every 90 minutes. That means they see roughly sixteen sunrises and sixteen sunsets every single day.',
      credit: 'Image and facts courtesy of NASA.',
      source: 'NASA',
    },
    episodeCount: 12,
  },
  {
    id: 'mossgrove',
    name: 'Mossgrove',
    emoji: '🌲',
    blurb: 'An old forest that keeps its lanterns lit for anyone walking home.',
    palette: ['#0d1f14', '#2f6b43', '#a8e6a0'],
    lexicon: {
      places: ['the lantern path', 'the hollow of the great oak', 'a clearing full of ferns', 'the old stone bridge', 'the moss stairs'],
      guides: ['a slow brown hedgehog', 'the lamplighter badger', 'a moth with dusty wings', 'an owl who rarely spoke'],
      wonders: ['mushrooms glowing like small moons', 'a hundred fireflies rising at once', 'a deer standing perfectly still', 'rain that never reached the ground', 'a tree with a door in it'],
      obstacles: ['a path that had grown over', 'a puddle wider than it looked', 'a bramble with opinions', 'a fog that liked company'],
      gentleThings: ['a bed of dry leaves', 'a patch of warm sun', 'a cup of blackberry tea', 'a hollow just their size', 'a smooth flat stone'],
      sounds: ['leaves turning over', 'a stream talking to itself', 'the creak of old branches', 'an owl asking a question', 'rain on a broad leaf'],
      treasures: ['an acorn cap', 'a feather the colour of evening', 'a smooth green stone', 'a map drawn on birch bark'],
    },
    signatures: {
      wonder: [
        'The forest was not dark. It was simply lit differently, by things that only glow when the sun stops showing off.',
        'Every lantern on the path had been lit by someone who did not know who would need it. That is how the forest worked.',
      ],
      settle: [
        'The great oak had been standing there for four hundred years, and it was in no hurry at all.',
        'Moss is very good at waiting. It had been waiting all day for someone to rest on it.',
      ],
    },
    realWindow: {
      title: 'Trees That Talk',
      fact: 'Forest trees are connected underground by threads of fungus so fine you would need a microscope to see them. Trees use this network to send sugar and warnings to each other.',
      credit: 'Forest research imagery courtesy of the U.S. Geological Survey.',
      source: 'USGS',
    },
    episodeCount: 12,
  },
  {
    id: 'lanterndeep',
    name: 'Lantern Deep',
    emoji: '🐋',
    blurb: 'The part of the ocean that makes its own light.',
    palette: ['#03121f', '#0e4f6e', '#7fd9e8'],
    lexicon: {
      places: ['the kelp cathedral', 'a shelf of sleeping coral', 'the whale road', 'a cave full of soft light', 'the sand garden'],
      guides: ['an old sea turtle', 'a jellyfish who drifted politely', 'a small squid with big ideas', 'a whale who sang directions'],
      wonders: ['a shoal turning all at once like one silver thought', 'plankton lighting up with every movement', 'a manta gliding overhead like a slow cloud', 'an octopus changing colour to say hello', 'sunlight arriving late from far above'],
      obstacles: ['a current going the wrong way', 'a knot of old rope', 'a narrow gap between rocks', 'a curious crab with questions'],
      gentleThings: ['a hammock of warm current', 'a hollow in the reef', 'a bed of soft sand', 'a ribbon of seagrass', 'a slow rocking swell'],
      sounds: ['the click and creak of the reef', 'a whale note held for a very long time', 'sand shifting', 'bubbles rising', 'water folding over water'],
      treasures: ['a spiral shell', 'a piece of sea glass worn smooth', 'a pearl the size of a pea', 'a lost brass compass'],
    },
    signatures: {
      wonder: [
        'Down here, the dark was not empty. It was crowded with small lights, all of them going about their business.',
        'A whale passed overhead, so big and so slow that it seemed less like an animal and more like weather.',
      ],
      settle: [
        'The sea rocked the way seas do, without being asked, forever.',
        'Far above, the waves were busy. Down here, nothing had been in a hurry for a thousand years.',
      ],
    },
    realWindow: {
      title: 'The Ocean Makes Its Own Light',
      fact: 'More than three-quarters of the animals in the deep ocean can make their own light. Scientists call it bioluminescence, and it is the most common form of communication on Earth.',
      credit: 'Deep-sea imagery courtesy of NOAA Ocean Exploration.',
      source: 'NOAA',
    },
    episodeCount: 12,
  },
  {
    id: 'quietdragon',
    name: "The Quiet Dragon's Keep",
    emoji: '🐉',
    blurb: 'A castle guarded by a dragon whose only job is keeping things calm.',
    palette: ['#1a1020', '#5b3a7e', '#e8b4f0'],
    lexicon: {
      places: ['the spiral stair', 'the map room', 'the warm kitchen', 'the tower with the good view', 'the hall of quiet armour'],
      guides: ['a dragon the size of a horse', 'the castle mouse', 'a suit of armour with a kind voice', 'the keeper of candles'],
      wonders: ['a hoard of ordinary treasures, carefully labelled', 'a tapestry that moved when nobody watched', 'a dragon curling up like a cat', 'a window full of purple evening', 'a staircase that went up forever, gently'],
      obstacles: ['a door with three locks and no keys', 'a draught that blew the candles out', 'a step that squeaked', 'a corridor that went in a circle'],
      gentleThings: ['an enormous warm scaled side to lean on', 'a fire banked low', 'a rug thick as moss', 'a chair built for two', 'a candle burning steadily'],
      sounds: ['a dragon breathing slowly', 'wind in the battlements', 'a fire settling', 'a distant bell', 'stone cooling'],
      treasures: ['a single gold coin', 'a dragon scale, shed and shining', 'a key to nothing in particular', 'a very old storybook'],
    },
    signatures: {
      wonder: [
        'The dragon did not hoard gold. It hoarded warm places, and it was extremely good at it.',
        'It turned out the dragon had been guarding the keep for one reason only: so that everyone inside could sleep without worrying.',
      ],
      settle: [
        'The dragon exhaled, and the whole room got one degree warmer.',
        'A castle this old had held a great many sleeping people. It knew exactly how to do it.',
      ],
    },
    realWindow: {
      title: 'Real Castles, Real Stairs',
      fact: 'Many real castle staircases spiral clockwise going up. Historians think it gave a defender coming down more room to swing a sword with their right hand.',
      credit: 'Historical photographs courtesy of the Library of Congress.',
      source: 'Library of Congress',
    },
    episodeCount: 12,
  },
  {
    id: 'cloudloom',
    name: 'Cloudloom',
    emoji: '☁️',
    blurb: 'A workshop in the sky where the weather is woven by hand.',
    palette: ['#141a2e', '#4a6ba8', '#cfe3ff'],
    lexicon: {
      places: ['the weaving floor', 'a balcony above the weather', 'the storeroom of soft greys', 'the drying line', 'the thread garden'],
      guides: ['a weaver with flour-white hair', 'a heron who ran errands', 'a small cloud that followed people', 'the keeper of the rain spools'],
      wonders: ['a bolt of fog unrolling across a valley', 'a rainbow being measured and cut', 'thunder kept in a jar, sleeping', 'a loom wider than a field', 'snow being counted, flake by flake'],
      obstacles: ['a tangled skein of wind', 'a stubborn knot in the rain', 'a draught that unpicked the work', 'a spool that had rolled under everything'],
      gentleThings: ['a pile of unused cloud', 'a woollen shawl', 'a warm updraft', 'a basket of soft grey', 'a hammock of mist'],
      sounds: ['the clack of the loom', 'wind through an open window', 'rain being tested', 'a kettle somewhere', 'thread pulling through'],
      treasures: ['a thimble of silver', 'one perfect snowflake, preserved', 'a length of rainbow thread', 'a weather charm'],
    },
    signatures: {
      wonder: [
        'Every cloud you have ever looked at was made here, by hand, by someone who cared about the shape of it.',
        'The weaver held up a strip of evening. It was exactly the colour of the last ten minutes of a good day.',
      ],
      settle: [
        'Up here, above all the weather, it was always quiet. The noise happened further down.',
        'The loom slowed. Tomorrow would need clouds, but tomorrow could wait.',
      ],
    },
    realWindow: {
      title: 'How Heavy Is a Cloud?',
      fact: 'An average fluffy white cloud weighs about as much as a hundred elephants. It floats because the air underneath it is even heavier.',
      credit: 'Cloud imagery courtesy of NOAA and NASA Earth Observatory.',
      source: 'NOAA',
    },
    episodeCount: 12,
  },
  {
    id: 'snowbell',
    name: 'Snowbell Hollow',
    emoji: '❄️',
    blurb: 'A valley under deep snow, where everyone looks after everyone.',
    palette: ['#0f1824', '#3d6b8f', '#d8f0ff'],
    lexicon: {
      places: ['the frozen lake', 'a cabin with a lit window', 'the pine tunnel', 'the hot spring', 'the snow bridge'],
      guides: ['an arctic fox with tidy paws', 'a reindeer who knew every path', 'the keeper of the warming hut', 'a snowy owl on early shift'],
      wonders: ['the northern lights arriving without warning', 'ice so clear you could see the fish thinking', 'a whole forest wearing white', 'breath turning to small clouds', 'a hare changing colour to match the snow'],
      obstacles: ['a drift deeper than expected', 'a frozen latch', 'a wind with sharp elbows', 'a path gone entirely white'],
      gentleThings: ['a stove glowing orange', 'a pair of enormous mittens', 'a bowl of soup', 'a fur-lined hood', 'a bed of pine needles'],
      sounds: ['snow squeaking underfoot', 'a fire popping', 'wind in the pines', 'ice singing on the lake', 'a shovel, far away'],
      treasures: ['an icicle that never melted', 'a brass bell', 'a knitted star', 'a stone warmed by the stove'],
    },
    signatures: {
      wonder: [
        'The lights came out green, then violet, moving the way a curtain moves when a window is open somewhere.',
        'Snow makes the whole world quieter. It is the only weather that turns the volume down.',
      ],
      settle: [
        'Every cabin in the hollow had a lamp in the window, so that nobody walking home would ever have to guess.',
        'Outside, it snowed. Inside, it did not. That was the entire arrangement, and it was a good one.',
      ],
    },
    realWindow: {
      title: 'Why Snow Is Quiet',
      fact: 'Fresh snow is full of tiny air pockets that soak up sound. A field after a snowfall can be measurably quieter than the same field the day before.',
      credit: 'Snow and ice imagery courtesy of the U.S. Geological Survey.',
      source: 'USGS',
    },
    episodeCount: 12,
  },
  {
    id: 'dustpaw',
    name: 'Dustpaw Gulch',
    emoji: '🌵',
    blurb: 'A desert town that only truly wakes up after sundown.',
    palette: ['#2a1508', '#9c5a2a', '#ffd9a0'],
    lexicon: {
      places: ['the porch of the general store', 'the dry riverbed', 'the water tower', 'a canyon with a good echo', 'the cactus garden'],
      guides: ['a jackrabbit in a waistcoat', 'the night-watch tortoise', 'a roadrunner in no hurry at all', 'the well-keeper'],
      wonders: ['a cactus flowering for one night only', 'stars so thick they looked spilled', 'a canyon holding the day’s warmth', 'a coyote singing to nobody', 'sand that glittered when kicked'],
      obstacles: ['a gate that had swollen shut', 'a rock in the boot', 'a slope of loose scree', 'a wind carrying grit'],
      gentleThings: ['a rocking chair', 'a canteen of cold water', 'a porch still warm from the sun', 'a woven blanket', 'shade at last'],
      sounds: ['a windmill turning slowly', 'crickets starting up', 'a screen door', 'wind over stone', 'a distant train'],
      treasures: ['a smooth red stone', 'a horseshoe', 'a jar of desert glass', 'a feather from a very rude bird'],
    },
    signatures: {
      wonder: [
        'The desert had been holding onto the sun all day. Now, in the dark, it was giving it back slowly, a little at a time.',
        'There were more stars over the gulch than there were people in the world. Somebody had done the arithmetic once.',
      ],
      settle: [
        'A desert night is cool and enormous, and it does not mind at all if you fall asleep in the middle of it.',
        'The windmill turned. The crickets kept time. Nothing in the gulch needed anything.',
      ],
    },
    realWindow: {
      title: 'Flowers That Bloom at Night',
      fact: 'The saguaro cactus opens its flowers only after dark, and each flower lasts less than a day. Bats do most of the pollinating on the night shift.',
      credit: 'Desert imagery courtesy of the U.S. Geological Survey.',
      source: 'USGS',
    },
    episodeCount: 12,
  },
  {
    id: 'kindlymachine',
    name: 'The Kindly Machine',
    emoji: '🤖',
    blurb: 'A workshop of small robots who fix small broken things.',
    palette: ['#14161f', '#4c5c7a', '#b9f0e0'],
    lexicon: {
      places: ['the repair bench', 'the parts drawer room', 'the oiling station', 'the courtyard of finished things', 'the quiet workshop'],
      guides: ['a robot the size of a teapot', 'the tool-sorting machine', 'an inventor with ink on her fingers', 'a clockwork sparrow'],
      wonders: ['a machine built entirely to water one plant', 'a thousand gears agreeing at once', 'a music box being repaired note by note', 'a robot learning to be gentle', 'a lamp that turned toward whoever was sad'],
      obstacles: ['a spring that leapt away', 'a screw one size too small', 'a diagram nobody could read', 'a stuck hinge'],
      gentleThings: ['a bench warmed by machines', 'a cushion of wound wool', 'a small robot that hummed', 'a blanket of soldering cloth', 'a steady blue standby light'],
      sounds: ['ticking, in several tempos', 'a soft mechanical whir', 'oil dripping', 'a tiny motor', 'gears meshing'],
      treasures: ['a brass cog', 'a spare bulb', 'a magnet', 'a screw of exactly the right size'],
    },
    signatures: {
      wonder: [
        'None of the robots here were built to be clever. They were built to be careful, which turns out to be harder.',
        'The workshop’s rule was written above the door: NOTHING IS THROWN AWAY UNTIL WE HAVE TRIED.',
      ],
      settle: [
        'One by one, the little machines went to standby, and their lights went from blue to the softest amber.',
        'Everything that had been broken that morning was mended. That was enough for one day.',
      ],
    },
    realWindow: {
      title: 'The First Robots Were Weavers',
      fact: 'Some of the earliest programmable machines were looms. They read patterns from cards with holes punched in them, more than two hundred years ago.',
      credit: 'Machine photographs courtesy of Smithsonian Open Access.',
      source: 'Smithsonian Open Access',
    },
    episodeCount: 12,
  },
  {
    id: 'pebblebrook',
    name: 'Pebblebrook',
    emoji: '🏡',
    blurb: 'An ordinary village where ordinary evenings go beautifully.',
    palette: ['#1c1410', '#8a6a4a', '#ffdfc0'],
    lexicon: {
      places: ['the bakery back door', 'the bridge over the brook', 'the allotments', 'the lane with the crooked wall', 'the square with the old pump'],
      guides: ['the baker, still floury', 'a cat who owned the lane', 'the postman on his last round', 'an old neighbour with good stories'],
      wonders: ['every kitchen window lighting up at once', 'bread cooling on a rack', 'the brook carrying one leaf all the way home', 'swallows going to bed in the eaves', 'the last child called in for supper'],
      obstacles: ['a gate latch too high to reach', 'a puddle across the whole lane', 'a shortcut that was longer', 'a wheelbarrow parked badly'],
      gentleThings: ['a warm doorstep', 'a slice of bread and butter', 'a knitted blanket', 'a windowsill in the sun', 'a cat on a lap'],
      sounds: ['a kettle', 'distant laughing', 'the brook', 'a gate closing', 'cutlery in a sink'],
      treasures: ['a smooth brook pebble', 'a button found in the lane', 'a pressed flower', 'a coin from before anyone remembered'],
    },
    signatures: {
      wonder: [
        'Nothing extraordinary happened in Pebblebrook. That was, in fact, the extraordinary thing about it.',
        'The whole village smelled of bread, because it always did, because that is what villages are for.',
      ],
      settle: [
        'One by one, the lights in Pebblebrook went out, each one meaning somebody had got safely to bed.',
        'The brook kept going all night, quietly, in case anybody needed something to listen to.',
      ],
    },
    realWindow: {
      title: 'Why Bread Smells So Good',
      fact: 'Baking bread creates hundreds of new smell molecules that did not exist in the dough. Your nose can detect some of them from three rooms away.',
      credit: 'Historical village photographs courtesy of the Library of Congress.',
      source: 'Library of Congress',
    },
    episodeCount: 12,
  },
  {
    id: 'amberwood',
    name: 'Amberwood',
    emoji: '🍂',
    blurb: 'A wood in permanent late autumn, where everything is being put away for winter.',
    palette: ['#22140a', '#a35a20', '#ffd28a'],
    lexicon: {
      places: ['the leaf drift', 'the squirrel’s store room', 'the orchard', 'the long avenue of beeches', 'the cider shed'],
      guides: ['a squirrel with a clipboard', 'a badger finishing the harvest', 'a wren with strong opinions', 'the keeper of the orchard'],
      wonders: ['ten thousand leaves coming down at once', 'apples stored in perfect rows', 'a tree letting go of its last leaf', 'mist standing in the low field', 'geese leaving in a long grey V'],
      obstacles: ['a basket too heavy to carry', 'a gate held shut by brambles', 'a hill that had got steeper', 'an acorn count that would not add up'],
      gentleThings: ['a nest lined with wool', 'a mug of warm cider', 'a drift of dry leaves', 'a woollen scarf', 'a bank of sun-warmed earth'],
      sounds: ['leaves underfoot', 'apples dropping', 'wind in bare branches', 'a robin’s late song', 'the creak of a full basket'],
      treasures: ['a conker, polished', 'a beech nut', 'a jar of honey', 'a leaf the colour of fire'],
    },
    signatures: {
      wonder: [
        'The whole wood was tidying up. Not sadly. The way you tidy when you know you will be back.',
        'Autumn is not an ending. It is the largest and most beautiful act of putting things away that anyone has ever organised.',
      ],
      settle: [
        'The stores were full. The nests were lined. Amberwood had done everything it needed to do.',
        'Winter was coming, and the wood was entirely ready, so there was nothing left to do but rest.',
      ],
    },
    realWindow: {
      title: 'Where Leaf Colours Come From',
      fact: 'The yellow and orange in autumn leaves was there all summer, hidden under the green. When the green fades, the colours that were always there finally show.',
      credit: 'Forest imagery courtesy of the U.S. Geological Survey.',
      source: 'USGS',
    },
    episodeCount: 12,
  },
  {
    id: 'singingreef',
    name: 'The Singing Reef',
    emoji: '🐠',
    blurb: 'A coral city that hums a different note in every district.',
    palette: ['#06171f', '#0f7a86', '#9ff5dd'],
    lexicon: {
      places: ['the staghorn quarter', 'the anemone gardens', 'the cleaning station', 'the sandy plaza', 'the archway of brain coral'],
      guides: ['a cleaner wrasse working late', 'a hermit crab between houses', 'a parrotfish making sand', 'an old grouper who watched everything'],
      wonders: ['coral spawning like slow snow going upward', 'a clownfish tucking itself in', 'a reef changing key at dusk', 'a turtle arriving from far away', 'every fish finding its own crevice at once'],
      obstacles: ['an archway grown too narrow', 'a current that kept nudging', 'a borrowed shell that did not fit', 'a shy eel in the doorway'],
      gentleThings: ['an anemone bed', 'a crevice exactly one fish wide', 'warm shallow water', 'a canopy of soft coral', 'a hollow under a ledge'],
      sounds: ['the crackle of shrimp', 'the reef humming', 'a parrotfish crunching', 'water moving through coral', 'a low distant boom'],
      treasures: ['a scale that caught the light', 'a perfect empty shell', 'a grain of pink sand', 'a piece of coral, fallen'],
    },
    signatures: {
      wonder: [
        'A reef at night sounds like rain on a tin roof, if the rain were ten thousand small shrimp all snapping at once.',
        'Every single fish on the reef knew exactly which crack in the coral was theirs. Nobody had to be told.',
      ],
      settle: [
        'The reef settled into its night note, lower than its day note, the way houses do.',
        'The clownfish pulled the anemone around itself like a duvet, and that was that.',
      ],
    },
    realWindow: {
      title: 'Reefs Are Noisy',
      fact: 'Scientists can tell whether a coral reef is healthy just by listening to it. Healthy reefs crackle and hum; sick ones go quiet.',
      credit: 'Reef imagery and acoustics courtesy of NOAA.',
      source: 'NOAA',
    },
    episodeCount: 12,
  },
  {
    id: 'nightmarket',
    name: 'The Nightmarket',
    emoji: '🏮',
    blurb: 'A market that opens at dusk and sells mostly warm things.',
    palette: ['#1c0f14', '#8f3a4a', '#ffc8a0'],
    lexicon: {
      places: ['the lantern row', 'the soup corner', 'the stall of borrowed books', 'the tea house steps', 'the square of small bridges'],
      guides: ['the soup seller', 'a pangolin who sold blankets', 'the lantern-lighter', 'a girl who knew all the shortcuts'],
      wonders: ['a hundred paper lanterns lit in sequence', 'steam rising from every stall at once', 'a fortune teller who only gave good news', 'noodles pulled longer than a person', 'a cat asleep on a pile of silk'],
      obstacles: ['a crowd going the other way', 'a coin short', 'a stall packing up early', 'a lantern that would not catch'],
      gentleThings: ['a bowl of broth', 'a bench beside a brazier', 'a quilt from the blanket stall', 'a cup of tea held in both hands', 'a step out of the wind'],
      sounds: ['sizzling', 'coins counted', 'a bell above a door', 'paper lanterns knocking together', 'somebody humming while they work'],
      treasures: ['a paper lantern of your own', 'a lucky knot of red thread', 'a wooden spoon', 'a sweet wrapped in wax paper'],
    },
    signatures: {
      wonder: [
        'The market did not sell anything you needed. It sold things you would be glad of, which is different and better.',
        'Every lantern in the row was a slightly different red, because they had all been made by different hands.',
      ],
      settle: [
        'The stalls came down one by one, and the lanterns stayed lit for whoever was still walking.',
        'The last of the steam went up into the cold, and the market let out a long, satisfied breath.',
      ],
    },
    realWindow: {
      title: 'Paper That Glows',
      fact: 'Traditional paper lanterns are made from mulberry bark, which is strong enough to survive rain and thin enough for light to pass straight through.',
      credit: 'Cultural artefact photographs courtesy of Smithsonian Open Access.',
      source: 'Smithsonian Open Access',
    },
    episodeCount: 12,
  },
  {
    id: 'rooftopowls',
    name: 'Rooftop Owls',
    emoji: '🦉',
    blurb: 'A whole city seen from above, by the birds who keep an eye on it.',
    palette: ['#0e1118', '#3f4a6b', '#ffd98f'],
    lexicon: {
      places: ['the water tower', 'a fire escape with a view', 'the roof garden', 'the clock tower ledge', 'the bridge cables'],
      guides: ['a tawny owl on night patrol', 'a pigeon who knew everyone', 'the peregrine from the bank building', 'a fox working the alleys'],
      wonders: ['the whole city coming on at once', 'traffic moving like slow glowing rivers', 'a plane crossing in front of the moon', 'a thousand windows, each with someone in it', 'the city breathing out its warm air'],
      obstacles: ['a gust between two buildings', 'a locked roof door', 'a gap wider than it looked', 'a siren going the wrong way'],
      gentleThings: ['a warm chimney pot', 'a ledge out of the wind', 'a roof still warm from the day', 'a nest of gathered scarves', 'a pocket of still air'],
      sounds: ['traffic softening', 'an owl calling', 'a distant train', 'wind around a corner', 'a window closing'],
      treasures: ['a lost key', 'a bottle cap that shone', 'a feather', 'a marble from a gutter'],
    },
    signatures: {
      wonder: [
        'From up here, the city was not loud at all. All that noise stayed down at street level, where it belonged.',
        'Every one of those lit windows was somebody. That was the thing that never stopped being astonishing.',
      ],
      settle: [
        'The city went quiet in layers, top floors first, the way snow settles.',
        'The owls kept watch, because that is what owls are for, and nobody down below had to think about it at all.',
      ],
    },
    realWindow: {
      title: 'Owls Fly Silently',
      fact: 'An owl’s wing feathers have a soft comb-like fringe that breaks up the air. It makes their flight almost completely silent, even to other owls.',
      credit: 'Urban wildlife photographs courtesy of Smithsonian Open Access.',
      source: 'Smithsonian Open Access',
    },
    episodeCount: 12,
  },
  {
    id: 'longtrain',
    name: 'The Long Train',
    emoji: '🚂',
    blurb: 'A sleeper train that has been travelling comfortably for years.',
    palette: ['#171118', '#5e4160', '#ffcfae'],
    lexicon: {
      places: ['the observation car', 'the dining car after hours', 'a bunk with a small window', 'the corridor of brass handles', 'the guard’s van'],
      guides: ['the night conductor', 'a cook who never slept', 'a very old dog who rode for free', 'the signalwoman at the crossing'],
      wonders: ['a bridge crossed in total darkness', 'a tunnel full of held breath', 'a herd of deer keeping pace', 'the moon following the whole way', 'a station passed without stopping'],
      obstacles: ['a bunk ladder one rung short', 'a door between carriages', 'a lost ticket', 'a delay at a signal'],
      gentleThings: ['a berth with clean sheets', 'the sway of the carriage', 'a blanket from the steward', 'a curtain drawn against the dark', 'hot chocolate in a paper cup'],
      sounds: ['wheels over joints in the rail', 'a whistle far ahead', 'the carriage creaking', 'rain on the window', 'a trolley in the corridor'],
      treasures: ['a punched ticket', 'a spoon from the dining car', 'a postcard never sent', 'a timetable for a line that no longer runs'],
    },
    signatures: {
      wonder: [
        'The train did not care where anyone was going. It simply went, all night, and that was enormously relaxing.',
        'Somewhere ahead the rails were being laid down by the dark and taken up again behind.',
      ],
      settle: [
        'A train is the only bed in the world that travels while you sleep in it.',
        'Ta-tum. Ta-tum. The rails kept a rhythm nobody had to keep up with.',
      ],
    },
    realWindow: {
      title: 'Why Trains Go Ta-Tum',
      fact: 'That steady clicking comes from small gaps between rails, left on purpose so the steel can expand on hot days without buckling.',
      credit: 'Railway photographs courtesy of the Library of Congress.',
      source: 'Library of Congress',
    },
    episodeCount: 12,
  },
  {
    id: 'bumblewick',
    name: 'Bumblewick Farm',
    emoji: '🐑',
    blurb: 'A farm at the end of the day, when all the animals are being counted in.',
    palette: ['#1a1608', '#7d7024', '#ffe9a0'],
    lexicon: {
      places: ['the barn loft', 'the duck pond', 'the orchard fence', 'the hen house', 'the long meadow'],
      guides: ['a sheepdog finishing her rounds', 'the oldest ewe', 'a goose in charge of everything', 'the farmer with a lantern'],
      wonders: ['every animal counted in and none missing', 'swallows sweeping the yard at dusk', 'a lamb finding its mother in the dark', 'hay warm from the day', 'the pond going perfectly flat'],
      obstacles: ['a gate left open', 'one sheep short in the count', 'a stubborn goat', 'a wheelbarrow in the way'],
      gentleThings: ['a loft full of hay', 'a woollen fleece', 'a warm flank to lean on', 'a bucket of oats', 'straw fresh from the bale'],
      sounds: ['hens muttering', 'a cow shifting her weight', 'the dog’s tail on the floor', 'wind in the barn roof', 'water in the trough'],
      treasures: ['a speckled feather', 'a lump of beeswax', 'a horseshoe nail', 'a very good stick'],
    },
    signatures: {
      wonder: [
        'The dog did the count twice, because she always did it twice, because that is what makes a good dog.',
        'Everything on the farm had somewhere to be at sundown, and every single one of them knew where.',
      ],
      settle: [
        'All counted. All in. All safe. The barn door closed with a sound like a full stop.',
        'Hay smells like a summer afternoon that has been carefully saved up for a winter night.',
      ],
    },
    realWindow: {
      title: 'Sheep Know Faces',
      fact: 'Sheep can recognise and remember at least fifty different faces, both sheep and human, for over two years.',
      credit: 'Agricultural photographs courtesy of the Library of Congress.',
      source: 'Library of Congress',
    },
    episodeCount: 12,
  },
  {
    id: 'paperkingdom',
    name: 'The Paper Kingdom',
    emoji: '📜',
    blurb: 'A whole country folded out of paper, and it rustles when it dreams.',
    palette: ['#1b1512', '#8a7355', '#ffeccc'],
    lexicon: {
      places: ['the folded forest', 'the library of blank pages', 'the crease bridge', 'the origami harbour', 'the hall of thousand cranes'],
      guides: ['a paper crane with careful wings', 'the royal folder', 'a bookmark who had seen everything', 'a small paper elephant'],
      wonders: ['a thousand cranes taking off together', 'a mountain unfolding into a flat sheet', 'a story writing itself politely', 'rain that would ruin everything, held back', 'a boat folded and launched in one breath'],
      obstacles: ['a fold in the wrong place', 'a corner turning damp', 'a page stuck to another page', 'a wind with bad manners'],
      gentleThings: ['a bed of soft tissue', 'a paper blanket, warmer than it looks', 'a page-marker to keep your place', 'a folded shelter', 'a lantern of rice paper'],
      sounds: ['pages turning', 'a sharp clean fold', 'paper rustling', 'a book closing', 'a pencil, somewhere'],
      treasures: ['a crane folded just for you', 'a bookmark of gold paper', 'a blank page', 'a stamp from nowhere real'],
    },
    signatures: {
      wonder: [
        'Nothing in the Paper Kingdom was thrown away. A mistake was simply unfolded and made into something else.',
        'Every crane in the hall had been folded by somebody making a wish. The hall was very, very full.',
      ],
      settle: [
        'The kingdom folded itself down for the night, corner to corner, neat as a letter going into an envelope.',
        'A closed book is the safest place in the world. Everyone inside it is exactly where they were left.',
      ],
    },
    realWindow: {
      title: 'Folding Space Telescopes',
      fact: 'Engineers use origami to design spacecraft. Some telescope sunshields are folded up to fit in a rocket and then unfold in space, bigger than a tennis court.',
      credit: 'Spacecraft imagery courtesy of NASA.',
      source: 'NASA',
    },
    episodeCount: 12,
  },
  {
    id: 'tidepool',
    name: 'Tidepool Lane',
    emoji: '🐚',
    blurb: 'A seaside street where the tide comes right up to the front gates.',
    palette: ['#0d1a20', '#3f7d8c', '#cdeef0'],
    lexicon: {
      places: ['the rock pools', 'the pier at low tide', 'the shell shop', 'the harbour wall', 'the beach hut row'],
      guides: ['a hermit crab with a good house', 'the harbourmaster', 'a seal who surfaced for gossip', 'a gull who had retired'],
      wonders: ['the whole bay turning silver', 'a starfish moving, slowly, on purpose', 'the tide going out and leaving treasure', 'phosphorescence in the shallows', 'a boat coming home with its lights on'],
      obstacles: ['a rock slippery with weed', 'a pool deeper than it looked', 'a knot in the mooring rope', 'a wave with poor timing'],
      gentleThings: ['a beach hut with a stove', 'dry sand above the tide line', 'a towel warmed on a rail', 'a hollow in the rocks', 'a boat rocking at anchor'],
      sounds: ['waves on shingle', 'rigging tapping masts', 'gulls settling', 'water draining from rock', 'a rope creaking'],
      treasures: ['a mermaid’s purse', 'a cowrie shell', 'a piece of blue sea glass', 'a stone with a hole through it'],
    },
    signatures: {
      wonder: [
        'A rock pool is a whole ocean that has agreed to be small for a few hours.',
        'The tide never once, in all of history, forgot to come back.',
      ],
      settle: [
        'The boats knocked gently against each other in the harbour, all night, like friends jostling.',
        'The sea went in and out, in and out, breathing for the whole street.',
      ],
    },
    realWindow: {
      title: 'The Moon Pulls the Sea',
      fact: 'Tides happen because the Moon’s gravity tugs on the ocean. The water on the far side of Earth bulges out too, which is why most places get two high tides a day.',
      credit: 'Tide data and coastal imagery courtesy of NOAA.',
      source: 'NOAA',
    },
    episodeCount: 12,
  },
  {
    id: 'lastlighthouse',
    name: 'The Last Lighthouse',
    emoji: '🗼',
    blurb: 'One light at the edge of everything, and it never goes out.',
    palette: ['#0c1420', '#2f5a7d', '#ffe3b0'],
    lexicon: {
      places: ['the lamp room', 'the spiral of iron stairs', 'the keeper’s kitchen', 'the gallery in the wind', 'the landing rock'],
      guides: ['the keeper, who had been there always', 'a storm petrel taking shelter', 'the old cat of the lamp room', 'a ship’s captain, grateful'],
      wonders: ['the beam sweeping out across the black water', 'a storm passing entirely by', 'ships answering with their own lights', 'the lens turning on its bath of mercury', 'dawn arriving from a very long way off'],
      obstacles: ['a wick that wanted trimming', 'a window crusted with salt', 'stairs that went on and on', 'a gale against the door'],
      gentleThings: ['a kitchen below the storm', 'a bunk built into the wall', 'a stove and a kettle', 'an oilskin coat', 'the steady turn of the light'],
      sounds: ['the lens turning', 'wind at the glass', 'the sea against rock', 'a foghorn, twice', 'rain going sideways'],
      treasures: ['a brass wick-trimmer', 'a logbook', 'a lens prism', 'a stone from the landing rock'],
    },
    signatures: {
      wonder: [
        'The light did not shine for anyone in particular. It shone for everyone, which is a harder and better job.',
        'Out there in the dark, somebody saw the beam, and knew exactly where they were, and stopped being afraid.',
      ],
      settle: [
        'The lamp turned. It had turned all last night and it would turn all tomorrow night, without ever being asked.',
        'You can sleep through any storm at all, if you know somebody is keeping the light on.',
      ],
    },
    realWindow: {
      title: 'Lenses Made of Rings',
      fact: 'Lighthouse lenses are built from rings of glass called Fresnel lenses. They bend scattered light into one straight beam that can be seen more than twenty miles out to sea.',
      credit: 'Lighthouse photographs courtesy of NOAA and the Library of Congress.',
      source: 'NOAA',
    },
    episodeCount: 12,
  },
];

export const WORLD_BY_ID = new Map(WORLDS.map((w) => [w.id, w]));

export function getWorld(id: string): World {
  const world = WORLD_BY_ID.get(id);
  if (!world) throw new Error(`Unknown world: ${id}`);
  return world;
}
