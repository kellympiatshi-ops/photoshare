import React from 'react';

const themes = ['default', 'dark', 'theme-netflix', 'theme-apple'] as const;

export function ThemeToggle() {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    applyTheme(themes[index]);
  }, [index]);

  const next = () => setIndex((i) => (i + 1) % themes.length);

  return (
    <button
      onClick={next}
      className="px-3 py-2 rounded-md bg-transparent text-[color:var(--muted-foreground)] border hover:border-[color:var(--border)]"
      aria-label="Changer le thème"
    >
      Thème
    </button>
  );
}

function applyTheme(name: typeof themes[number]) {
  const el = document.documentElement;
  // remove known theme classes
  el.classList.remove('dark', 'theme-netflix', 'theme-apple');
  if (name === 'dark') el.classList.add('dark');
  if (name === 'theme-netflix') el.classList.add('theme-netflix');
  if (name === 'theme-apple') el.classList.add('theme-apple');
}

export default ThemeToggle;
