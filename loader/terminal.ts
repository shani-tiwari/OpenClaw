import chalk from "chalk";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const CLAW = "🦞";
const ACCENT = chalk.hex("#5b4d9e");
const DIM = chalk.dim;

export interface LoaderHandle {
  update(message: string): void;
  stop(successMessage?: string): void;
}

export interface CliLoader extends LoaderHandle {
  start(): void;
}

export function createCliLoader(initialMessage: string): CliLoader {
  let message = initialMessage;
  let frame = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let active = false;

  const render = () => {
    if (!active) return;
    const spin = FRAMES[frame % FRAMES.length]!;
    frame += 1;
    const line = `${ACCENT(spin)} ${CLAW} ${DIM(message)}`;
    process.stdout.write(`\r\x1b[K${line}`);
  };

  return {
    start() {
      if (active) return;
      active = true;
      render();
      interval = setInterval(render, 80);
    },
    update(msg: string) {
      message = msg;
    },
    stop(successMessage?: string) {
      active = false;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      process.stdout.write("\r\x1b[K");
      if (successMessage) {
        console.log(chalk.green(`✓ ${successMessage}`));
      }
    },
  };
}

export async function withCliLoader<T>(
  message: string,
  fn: () => Promise<T>,
  opts?: { successMessage?: string },
): Promise<T> {
  const loader = createCliLoader(message);
  loader.start();
  try {
    return await fn();
  } finally {
    loader.stop(opts?.successMessage);
  }
}
