// Plays 20Q against every built-in object with a simulated player and reports
// how often (and how quickly) it guesses correctly. Usage:
//   npm run simulate            truthful player
//   npm run simulate -- 0.1     player who gives a wrong answer 10% of the time
import { buildKB, decide, newGame, questionCount, valueOf } from '../src/engine.js';

const noise = Number(process.argv[2] ?? 0);
const kb = buildKB();
let wins = 0;
let totalQ = 0;
const failures = [];

for (const target of kb.objects) {
  let game = { ...newGame(), category: target.category };
  let won = false;
  for (;;) {
    const move = decide(kb, game);
    if (move.type === 'giveup') break;
    if (move.type === 'guess') {
      const correct = move.name === target.name;
      game = {
        ...game,
        guesses: [...game.guesses, { name: move.name, correct }],
        excluded: correct ? game.excluded : [...game.excluded, move.name],
      };
      if (correct) { won = true; break; }
      continue;
    }
    const v = valueOf(target, move.qid);
    let answer = v >= 0.7 ? 'yes' : v <= 0.3 ? 'no' : 'sometimes';
    if (Math.random() < noise) answer = answer === 'yes' ? 'no' : 'yes';
    game = { ...game, answers: [...game.answers, { qid: move.qid, answer }] };
  }
  if (won) { wins++; totalQ += questionCount(game); }
  else failures.push(`${target.name} (guessed: ${game.guesses.map((g) => g.name).join(', ')})`);
}

console.log(`Won ${wins}/${kb.objects.length} (${((wins / kb.objects.length) * 100).toFixed(0)}%), avg ${(totalQ / wins).toFixed(1)} questions`);
if (failures.length) console.log('Stumped by:\n  ' + failures.join('\n  '));
