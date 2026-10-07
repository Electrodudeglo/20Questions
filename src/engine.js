// The 20Q "neural net": a matrix of objects x questions with a value in
// [0, 1] for each cell. Answers re-weight every object, the next question is
// the one that best splits the remaining candidates, and the matrix learns
// from every finished game.
import { BASE_OBJECTS, CATEGORIES, QUESTIONS } from './knowledge.js';

export const ANSWERS = {
  yes: { label: 'Yes', value: 1 },
  no: { label: 'No', value: 0 },
  sometimes: { label: 'Sometimes', value: 0.5 },
  unknown: { label: 'Unknown', value: null },
};

export const MAX_QUESTIONS = 25;
const FIRST_GUESS = 20;
const LEARNING_RATE = 0.3;
// How much one mismatched answer counts against an object. Never 0, because
// people answer questions differently and 20Q is meant to forgive that.
const MISMATCH_PENALTY = 0.9;
const WRONG_CATEGORY = 0.03;

const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function questionText(id) {
  return QUESTION_BY_ID[id]?.text ?? id;
}

export function valueOf(obj, qid) {
  return obj.v[qid] ?? obj.fallback ?? 0;
}

export function findObject(kb, name) {
  const key = normalize(name);
  return kb.objects.find((o) => normalize(o.name) === key);
}

export function normalize(name) {
  return name.trim().toLowerCase().replace(/^(an?|the)\s+/, '').replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Knowledge base persistence

export function buildKB(learnedObjects = []) {
  const byName = new Map(BASE_OBJECTS.map((o) => [o.name, o]));
  for (const o of learnedObjects) byName.set(o.name, o);
  return { objects: [...byName.values()] };
}

// ---------------------------------------------------------------------------
// Game state (plain objects, so they drop straight into React state)

export function newGame() {
  return {
    category: null,
    answers: [], // { qid, answer } in the order asked
    guesses: [], // { name, correct }
    excluded: [],
  };
}

export function questionCount(game) {
  return (game.category ? 1 : 0) + game.answers.length + game.guesses.length;
}

function likelihood(obj, game) {
  let p = 1;
  if (game.category && obj.category !== game.category) p *= WRONG_CATEGORY;
  for (const { qid, answer } of game.answers) {
    const a = ANSWERS[answer].value;
    if (a === null) continue;
    p *= 1 - MISMATCH_PENALTY * Math.abs(a - valueOf(obj, qid));
  }
  return p;
}

// Returns candidates sorted by probability (sums to 1).
export function rank(kb, game) {
  const scored = kb.objects
    .filter((o) => !game.excluded.includes(o.name))
    .map((obj) => ({ obj, p: likelihood(obj, game) }));
  const total = scored.reduce((s, c) => s + c.p, 0) || 1;
  for (const c of scored) c.p /= total;
  return scored.sort((a, b) => b.p - a.p);
}

// Pick the unasked question whose answer is least predictable across the
// weighted candidates (highest variance = most information).
export function nextQuestion(kb, game, ranked = rank(kb, game), random = Math.random) {
  const asked = new Set(game.answers.map((a) => a.qid));
  const pool = ranked.filter((c) => c.p > 1e-4);
  const options = QUESTIONS.filter((q) => !asked.has(q.id)).map((q) => {
    let mean = 0;
    for (const c of pool) mean += c.p * valueOf(c.obj, q.id);
    let variance = 0;
    for (const c of pool) variance += c.p * (valueOf(c.obj, q.id) - mean) ** 2;
    return { id: q.id, score: variance };
  });
  if (!options.length) return null;
  const best = Math.max(...options.map((o) => o.score));
  if (best <= 1e-6) return null;
  // A little randomness among near-equal questions keeps games varied.
  const top = options.filter((o) => o.score >= best * 0.92);
  return top[Math.floor(random() * top.length)].id;
}

// Decide what 20Q does next: ask a question, make a guess, or give up.
export function decide(kb, game, random = Math.random) {
  const n = questionCount(game);
  if (n >= MAX_QUESTIONS) return { type: 'giveup' };
  const ranked = rank(kb, game);
  const best = ranked[0];
  if (!best) return { type: 'giveup' };

  const upcoming = n + 1;
  const confident =
    (upcoming >= 10 && best.p > 0.9) || (upcoming > FIRST_GUESS && best.p > 0.6);
  const mustGuess = upcoming === FIRST_GUESS || upcoming === MAX_QUESTIONS;
  if (confident || mustGuess) return { type: 'guess', name: best.obj.name };

  const qid = nextQuestion(kb, game, ranked, random);
  if (!qid) return { type: 'guess', name: best.obj.name };
  return { type: 'question', qid };
}

// ---------------------------------------------------------------------------
// Learning

// Teach the brain what the player was thinking of. Existing objects drift
// toward the player's answers; unknown objects are added from scratch.
export function learn(kb, name, category, game) {
  const clean = normalize(name);
  if (!clean) return kb;
  const existing = findObject(kb, clean);
  const obj = existing
    ? { ...existing, v: { ...existing.v } }
    : { name: clean, category: category ?? 'other', v: {}, fallback: 0.5, learned: true };

  for (const { qid, answer } of game.answers) {
    const a = ANSWERS[answer].value;
    if (a === null) continue;
    const current = existing ? valueOf(existing, qid) : a;
    obj.v[qid] = round(current + (existing ? LEARNING_RATE : 1) * (a - current));
  }
  obj.learned = true;

  const objects = existing
    ? kb.objects.map((o) => (o === existing ? obj : o))
    : [...kb.objects, obj];
  return { objects };
}

// Answers that disagree with what 20Q believed about the object.
export function contradictions(kb, name, game) {
  const obj = findObject(kb, name);
  if (!obj) return [];
  return game.answers
    .filter(({ answer }) => ANSWERS[answer].value !== null)
    .map(({ qid, answer }) => ({ qid, answer, expected: expectedAnswer(valueOf(obj, qid)) }))
    .filter(({ answer, expected }) => Math.abs(ANSWERS[answer].value - ANSWERS[expected].value) >= 1);
}

function expectedAnswer(v) {
  if (v >= 0.7) return 'yes';
  if (v <= 0.3) return 'no';
  return 'sometimes';
}

function round(x) {
  return Math.round(x * 100) / 100;
}

export { CATEGORIES };
