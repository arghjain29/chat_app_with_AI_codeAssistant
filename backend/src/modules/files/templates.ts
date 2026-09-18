import type { ProjectTemplate } from '@codecollab/shared';

/**
 * Starting files for new projects. The starter is a plain static site so it runs
 * instantly in the browser with nothing to install.
 */
export const TEMPLATES: Record<ProjectTemplate, { path: string; content: string }[]> = {
  blank: [],
  starter: [
    {
      path: 'index.html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My project</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Hello, team</h1>
      <p>Edit <code>index.html</code>, <code>style.css</code> or <code>script.js</code> together, then press Run.</p>
      <button id="counter">Clicked 0 times</button>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`,
    },
    {
      path: 'style.css',
      content: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, sans-serif;
  background: #eef1f5;
  color: #1b2233;
}

main {
  max-width: 32rem;
  padding: 2rem;
  text-align: center;
}

button {
  font: inherit;
  padding: 0.6rem 1.2rem;
  border: 0;
  border-radius: 0.5rem;
  background: #2f5bea;
  color: white;
  cursor: pointer;
}
`,
    },
    {
      path: 'script.js',
      content: `const button = document.getElementById('counter');
let count = 0;

button.addEventListener('click', () => {
  count += 1;
  button.textContent = \`Clicked \${count} \${count === 1 ? 'time' : 'times'}\`;
});
`,
    },
    {
      path: 'README.md',
      content: `# My project

Everyone in this project can edit these files at the same time.

- **Run** serves \`index.html\` as a static site. Add a \`package.json\` with a \`dev\` or \`start\` script to run a Node project instead.
- Projects in other languages can be edited together, but only JavaScript/Node runs in the browser.
`,
    },
  ],
};
