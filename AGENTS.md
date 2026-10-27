# What We Sow

## Project Overview

**What We Sow** is a single-player, browser-based farming game combining the accessible, addictive gameplay of classic FarmVille with a morally consequential narrative spanning 40 in-game years, or 160 seasonal turns, as a lone farm grows into a small farming community.

Players build and expand a farm through simple, satisfying farming mechanics while making difficult choices that shape their family, community, environment, and legacy.

**Core premise:** You reap what you sow. The farm you build reflects the choices you make.

### Context

- Built for a hackathon whose challenge is to build something that advances the case for free enterprise.
- The game's purpose is to help players understand individual rights and why they matter to their own flourishing, by living through the consequences rather than being told.
- Intended players include business leaders and others whose views people take seriously.

## Game Design Principles

1. **Fun first.** The farming loop must be intrinsically enjoyable, independent of the narrative. Prioritize satisfying interactions, visible progression, rewarding harvests, and meaningful upgrades.
2. **FarmVille, not Stardew Valley.** Gameplay centers on managing a farm from a fixed isometric perspective, not walking a character around an RPG world. Players click to plant, harvest, build, arrange, and expand.
3. **Simple to learn, rewarding to optimize.** Keep individual actions intuitive while allowing increasingly interesting decisions about crops, land, resources, and investments.
4. **Choices have consequences.** Moral decisions must meaningfully affect gameplay, relationships, the environment, and future events—not merely change dialogue or abstract morality scores.
5. **Make the case through consequences, not lectures.** The game has a point of view: individual rights to your land, your labor, and the fruits of your work are what let people and communities flourish. Express it only through how the world responds to choices. Collectivist options must be genuinely tempting, often paying off in the moment; their costs emerge over years. Avoid simplistic good-versus-evil choices.
6. **A lifetime of consequences.** Decisions should compound across decades. The world, characters, and farm evolve visibly over time.
7. **Accessible and approachable.** Favor broad appeal, intuitive controls, short feedback loops, and minimal friction over complicated simulation mechanics.
8. **Show, don't tell.** Let changing landscapes, buildings, relationships, farm productivity, and the community's fortunes communicate the consequences of decisions.

## Core Gameplay

The primary loop is inspired by classic FarmVille:

1. **Plant:** Select crops and plant them on available plots.
2. **Grow:** Advance in-game time as crops progress through visible growth stages.
3. **Harvest:** Collect crops for money, experience, and other rewards.
4. **Reinvest:** Purchase seeds, upgrades, buildings, animals, and additional land.
5. **Expand:** Build a larger, more productive, personalized farm.
6. **Repeat:** Unlock new possibilities and develop increasingly sophisticated farming strategies.

Interactions should be immediate, visually satisfying, and rewarding. Avoid unnecessary micromanagement.

### Time and Progression

- Each turn represents one season: spring, summer, fall, or winter.
- Each year consists of four seasonal turns. A complete game spans exactly 40 in-game years, for a total of 160 turns.
- Years provide the overarching progression structure, with seasons governing farming activity.
- Every season reskins the farm's visuals to match the current season, including the palette, terrain, vegetation, and environmental details.
- Use accelerated in-game time rather than real-world waiting periods.
- Each year should offer meaningful economic progress and new opportunities.
- Major narrative events occur at predefined or conditionally triggered points throughout the timeline.
- The experience should have a deliberate beginning, middle, and end, culminating in the player's legacy.

### From One Farm to a Community

- The player starts as a solo farmer.
- Over time, other farmers settle nearby and a small community forms.
- As it grows, conflicts arise between individualist and collectivist farmers.
- The game raises problems for the community to solve; the player's responses shape how it develops.
- The community's prosperity and character should be visible in the world, not just reported in numbers.

## Narrative Design

The narrative unfolds primarily through **mandatory character dialogues** at important moments in the player's life.

- Present consequential decisions through conversations with family members, neighbors, workers, businesses, and other characters.
- Choices should influence future dialogue, relationships, opportunities, and farming mechanics.
- The central theme is individual rights versus collective control: owning your land and harvest, trading freely, and choosing whom to work with, versus pooling, sharing, or handing decisions to the group.
- Supporting themes: ambition, responsibility, greed, generosity, environmental stewardship, family, and legacy.
- Allow decisions made early in life to create unexpected consequences decades later.
- Characters never state the game's moral, and the game never judges the player. Give each side its strongest case in its own voice; collectivist characters are sincere and sympathetic, not villains.
- The player is free to choose either way. Let outcomes, not speeches, show which choices let people flourish.
- Support branching consequences without requiring entirely separate storylines for every choice.
- Integrate narrative decisions into the farming systems wherever possible.

