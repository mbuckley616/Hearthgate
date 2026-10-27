import GUI from "lil-gui";
import { tuning, tuningDefaults, tuningRanges, type TuningEdit } from "@hearthgate/shared";

type Section = Record<string, number | boolean>;

/**
 * The live tuning panel (backtick), as in the combat slice: one folder per section of
 * `shared/src/tuning.ts`, a slider for every value with a range in `tuningRanges`. Unlike the
 * slice, an edit is not applied here: it goes to the server (`send`), which checks it, applies
 * it and sends the whole set back to every client, and the panel redraws from that (`refresh`).
 * Prediction and the server never step different numbers.
 *
 * A developer's tool, not part of play: it needs a mouse, which rule 4 allows for a debug panel.
 */
export class DebugPanel {
  private gui: GUI;
  /** A copy the sliders write to, so a drag is a request until the server says it is so. */
  private view: Record<string, Section> = structuredClone(tuning) as unknown as Record<string, Section>;

  constructor(private send: (edit: TuningEdit) => void) {
    this.gui = new GUI({ title: "Tuning  ( ` to close )", width: 330 });
    this.gui.domElement.style.zIndex = "20";

    const tools = this.gui.addFolder("Tools");
    tools.add({ copy: () => this.copy() }, "copy").name("Copy tuning to clipboard");
    tools.add({ reset: () => this.reset() }, "reset").name("Reset to tuning.ts values");

    for (const name of Object.keys(this.view)) {
      const section = this.view[name];
      const folder = this.gui.addFolder(name);
      for (const key of Object.keys(section)) {
        const path = `${name}.${key}`;
        const range = tuningRanges[path];
        const value = section[key];
        if (typeof value !== "boolean" && !range) continue;
        const c = typeof value === "boolean" ? folder.add(section, key) : folder.add(section, key, ...range);
        c.onFinishChange((v: number | boolean) => this.send({ path, value: v }));
      }
      // Movement is what step 1 is tuned on; the rest start closed.
      if (name !== "movement") folder.close();
    }
    this.setVisible(false);
  }

  get visible(): boolean {
    return !this.gui._hidden;
  }

  setVisible(v: boolean): void {
    if (v) this.gui.show();
    else this.gui.hide();
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  /** The server's tuning arrived: show it. */
  refresh(): void {
    const live = tuning as unknown as Record<string, Section>;
    for (const name of Object.keys(this.view)) Object.assign(this.view[name], live[name]);
    for (const c of this.gui.controllersRecursive()) c.updateDisplay();
  }

  private reset(): void {
    const defaults = tuningDefaults as unknown as Record<string, Section>;
    const live = tuning as unknown as Record<string, Section>;
    for (const name of Object.keys(defaults)) {
      for (const key of Object.keys(defaults[name])) {
        const value = defaults[name][key];
        if (live[name][key] !== value) this.send({ path: `${name}.${key}`, value });
      }
    }
  }

  private copy(): void {
    const text = JSON.stringify(tuning, null, 2);
    navigator.clipboard.writeText(text).then(
      () => console.info("[tuning] copied to clipboard"),
      () => console.info(`[tuning]\n${text}`)
    );
  }
}
