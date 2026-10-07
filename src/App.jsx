import { useCallback, useEffect, useState } from 'react';
import {
  ANSWERS,
  CATEGORIES,
  MAX_QUESTIONS,
  buildKB,
  contradictions,
  decide,
  learn,
  newGame,
  questionCount,
  questionText,
} from './engine.js';
import { beep } from './sound.js';
import Lcd from './Lcd.jsx';

const STORAGE_KEY = '20q.brain.v1';
const STATS_KEY = '20q.stats.v1';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): the brain just won't persist.
  }
}

const CATEGORY_LABELS = { animal: 'Animal', vegetable: 'Vegetable', mineral: 'Mineral', other: 'Other' };

export default function App() {
  const [kb, setKb] = useState(() => buildKB(load(STORAGE_KEY, [])));
  const [stats, setStats] = useState(() => load(STATS_KEY, { toy: 0, player: 0 }));
  const [power, setPower] = useState(false);
  const [game, setGame] = useState(newGame);
  // phase: category | question | guess | won | lost | taught
  const [phase, setPhase] = useState('category');
  const [move, setMove] = useState(null);
  const [notice, setNotice] = useState('');
  const [answerName, setAnswerName] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [muted, setMuted] = useState(() => load('20q.muted', false));

  const n = questionCount(game);

  const click = useCallback((tone) => !muted && beep(tone), [muted]);

  const persistKb = (next) => {
    setKb(next);
    save(STORAGE_KEY, next.objects.filter((o) => o.learned));
  };

  const bumpStats = (who) => {
    const next = { ...stats, [who]: stats[who] + 1 };
    setStats(next);
    save(STATS_KEY, next);
  };

  const advance = (nextGame, message = '') => {
    const m = decide(kb, nextGame);
    setGame(nextGame);
    setNotice(message);
    if (m.type === 'giveup') {
      setPhase('lost');
      bumpStats('player');
      click('lose');
    } else {
      setMove(m);
      setPhase(m.type);
    }
  };

  const start = () => {
    setGame(newGame());
    setMove(null);
    setNotice('');
    setAnswerName('');
    setPhase('category');
  };

  const togglePower = () => {
    click(power ? 'off' : 'on');
    if (!power) start();
    setPower(!power);
  };

  const chooseCategory = (category) => {
    click('press');
    advance({ ...game, category });
  };

  const answer = (key) => {
    click('press');
    advance({ ...game, answers: [...game.answers, { qid: move.qid, answer: key }] });
  };

  const judgeGuess = (verdict) => {
    const correct = verdict === 'right';
    const next = {
      ...game,
      guesses: [...game.guesses, { name: move.name, correct, verdict }],
      excluded: correct ? game.excluded : [...game.excluded, move.name],
    };
    if (correct) {
      setGame(next);
      setPhase('won');
      bumpStats('toy');
      click('win');
      setConflicts(contradictions(kb, move.name, next));
      persistKb(learn(kb, move.name, game.category, next));
      return;
    }
    click('press');
    const firstMiss = questionCount(next) === 20;
    const message =
      verdict === 'close'
        ? 'Close? Then I am getting warmer...'
        : firstMiss
          ? 'Hmm. Let me ask a few more questions.'
          : 'Not that? Let me think...';
    advance(next, message);
  };

  const teach = (e) => {
    e.preventDefault();
    if (!answerName.trim()) return;
    click('press');
    setConflicts(contradictions(kb, answerName, game));
    persistKb(learn(kb, answerName, game.category, game));
    setPhase('taught');
  };

  const resetBrain = () => {
    if (!confirm('Forget everything 20Q has learned and go back to the factory brain?')) return;
    save(STORAGE_KEY, []);
    setKb(buildKB());
  };

  // Keyboard shortcuts: Y / N / S / U for answers, R / W / C for guesses,
  // A / V / M / O for the first question.
  useEffect(() => {
    if (!power) return undefined;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (phase === 'category') {
        const cat = CATEGORIES.find((c) => c[0] === k);
        if (cat) chooseCategory(cat);
      } else if (phase === 'question') {
        const map = { y: 'yes', n: 'no', s: 'sometimes', u: 'unknown' };
        if (map[k]) answer(map[k]);
      } else if (phase === 'guess') {
        const map = { r: 'right', y: 'right', w: 'wrong', n: 'wrong', c: 'close' };
        if (map[k]) judgeGuess(map[k]);
      } else if ((phase === 'won' || phase === 'taught') && k === 'enter') {
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const correctGuess = game.guesses.find((g) => g.correct)?.name;

  let screen = '';
  let counter = '';
  if (!power) {
    screen = '';
  } else if (phase === 'category') {
    counter = 'Q1';
    screen = 'Think of something. Is it Animal, Vegetable, Mineral, or Other?';
  } else if (phase === 'question') {
    counter = `Q${n + 1}`;
    screen = `${notice ? notice + ' ' : ''}${questionText(move.qid)}`;
  } else if (phase === 'guess') {
    counter = `Q${n + 1}`;
    screen = `${notice ? notice + ' ' : ''}I am guessing that it is ${article(move.name)}${move.name}?`;
  } else if (phase === 'won') {
    screen = `20Q won! It was ${article(correctGuess)}${correctGuess}. I guessed it in ${n} questions.`;
  } else if (phase === 'lost') {
    screen = `You stumped me in ${MAX_QUESTIONS}! You win! What were you thinking of?`;
  } else if (phase === 'taught') {
    screen = `${capitalize(answerName.trim())}! I will remember that next time.`;
  }

  return (
    <main className="app">
      <header className="title">
        <h1>
          20<span>Q</span>
        </h1>
        <p>The game that reads your mind!</p>
      </header>

      <section className={`toy ${power ? 'on' : 'off'}`} aria-label="20Q toy">
        <div className="neurons" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>

        <div className="face">
          <Lcd text={screen} counter={counter} on={power} />

          <div className="pad">
            {power && phase === 'category' &&
              CATEGORIES.map((c) => (
                <button key={c} className="key" onClick={() => chooseCategory(c)}>
                  {CATEGORY_LABELS[c]}
                </button>
              ))}

            {power && phase === 'question' &&
              Object.entries(ANSWERS).map(([key, { label }]) => (
                <button key={key} className={`key key-${key}`} onClick={() => answer(key)}>
                  {label}
                </button>
              ))}

            {power && phase === 'guess' && (
              <>
                <button className="key key-yes" onClick={() => judgeGuess('right')}>Right</button>
                <button className="key key-no" onClick={() => judgeGuess('wrong')}>Wrong</button>
                <button className="key key-sometimes wide" onClick={() => judgeGuess('close')}>Close</button>
              </>
            )}

            {power && phase === 'lost' && (
              <form className="teach" onSubmit={teach}>
                <input
                  autoFocus
                  list="known"
                  value={answerName}
                  onChange={(e) => setAnswerName(e.target.value)}
                  placeholder="It was a…"
                  aria-label="What were you thinking of?"
                />
                <datalist id="known">
                  {kb.objects.map((o) => (
                    <option key={o.name} value={o.name} />
                  ))}
                </datalist>
                <button className="key key-yes">Teach</button>
              </form>
            )}

            {power && (phase === 'won' || phase === 'taught') && (
              <button className="key key-yes wide" onClick={start}>Play again</button>
            )}
          </div>

          <button className={`power ${power ? 'lit' : ''}`} onClick={togglePower} aria-label="Power">
            <span>{power ? 'OFF' : 'ON'}</span>
          </button>
        </div>
      </section>

      {!power && <p className="hint">Press <b>ON</b> to start. Think of an object and 20Q will try to guess it.</p>}
      {power && (phase === 'question' || phase === 'guess' || phase === 'category') && (
        <p className="hint">
          Keys: <kbd>Y</kbd> yes · <kbd>N</kbd> no · <kbd>S</kbd> sometimes · <kbd>U</kbd> unknown
          {phase === 'guess' && <> · <kbd>C</kbd> close</>}
        </p>
      )}

      {power && (phase === 'won' || phase === 'taught') && (
        <section className="report">
          <h2>How 20Q read your mind</h2>
          <ol>
            <li>
              <div className="row">
                <span>Animal, Vegetable, Mineral, or Other?</span>
                <b>{CATEGORY_LABELS[game.category]}</b>
              </div>
            </li>
            {game.answers.map(({ qid, answer: a }) => (
              <li key={qid}>
                <div className="row">
                  <span>{questionText(qid)}</span>
                  <b className={`ans-${a}`}>{ANSWERS[a].label}</b>
                </div>
              </li>
            ))}
            {game.guesses.map((g, i) => (
              <li key={i} className="guess-row">
                <div className="row">
                  <span>Is it {article(g.name)}{g.name}?</span>
                  <b className={g.correct ? 'ans-yes' : 'ans-no'}>{g.correct ? 'Right' : g.verdict === 'close' ? 'Close' : 'Wrong'}</b>
                </div>
              </li>
            ))}
          </ol>
          {conflicts.length > 0 && (
            <>
              <h3>Uncommon answers</h3>
              <ul className="conflicts">
                {conflicts.map(({ qid, answer: a, expected }) => (
                  <li key={qid}>
                    {questionText(qid)} You said <b>{ANSWERS[a].label}</b>, 20Q thought{' '}
                    <b>{ANSWERS[expected].label}</b>.
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <footer className="footer">
        <span>
          20Q wins <b>{stats.toy}</b> · Your wins <b>{stats.player}</b> · Knows <b>{kb.objects.length}</b> things
        </span>
        <span className="footer-actions">
          <button
            className="link"
            onClick={() => {
              setMuted(!muted);
              save('20q.muted', !muted);
            }}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <button className="link" onClick={resetBrain}>Reset brain</button>
        </span>
      </footer>
    </main>
  );
}

function article(name) {
  if (!name) return '';
  if (['money', 'water', 'gold', 'salt', 'sand', 'grass', 'fire', 'paper', 'corn', 'lettuce', 'broccoli'].includes(name)) return '';
  if (['sun', 'moon'].includes(name)) return 'the ';
  return /^[aeiou]/i.test(name) ? 'an ' : 'a ';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
