import type { ArcSkeleton } from '../engine/types';

/**
 * Narrative skeletons. Each stage is a list of sentence slots; each slot holds
 * variants. The generator picks one variant per slot with a seeded RNG, so a
 * given (child, world, episode) always produces the same story, and different
 * episodes produce genuinely different ones.
 *
 * Tokens are substituted at RENDER TIME, on-device. The child's name is never
 * part of any generated text before this step, which is what keeps PII local.
 */

export const ARCS: ArcSkeleton[] = [
  {
    id: 'journey',
    name: 'The Journey',
    stages: {
      call: [
        [
          '{child} could not sleep, which happens to everyone sometimes.',
          'It was late in {world}, and {child} was the only one still awake.',
          'The lamp was off, but {child} was not quite finished with the day.',
        ],
        [
          'So {they} sat up, and listened, and heard {sound}.',
          'So {they} went to the window, and there it was again: {sound}.',
          'And then, very faintly, {they} heard {sound}.',
        ],
        [
          '{companion} the {companionSpecies}, {trait}, was already awake and already waiting.',
          'Beside {them}, {companion} the {companionSpecies}, {trait}, opened one eye.',
          '{companion}, {trait}, made the small noise that meant *come on, then*.',
        ],
      ],
      threshold: [
        [
          'Together they went out towards {place}.',
          'They set off for {place}, which was not far, but was far enough to be an adventure.',
          'The way to {place} was easy to find, once you knew to look.',
        ],
        [
          'The air was cool and smelled the way night smells.',
          'Everything was the colour things go when the sun has finished with them.',
          'It was the sort of dark that is friendly rather than frightening.',
        ],
        [
          'At the edge of {place}, {guide} was waiting, as though this had all been arranged.',
          'There, sitting exactly where you would want somebody to be sitting, was {guide}.',
          '"You came," said {guide}, who did not seem surprised at all.',
        ],
      ],
      wonder: [
        [
          '{guide} showed {them} {wonder}.',
          'And then {guide} pointed, and {child} saw {wonder}.',
          '"Look," said {guide}, and {child} looked, and there was {wonder}.',
        ],
        [
          '{child} had never seen anything like it, and stood very still, the way you do.',
          '{child} did not say anything for a while. Some things do not need it.',
          '{companion} made a small sound. It was the right sound.',
        ],
        [
          'It was even better than {interest}, and {child} was extremely fond of {interest}.',
          '{child} thought about it the way {they} thought about {interest}: carefully, and with a whole heart.',
          'It was the sort of thing {they} would want to tell somebody about, tomorrow, when there was time.',
        ],
      ],
      wobble: [
        [
          'But there was {obstacle}.',
          'There was, however, {obstacle}, sitting squarely in the way.',
          'Then they came to {obstacle}, and stopped.',
        ],
        [
          '{child} tried once, and it did not work.',
          'The first idea was a good idea, and it did not work either.',
          'For a moment it seemed like the sort of thing that would need a grown-up.',
        ],
        [
          '{companion} pressed close against {them}, warm and certain.',
          '{companion} did not seem worried, which helped.',
          '{child} took a breath. {companion} took one too, more or less.',
        ],
      ],
      helper: [
        [
          'Then {guide} said the useful thing: "Try it slower. Slower nearly always works."',
          '"You do not have to solve it," said {guide}. "You only have to start it."',
          '"Ah," said {guide}. "That one. Everybody meets that one."',
        ],
        [
          'So {child} tried it slower, and it gave way almost at once.',
          'So {child} started it, and the rest turned out to be much easier than the beginning.',
          'It took three goes. The third one worked.',
        ],
        [
          '{companion} looked extremely pleased, in the particular way a {companionSpecies} does.',
          '"There," said {guide}, as if there had never been any doubt.',
          '{child} laughed, which is a very good sound to make at night.',
        ],
      ],
      resolve: [
        [
          'On the way back, {guide} gave {them} {treasure} to keep.',
          '{guide} pressed {treasure} into {their} hand and said, "For remembering."',
          'In {their} pocket, without quite knowing how it got there, was {treasure}.',
        ],
        [
          'The walk home was shorter, the way walks home always are.',
          'They went back past {place}, and everything was where they had left it.',
          'Behind them, {wonder2} carried on without them, which was somehow lovely.',
        ],
        [
          'Somewhere, {sound2}.',
          '{sound2}, far off and unhurried.',
          'The night had settled into {sound2}, and stayed there.',
        ],
      ],
      settle: [
        [
          'There was {gentle} waiting.',
          '{child} found {gentle}, which was exactly right.',
          'Somebody had left out {gentle}. Somebody always did.',
        ],
        [
          '{companion} curled up in the warm hollow behind {their} knees.',
          '{companion} turned around three times and settled, the way a {companionSpecies} must.',
          '{companion} was already asleep. {companion} was very good at it.',
        ],
        [
          '{child} closed {their} eyes.',
          'And {child}, warm and done with the day, let {their} eyes close.',
          '{their} eyes were already closing, and {they} let them.',
        ],
        [
          'Goodnight, {child}. Goodnight, {companion}. Goodnight, {world}.',
          'Sleep well, {child}. {world} will still be here tomorrow.',
          'And {world} went quiet, and {child} slept.',
        ],
      ],
    },
  },
  {
    id: 'mystery',
    name: 'The Small Mystery',
    stages: {
      call: [
        [
          'Something was different in {world} that evening, and {child} noticed it first.',
          'In {world}, something small had gone missing, and nobody could say what.',
          '{child} woke up certain that something was not where it should be.',
        ],
        [
          'It was nothing serious. It was just *odd*.',
          'Not a bad kind of different. The interesting kind.',
          'Nothing was wrong, exactly. Things were simply out of order.',
        ],
        [
          '{companion} the {companionSpecies}, {trait}, had noticed it too.',
          '{companion}, {trait}, was already standing by the door with an expression about it.',
          'Beside {them}, {companion} the {companionSpecies} had gone very alert.',
        ],
      ],
      threshold: [
        [
          'The first clue was at {place}.',
          'They started at {place}, because that is where sensible people start.',
          '{companion} led {them} straight to {place} without being asked.',
        ],
        [
          'There was {sound}, and then there was not.',
          'They could hear {sound}, but only if they stopped walking.',
          'Everything was quiet except for {sound}.',
        ],
        [
          '{guide} was there, being no help at all, and entirely delightful about it.',
          '"Oh, *that*," said {guide}. "Yes. I have been wondering about that for an hour."',
          '{guide} joined them, because {guide} was curious too.',
        ],
      ],
      wonder: [
        [
          'The trail led somewhere unexpected: {wonder}.',
          'What they found instead was {wonder}.',
          'And that was when they saw it — {wonder}.',
        ],
        [
          '{child} forgot, for a moment, what they had been looking for.',
          'It was the kind of thing that makes a mystery seem much less urgent.',
          'Nobody said anything. There was nothing that needed saying.',
        ],
        [
          '"I did not know {world} could do that," said {child}.',
          '{child} thought it was better than {interest}, and {they} loved {interest} very much.',
          '"It does that every night," said {guide}. "Nearly nobody is awake for it."',
        ],
      ],
      wobble: [
        [
          'Then they remembered the mystery, and ran straight into {obstacle}.',
          'Of course, there was still {obstacle} to get past.',
          'But between them and the answer sat {obstacle}.',
        ],
        [
          'It was the kind of problem that does not care how clever you are.',
          '{child} pushed. Then {they} pulled. Neither helped.',
          'They looked at it for a long moment.',
        ],
        [
          '{companion} sat down. {companion} often had ideas while sitting down.',
          '{companion} did something small and completely unexpected.',
          '"Hm," said {guide}, in the tone of somebody who had an idea and wanted you to have it first.',
        ],
      ],
      helper: [
        [
          '"What if it was never lost?" said {child}, slowly.',
          'And then {child} understood, all at once, the way understanding usually arrives.',
          '"Oh," said {child}. "*Oh.*"',
        ],
        [
          'It had been at {place} the entire time, being perfectly fine.',
          'It had not been taken. It had simply been *put somewhere sensible* by somebody thoughtful.',
          'Nothing had gone missing at all. It had only been tidied.',
        ],
        [
          '{guide} laughed, and it was a good laugh, with no meanness in it anywhere.',
          '"Well spotted," said {guide}. "That took me until dawn, the first time."',
          '{companion} looked deeply satisfied and slightly smug.',
        ],
      ],
      resolve: [
        [
          'For solving it, {child} was given {treasure}.',
          '{guide} handed over {treasure}, which was the traditional reward for noticing things.',
          '{child} kept {treasure}, and nobody minded.',
        ],
        [
          'They walked back the long way, so they could pass {wonder2} again.',
          'Behind them, {wonder2} kept doing what it had always done.',
          '{world} carried on being {world}, which was reassuring.',
        ],
        [
          'Somewhere, {sound2}.',
          'All the way home, {sound2}.',
          'The only sound left was {sound2}.',
        ],
      ],
      settle: [
        [
          '{gentle} was waiting, and it had been waiting a while.',
          '{child} climbed into {gentle}.',
          'Then there was {gentle}, and nothing else to do.',
        ],
        [
          '{companion} tucked {their} feet in, more or less on purpose.',
          '{companion} arranged into the smallest possible shape a {companionSpecies} can make.',
          '{companion} was warm. {companion} was always warm.',
        ],
        [
          'Mysteries keep beautifully overnight.',
          'Everything that had been strange was ordinary again, and ordinary is a lovely thing to sleep in.',
          '{child} thought about it for one more second, and then did not.',
        ],
        [
          'Goodnight, {child}. Goodnight, {companion}. Goodnight, {world}.',
          'Sleep well, {child}. Nothing is missing.',
          'And {world} went quiet, and {child} slept.',
        ],
      ],
    },
  },
  {
    id: 'helper',
    name: 'The Helper',
    stages: {
      call: [
        [
          'In {world} that night, somebody needed a hand.',
          'It was late in {world}, and {child} heard somebody who needed help.',
          'The knock came at the very end of the day, the way knocks do.',
        ],
        [
          'Not an emergency. Just the sort of thing that is hard on your own.',
          'It was a small problem. Small problems are still real.',
          'Nobody was in danger. Somebody was simply stuck.',
        ],
        [
          '{companion} the {companionSpecies}, {trait}, was up before {child} was.',
          '{companion}, {trait}, was already at the door.',
          '{companion} the {companionSpecies} gave {them} a look that meant *well, obviously*.',
        ],
      ],
      threshold: [
        [
          'It was {guide}, out at {place}, running out of evening.',
          'They found {guide} at {place}, looking tired and trying not to show it.',
          '{guide} was at {place}, still working, long after {guide} should have stopped.',
        ],
        [
          'You could hear {sound} from a long way off.',
          '{sound} came from somewhere near the back.',
          'The only sound was {sound}, and it sounded like hard work.',
        ],
        [
          '"You do not have to," said {guide}. "I know," said {child}, and rolled up {their} sleeves.',
          '"Show me," said {child}, which is one of the best things a person can say.',
          '{child} did not ask whether {they} could help. {they} just started helping.',
        ],
      ],
      wonder: [
        [
          'And while they worked, {wonder} happened, right above them.',
          'Halfway through, they stopped, because {wonder}.',
          'Then {guide} said, "Wait. Watch," and there was {wonder}.',
        ],
        [
          '{child} stood with {their} hands still full and simply watched.',
          'Work is much easier when something like that is going on overhead.',
          '{companion} sat down in the middle of everything to look properly.',
        ],
        [
          '"That is why I do this job," said {guide}, quietly.',
          '{child} thought it was as good as {interest}, and {they} loved {interest} more than most things.',
          '"Every night," said {guide}. "Every single night, and it never gets old."',
        ],
      ],
      wobble: [
        [
          'But they still had {obstacle} to deal with.',
          'The last part was the hard part: {obstacle}.',
          'Which left {obstacle}, and no obvious way around it.',
        ],
        [
          '{child} was tired now, properly tired, in the arms and the legs.',
          'It was the point in a job where everybody wants to stop.',
          '{guide} sighed. It was a very small sigh, but {child} heard it.',
        ],
        [
          '{companion} leaned against {their} leg and stayed there.',
          '{companion} did not say anything useful, because {companion} could not, but it helped anyway.',
          '{child} looked at {guide}, and {guide} looked back, and neither of them stopped.',
        ],
      ],
      helper: [
        [
          'So they did it together, which is the whole trick.',
          '"Two of us," said {child}. "That is different."',
          'It turned out to be easy with four hands, or two hands and some paws.',
        ],
        [
          'And then it was done, and it had not even taken long.',
          'It gave way all at once, the way difficult things do at the very end.',
          'The last bit took about a minute, once there were two of them.',
        ],
        [
          '{guide} let out a long breath. "Well," said {guide}. "Well, well."',
          '"Thank you," said {guide}, and meant it entirely.',
          '{companion} looked like {companion} had done most of it personally.',
        ],
      ],
      resolve: [
        [
          '{guide} gave {child} {treasure}, and would not take no for an answer.',
          '"Take {treasure}," said {guide}. "You have earned it and I insist."',
          '{child} went home with {treasure} and a warm feeling in {their} chest.',
        ],
        [
          'They walked back past {place}, finished and pleased.',
          'Behind them, {wonder2} went on, uninterrupted.',
          'Everything in {world} was in order again, because somebody had bothered.',
        ],
        [
          'Somewhere, {sound2}.',
          'The night had gone soft, and {sound2}.',
          'Now there was only {sound2}, far away.',
        ],
      ],
      settle: [
        [
          'And at the end of it, {gentle}.',
          '{gentle} had never felt so good.',
          'Waiting for {them} was {gentle}, which is what you get after a job well done.',
        ],
        [
          '{companion} flopped down beside {them} with a small thump.',
          '{companion} was asleep before {child} had finished lying down.',
          '{companion} pressed one warm side against {them} and went still.',
        ],
        [
          'Helping somebody is very tiring, in the best possible way.',
          '{child}’s arms ached pleasantly. {their} eyes were already closing.',
          'There is a particular kind of sleep that comes after helping. This was that kind.',
        ],
        [
          'Goodnight, {child}. Goodnight, {companion}. Goodnight, {world}.',
          'Sleep well, {child}. You were kind today.',
          'And {world} went quiet, and {child} slept.',
        ],
      ],
    },
  },
];

export const ARC_BY_ID = new Map(ARCS.map((a) => [a.id, a]));
