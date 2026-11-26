# How the bots work

Code in [`src/ai/`](../src/ai). Each bot has a **personality** (a set of numbers, in
[`src/config.ts`](../src/config.ts)) and decides the next street every time it reaches an intersection.

## The four personalities

With `CFG.botBrain = 'smart'` (default), each color is a way of playing:

| Color    | Personality   | How it plays                                                                                      |
| -------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Red      | **hunter**    | Goes after enemy flags and whoever is leading, chases lightly and defends its own flags from anyone approaching. |
| Purple   | **cautious**  | Loops far from enemies (risk weight 2.8) and dodges almost every shot.                            |
| Orange   | **greedy**    | Bigger loops (1.35×) and a preference for stealing: tries to conquer a lot at once.               |
| (test)   | **classic**   | The original behavior: no reaction, all identical. Exists as the reference opponent.              |

The three "smart" ones share a base (`SMART`, in `config.ts`) **found by evolutionary search** (see below) and
differ only by moderate variations of it, so they have similar strength and different styles. With `CFG.botBrain = 'classic'`,
the three bots become classic.

The fields of a personality (`Personality`) are: `loopMul`, `planTries`, `riskWeight`, `stealBonus`, `leaderBias`,
`huntFlagP`, `chaseP`, `chaseSteps`, `dodge` and `defend`, all explained in `config.ts`.

## Three decision layers

[`ai/bot.ts`](../src/ai/bot.ts), in `botPick`, at every intersection:

1. **Reaction (`defend`)**: is an enemy coming in the direction of one of my flags, close (≤ 120 px)? I widen the route and
   intercept it for 2 steps. Only applies with 2+ flags planted, and someone merely passing by doesn't count.
2. **Deliberation (`botThink`)**: with no route, decides: follow the plan; hunt the nearest enemy flag; chase an
   enemy; or plan a new conquest. The scoreboard leader is a preferred target (`leaderBias`).
3. **Dodge (`dodge`)**: does the chosen street run inside someone's line of fire? Swap it for a side street that still gets
   close to the destination. Crossing the line sideways doesn't count; the danger is walking along it.

State of each bot: `plan` (flags to plant, ending at the first one to close the loop) and `route` (nodes to the
immediate destination, by shortest path). On reaching the next point of the plan, it plants the flag with the same `plant()` the player uses.
With no route at all, it turns onto any street.

### Perception ([`ai/perception.ts`](../src/ai/perception.ts))

Read-only access to the state:

- `incomingFire`: the shot each enemy whose reload is finishing would fire now **and** the remaining path of the shots in flight.
  Reuses `traceShot`/`tracePath`, the same calculation as your dotted preview.
- `edgeExposed`: would walking along a street follow inside any of these lines?
- `chainThreat`: is an enemy about to destroy one of my flags?

## Planning a conquest ([`ai/planner.ts`](../src/ai/planner.ts))

Random sampling with scoring:

1. `planTries` attempts. Each one draws a center near the bot and 3 to 5 points on a circle of radius 70–190, and uses the
   nearest intersection to each one.
2. Discards loops with a perimeter greater than `botMaxLoop × loopMul`.
3. **Gain** = area of the blocks that aren't already its own. A block owned by someone else is worth `stealBonus`× (and even more if
   the owner is the leader, via `leaderBias`).
4. **Score** = `gain / (perimeter + distance·0.6 + 200 + riskWeight·risk)`. The **risk** adds, for each pair
   (enemy, flag of the loop), how close the enemy is (up to 300 px). Reaching a flag destroys the entire chain,
   so loops with opponents nearby are worth less.
5. Rotates the list to start from the nearest flag and repeats the first one at the end.

## Combat ([`ai/combat.ts`](../src/ai/combat.ts))

In `street` mode, the bot simulates its own shot and only fires if the path would pass through a living enemy without invulnerability.
It **doesn't aim or turn**: it fires where it is facing, hoping to hit. Reload: `botShotCd` (1.0 s), versus the
player's `shotCd` (0.45 s). Everyone shoots at everyone.

## Evolutionary search (`npm run evolve`)

The parameters of the `SMART` base were not chosen by hand: they came from an Evolution Strategy in
[`sim/evolve.sim.ts`](../sim/evolve.sim.ts). In each generation, it draws 12 variations of the current parameters, plays 16 matches
of 4 with each (against the classic and the reference personalities, in all corners) and keeps the average of the
best ones. All candidates in a generation play on the same seeds, and the seeds change every generation.

