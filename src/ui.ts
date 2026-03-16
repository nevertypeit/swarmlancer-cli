import * as readline from "readline";

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

export function closeUI() {
  rl?.close();
  rl = null;
}

export function ask(question: string, defaultVal?: string): Promise<string> {
  const suffix = defaultVal ? ` [${defaultVal}]` : "";
  return new Promise((resolve) => {
    getRL().question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

export function select(label: string, options: string[]): Promise<number> {
  return new Promise((resolve) => {
    console.log(`\n  ${label}\n`);
    options.forEach((opt, i) => {
      console.log(`    ${i + 1}) ${opt}`);
    });
    console.log();

    const prompt = () => {
      getRL().question("  > ", (answer) => {
        const num = parseInt(answer.trim());
        if (num >= 1 && num <= options.length) {
          resolve(num - 1);
        } else {
          prompt();
        }
      });
    };
    prompt();
  });
}

export function pressEnter(message = "Press Enter to continue..."): Promise<void> {
  return new Promise((resolve) => {
    getRL().question(`  ${message}`, () => resolve());
  });
}
