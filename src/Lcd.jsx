import { useEffect, useState } from 'react';

// Monochrome LCD that types text out a character at a time, like the toy's
// slow little screen. Clicking it shows the full text immediately.
export default function Lcd({ text, counter, on }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (!text) return undefined;
    const id = setInterval(() => {
      setShown((s) => {
        if (s >= text.length) {
          clearInterval(id);
          return s;
        }
        return s + 1;
      });
    }, 22);
    return () => clearInterval(id);
  }, [text]);

  return (
    <div className={`lcd ${on ? 'lit' : ''}`} onClick={() => setShown(text.length)} aria-live="polite">
      <div className="lcd-counter">{counter}</div>
      <div className="lcd-text">
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">
          {text.slice(0, shown)}
          {on && <span className="cursor">▮</span>}
        </span>
      </div>
    </div>
  );
}