Two independent searches, one starting from the greedy and another from the **pure classic**, reached similar regions:

| Parameter    | Search A | Search B | What we concluded                                                   |
| ------------ | -------- | -------- | ------------------------------------------------------------------- |
| `planTries`  | 53       | 48       | Planning with many more attempts pays off (the allowed ceiling was 60). |
| `riskWeight` | 1.9      | 2.3      | **Giving a lot of weight to risk** (enemies near the flags) helps a lot. |
| `stealBonus` | 1.6      | 1.4      | Preferring to steal blocks from others.                             |
| `huntFlagP`  | 0.11     | 0.10     | Hunting flags yields little (it had already shown up in manual measurements). |
| `chaseP`     | 0.12     | 0.09     | Chasing too.                                                        |
| `loopMul`    | 1.14     | 1.31     | Moderately large loops.                                             |
| `dodge`      | 0.79     | 0.37     | **Did not converge**: territory depends little on this.             |
| `defend`     | 0.49     | 0.12     | **Did not converge**, likewise.                                     |

`SMART` is the average of the two. In unseen matches, this average won **83% against the classic** and **60% against the best bot
from the previous version**, which I had tuned by hand over several rounds. Each personality's variations were chosen
to not stray too far from this region (straying too far cost strength).

## What was measured by hand (and what didn't work)

Before evolution, each idea was tested in isolation against the classic with `npm run sim` (see
[ARCHITECTURE.md](ARCHITECTURE.md)). Wins in a head-to-head matchup; 50% = tie:

| Idea                                     | Wins     | Reading                                                              |
| ---------------------------------------- | -------- | -------------------------------------------------------------------- |
| Planning with 40 attempts (instead of 14) | ~61–65%  | **The biggest lever.** 80 attempts don't improve it.                 |
| Shot dodging                             | ~51%     | Deaths drop by about a third, without losing territory.              |
| Focus on the leader                      | ~54%     | Small gain.                                                          |
| Risk in planning (weight 1)              | ~49%     | Neutral alone; only paid off a lot later, in combination (see above). |
| Stealing more (×1.8)                     | ~47%     | Worse alone: taking free land is also valuable.                      |
| Long chase (30%, 4 steps)                | ~32%     | **Worse.** Killing doesn't earn territory; it just wastes time and risks dying. |
| Wide defense (220 px, 3 steps)           | ~22–32%  | **Worse.** Abandons the plan and walks into the line of fire.        |
| Lean defense (120 px, 2 steps, 30%)      | +~5 pts  | Small gain for the hunter, confirmed in two independent samples.     |

Note how risk in planning was "neutral" alone and ended up being one of the most valued parameters by evolution:
the effects combine, and adjusting one at a time by hand doesn't see that. It's the argument for automatic search.

## Current version scoreboard

In matches never used to tune anything (100 seeds x 2 layouts, 200 matches per row):

| Personality | vs classic (base 50%) | vs best old bot (base 50%) | In a 4-way fight (base 25%) |
| ----------- | --------------------- | -------------------------- | --------------------------- |
| greedy      | 79%                   | 59%                        | 32%                         |
| cautious    | 82%                   | 63%                        | 30%                         |
| hunter      | 71%                   | 55%                        | 30%                         |
| classic     | (reference)           | —                          | 8%                          |

In the previous version (tuned by hand), the same measurements gave 68%, 51% and 55% against the classic, and the classic got
18% in the four-way fight. The current bots also die 29% to 43% less than the classic. With 200 matches the error is about
±3 points: smaller differences may be luck.

Processing cost: 0.02 ms per frame on average and 0.7 ms in the worst 0.1% (an isolated spike of ~9 ms in 20k frames, when
shortest paths are computed for the first time), well below the 16 ms of a frame.

## Known limitations

- **They are still omniscient**: they read the position and flags of everyone, without "seeing".
- **They don't aim**: they only shoot when they happen to be lined up along the street.
- **They plan by sampling** (50 attempts at a time), not by systematic search.
- **`dodge` and `defend` were left without fine-tuning**: evolution couldn't tell them apart, because territory barely depends on them.
- Dodging only acts at intersections and only in the `street` shooting mode.
- The three personalities are similar in strength. The differences are in style (where and how they play), not in level.