The player's final farm and relationships should tell the story of the life they lived.

## Art Direction

Use [the concept art](docs/images/art-direction.png) as the primary visual reference for palette, crop and animal silhouettes, buildings, seasonal variation, and UI styling. It is an art reference, not a gameplay specification; preserve the fixed farm-management perspective described below.

**Visual style:** Classic FarmVille's presentation and layout, rendered in a charming, polished pixel-art aesthetic inspired by Stardew Valley.

- Fixed isometric or 2.5D farm overview.
- Grid-based fields, buildings, decorations, and environmental features.
- Colorful, warm, inviting visuals with readable silhouettes.
- Satisfying crop growth, harvesting animations, and visual feedback.
- A lively farm with animals, animated environmental details, and seasonal changes.
- Visually distinguishable progression across decades, including new technologies, buildings, and landscape changes.
- Clean, unobtrusive UI using a coherent pixel-art-inspired visual language.

**Important:** This is a FarmVille-style farming management game, not a Stardew Valley-style character exploration game.

## Technical Direction

Build a lightweight, entirely client-side web application.

**Preferred stack:**
- TypeScript
- Phaser for 2D game rendering and interactions
- Vite for development and builds
- HTML/CSS for dialogue, menus, and overlays
- IndexedDB for local save persistence
- Cloudflare Pages for static hosting

### Architecture Principles

- No backend, authentication, multiplayer, or external database required.
- No AI in the live game. All dialogue, events, and simulation are authored content and rules shipped as static files.
- Keep infrastructure costs effectively zero beyond domain registration.
- Separate game simulation, narrative logic, rendering, and UI.
- Model game rules and narrative events as configurable, data-driven systems.
- Maintain deterministic, testable game-state transitions where practical.
- Autosave progress locally; support save export/import.
- Keep performance and loading times appropriate for ordinary desktop browsers.
- Avoid unnecessary dependencies, frameworks, and premature abstractions.

## Development Priorities

Build incrementally, prioritizing a playable game over architectural complexity.

1. **Playable farming prototype:** Farm grid, planting, crop growth, harvesting, currency, and reinvestment.
2. **Progression:** Seasons, years, farm expansion, buildings, upgrades, and economic balancing.
3. **Narrative framework:** Character dialogue, branching choices, persistent consequences, and conditional events.
4. **Integrated vertical slice:** Several playable years demonstrating how narrative choices alter farming mechanics and future events, including other farmers arriving and the first conflicts between individualist and collectivist farmers.
5. **Full game:** 40 years across 160 seasonal turns, evolving characters, meaningful decisions, and multiple possible legacies.
6. **Polish:** Visual effects, audio, balancing, usability, and performance.

**Hackathon target:** a polished vertical slice (step 4). Steps 5 and 6 come after the hackathon; never trade away a working slice to start them.

## Instructions for Development Agents

- Favor simple, working implementations over elaborate designs.
- Prioritize the core gameplay loop before secondary systems.
- Keep the game continuously playable as features are added.
- Use placeholder assets where necessary rather than blocking implementation.
- Build reusable, data-driven systems rather than hardcoding individual crops or events.
- Do not introduce server-side infrastructure without a clear requirement.
- Make reasonable design decisions autonomously when requirements are unspecified.
- Preserve the distinction between **micro-level farming fun** and **long-term narrative consequences**.
- When evaluating features, ask: **Does this make farming more satisfying, or make the player's choices more meaningful?**

**North star:** Create a farming game that's enjoyable to play moment to moment, but becomes memorable because of what the player chooses to do over a lifetime.

## Local Development and Validation

Start with [docs/session-start.md](docs/session-start.md) for implemented scope and a task-to-code map. Read [docs/development.md](docs/development.md) for setup, playtest state, architecture boundaries, and Cloudflare Pages configuration. Use `pnpm dev --instance validation-<task-id>` for your own local instance, then run `pnpm validate` after substantive changes. Inspect changed UI paths with Playwright, capture and inspect current screenshots, and stop your instance after validation. Keep playtest tools gated by `import.meta.env.DEV` so production builds exclude them.

## Micro and Macro Work

Before changing game rules, read [ownership and contracts](docs/game-boundaries.md). Work in the owning domain and coordinate shared contract changes. Use [playtesting recipes](docs/playtesting.md) for isolated domain states and focused tests; start with [development](docs/development.md) for setup.
