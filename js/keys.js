/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button (top left).
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.FIRE_TITLE,
  cols: ['Teddy (left)', 'Tommy (right)'],
  keys: [
    ['drive the fire truck', 'A D', '← →'],
    ['ladder up / down', 'W S', '↑ ↓'],
    ['spray water (hold)', 'Space or F', 'Enter'],
    ['call your brother · high five', 'T', 'T'],
    ['pick a street', 'A D', '← →'],
    ['level 🐣 / 🔥', 'W S', '↑ ↓'],
    ['who drives', '1 2 3', '1 2 3'],
    ['just us or a race', 'R', 'R'],
    ['safety cards', 'C', 'C'],
    ['go! · again', 'Enter or Space', 'Enter or Space'],
    ['next street', 'N', 'N'],
    ['pause', 'P or Esc', 'P or Esc'],
    ['sound on / off', 'M', 'M'],
  ],
  note: 'Drive under a fire, raise the ladder until the basket is in front of it and hold the water. Bring the basket close to a kitten and it hops in (put out the fire in its window first). In 1 player both sets of keys work and T calls your brother, who sprays the big fire; with 2 players, T is a high five that fills both water tanks.',
  touch: 'The ◀ ▶ ▲ ▼ pad drives and moves the ladder, hold 💧 to spray. Tap your brother\'s face to call him.',
  button: { top: 'calc(env(safe-area-inset-top, 0px) + 10px)', left: 'max(10px, env(safe-area-inset-left, 0px))' },
});
// The language button goes right under the ? button, and the kit's speaker under that: a column in the top left corner,
// in the sky above the street, away from the drive pad and the water button at the bottom.
Kit.lang.setup({ button: { top: 'calc(env(safe-area-inset-top, 0px) + 58px)', left: 'max(10px, env(safe-area-inset-left, 0px))' } });
