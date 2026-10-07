# 21questions

A React remake of the 90s **20Q** toy: the glowing blue ball that guesses what you're thinking of in 20 questions.

## Play

```bash
npm install
npm run dev
```

1. Press **ON** and think of something.
2. Tell 20Q whether it's **Animal, Vegetable, Mineral, or Other**.
3. Answer each question with **Yes**, **No**, **Sometimes**, or **Unknown** (keyboard: `Y` `N` `S` `U`).
4. 20Q guesses by question 20. If it's wrong, it asks up to 5 more questions (25 in total), just like the original toy.
5. If you stump it, tell it what you were thinking of and it learns the new thing for next time.

After each game you get the full question log, plus any "uncommon answers" where you disagreed with what 20Q believed.

## How it works

Like the original toy, 20Q has a small "neural net": a matrix of objects × questions (`src/knowledge.js`). Each cell holds a value from 0 (no) to 1 (yes).

- **Scoring:** each answer re-weights every object. A mismatch makes an object much less likely but never rules it out, so a few odd answers won't wreck the game.
- **Choosing questions:** 20Q asks whichever question best splits the remaining likely candidates.
- **Learning:** after every game, the object's values drift toward your answers. New objects get added. What 20Q learns is saved in `localStorage`, and **Reset brain** clears it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run simulate` | Bot plays against every known object and reports the win rate |
| `npm run simulate -- 0.1` | Same, but the bot answers wrong 10% of the time |
