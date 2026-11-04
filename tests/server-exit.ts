/**
 * `npm run test:net`'s last check: a test that boots the server takes it down however it ends.
 * Each case runs a child that boots the server with `bootServer` and then ends one way (returns
 * through `process.exit` without `kill()`, throws, or is sent SIGTERM as a timeout would), and
 * the port must stop answering. Before Session 98 any of these left the server ticking.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bootServer, sleep, waitForHealth } from "./bots";

const BASE_PORT = 2620;
const here = fileURLToPath(import.meta.url);
const tsxCli = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));

async function child(port: number, ending: string) {
  bootServer(port);
  await waitForHealth(`http://localhost:${port}/health`);
  console.log("up");
  if (ending === "exit") process.exit(0);
  if (ending === "throw") throw new Error("a test that throws");
  await sleep(60_000); // "signal": the parent sends SIGTERM
}

async function answers(port: number) {
  try {
    return (await fetch(`http://localhost:${port}/health`)).ok;
  } catch {
    return false;
  }
}

async function parent() {
  let failures = 0;
  const endings = ["exit", "throw", "signal"];
  for (const [i, ending] of endings.entries()) {
    const port = BASE_PORT + i;
    const proc = spawn(process.execPath, [tsxCli, here, "child", String(port), ending], { stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve) => {
      proc.stdout.on("data", (d) => {
        if (String(d).includes("up")) {
          if (ending === "signal") proc.kill("SIGTERM");
          resolve();
        }
      });
      proc.on("exit", () => resolve());
    });
    await new Promise((r) => (proc.exitCode !== null || proc.signalCode !== null ? r(null) : proc.on("exit", r)));
    let gone = false;
    for (let t = 0; t < 20 && !gone; t++) {
      gone = !(await answers(port));
      if (!gone) await sleep(250);
    }
    console.log(`${gone ? "ok  " : "FAIL"}  a test that ends by ${ending} takes its server down`);
    if (!gone) failures++;
  }
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

if (process.argv[2] === "child") void child(Number(process.argv[3]), process.argv[4]);
else void parent();
