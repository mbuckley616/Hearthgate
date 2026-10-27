/**
 * Parity with the combat slice: the same scripted parties through the slice's own stepSim (from
 * its repo) and through Hearthgate's copy in shared/, compared state by state, tick by tick, to
 * the bit. Stops at the first tick they disagree and prints the first differing field.
 *
 * Then it records the slice's hashes in shared/src/parity/golden.json (with --write), which
 * shared/src/parity/parity.test.ts checks Hearthgate's copy against in `npm test`, so CI holds
 * the line without the slice's repo.
 *
 * Run: npm run test:parity [-- --slice ../combat-slice --write]
 * The slice is found at --slice, else $SLICE_DIR, else ../combat-slice beside this repo.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tuning } from "@hearthgate/shared/config/tuning";
import { arena, buildWorld } from "@hearthgate/shared/level/arena";
import { addPlayer, removePlayer } from "@hearthgate/shared/sim/coop";
import { restartRun, skipToWave } from "@hearthgate/shared/sim/run";
import { createSimState, stepSim } from "@hearthgate/shared/sim/world";
import { SCENARIOS, playScenario, type SimApi } from "@hearthgate/shared/parity/scenario";

const root = fileURLToPath(new URL("..", import.meta.url));

// Hearthgate's downs and item catalogue (T5) are its own rules: with them off, the rest of its fight is compared with the slice's to the bit.
tuning.coop.bleedOut = false;
tuning.gear.catalogue = false;
const args = process.argv.slice(2);
const argOf = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const sliceDir = path.resolve(root, argOf("--slice") ?? process.env.SLICE_DIR ?? "../combat-slice");

async function sliceApi(): Promise<SimApi> {
  const load = (rel: string) => import(pathToFileURL(path.join(sliceDir, rel)).href);
  const [lvl, coop, run, world, cfg] = await Promise.all([
    load("src/level/arena.ts"),
    load("src/sim/coop.ts"),
    load("src/sim/run.ts"),
    load("src/sim/world.ts"),
    load("src/config/tuning.ts"),
  ]);
  if (cfg.tuning === tuning) throw new Error("the slice's tuning resolved to Hearthgate's module: not two copies");
  return {
    arena: lvl.arena,
    buildWorld: lvl.buildWorld,
    createSimState: world.createSimState,
    stepSim: world.stepSim,
    addPlayer: coop.addPlayer,
    removePlayer: coop.removePlayer,
    skipToWave: run.skipToWave,
    restartRun: run.restartRun,
    tickRate: cfg.tuning.sim.tickRate,
  };
}

const hearthgate: SimApi = {
  arena,
  buildWorld: buildWorld as SimApi["buildWorld"],
  createSimState: createSimState as SimApi["createSimState"],
  stepSim: stepSim as SimApi["stepSim"],
  addPlayer: addPlayer as SimApi["addPlayer"],
  removePlayer,
  skipToWave: skipToWave as SimApi["skipToWave"],
  restartRun: restartRun as SimApi["restartRun"],
  tickRate: tuning.sim.tickRate,
};

/** The first path where two JSON values differ, for the report. */
function firstDiff(a: unknown, b: unknown, at = "state"): string {
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return a === b ? "" : `${at}: slice ${JSON.stringify(a)} vs hearthgate ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) {
    const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`);
    if (d) return d;
  }
  return "";
}

async function main() {
  if (!existsSync(path.join(sliceDir, "src/sim/world.ts"))) {
    console.error(`No combat slice at ${sliceDir}; pass --slice <dir> or set SLICE_DIR.`);
    process.exit(2);
  }
  const slice = await sliceApi();
  const golden: Record<string, { checkpoints: number[]; all: number; summary: string }> = {};
  let failed = false;
  for (const sc of SCENARIOS) {
    const sliceStates: string[] = [];
    const t0 = performance.now();
    const ref = playScenario(slice, sc, (_t, json) => {
      sliceStates.push(json);
    });
    let diverged = "";
    const ours = playScenario(hearthgate, sc, (t, json) => {
      if (json === sliceStates[t]) return true;
      diverged = `tick ${t}: ${firstDiff(JSON.parse(sliceStates[t]), JSON.parse(json))}`;
      return false;
    });
    const ms = Math.round(performance.now() - t0);
    if (diverged || ours.all !== ref.all) {
      failed = true;
      console.log(`FAIL  ${sc.name}: ${diverged || "hashes differ"}`);
    } else {
      console.log(`ok    ${sc.name}: ${sc.ticks} ticks identical (${ref.summary}) in ${ms} ms`);
    }
    golden[sc.name] = { checkpoints: ref.checkpoints, all: ref.all, summary: ref.summary };
  }
  if (args.includes("--write") && !failed) {
    const out = path.join(root, "shared/src/parity/golden.json");
    writeFileSync(out, JSON.stringify(golden, null, 1) + "\n");
    console.log(`wrote ${path.relative(root, out)}`);
  }
  process.exit(failed ? 1 : 0);
}

void main();
