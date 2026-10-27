import GUI from 'lil-gui';
import { tuning, tuningDefaults, tuningRanges } from '@hearthgate/shared/config/tuning';

type Section = Record<string, number | boolean>;

/**
 * Live tuning panel generated from src/config/tuning.ts. Every numeric value
 * with a range in tuningRanges becomes a slider; *Color values get a picker.
 */
export class DebugPanel {
  private gui: GUI;
  private stats: HTMLDivElement;
  private slowMoBadge: HTMLDivElement;
  private frames = 0;
  private frameTimeAcc = 0;
  private lastFps = 0;
  private lastMs = 0;
  private extra = '';

  /**
   * @param actions debug buttons: label -> callback
   * @param onEdit every value changed by hand, after it is set here (the game sends the fight's to the server)
   */
  constructor(
    actions: Record<string, () => void>,
    private readonly onEdit: (path: string, value: number | boolean) => void = () => {},
  ) {
    this.gui = new GUI({ title: 'Tuning  ( ` to close )', width: 330 });
    this.gui.domElement.style.zIndex = '20';

    const tools = this.gui.addFolder('Debug');
    const sent = (key: string) => (v: number | boolean) => this.onEdit(`debug.${key}`, v);
    tools.add(tuning.debug, 'slowMo').name('Slow motion ( \\ )').listen().onChange(sent('slowMo'));
    tools.add(tuning.debug, 'slowMoScale', ...tuningRanges['debug.slowMoScale']).name('slow-mo scale').onChange(sent('slowMoScale'));
    tools.add(tuning.debug, 'showColliders').name('Show colliders');
    tools.add(tuning.debug, 'showHitboxes').name('Show hitboxes ( H )').listen();
    tools.add(tuning.debug, 'enemiesEnabled').name('Grunt waves').onChange(sent('enemiesEnabled'));
    tools.add(tuning.debug, 'passiveEnemies').name('Grunts never swing').onChange(sent('passiveEnemies'));
    tools.add(tuning.debug, 'godMode').name('God mode').onChange(sent('godMode'));
    for (const label of Object.keys(actions)) tools.add(actions, label);
    tools.add({ copy: () => this.copyTuning() }, 'copy').name('Copy tuning to clipboard');
    tools.add({ reset: () => this.reset() }, 'reset').name('Reset to tuning.ts values');

    const sections = tuning as unknown as Record<string, Section>;
    for (const sectionName of Object.keys(sections)) {
      if (sectionName === 'debug') continue;
      const section = sections[sectionName];
      const folder = this.gui.addFolder(sectionName);
      folder.close();
      for (const key of Object.keys(section)) {
        const value = section[key];
        const path = `${sectionName}.${key}`;
        const range = tuningRanges[path];
        const c =
          typeof value === 'boolean'
            ? folder.add(section, key)
            : key.endsWith('Color')
              ? folder.addColor(section, key)
              : range
                ? folder.add(section, key, ...range)
                : folder.add(section, key);
        c.onChange((v: number | boolean) => this.onEdit(path, v));
      }
    }
    // Camera and movement are what M0 is tuned on; open them by default.
    for (const f of this.gui.folders) if (f._title === 'camera' || f._title === 'movement') f.open();

    this.stats = document.createElement('div');
    this.stats.className = 'debug-stats';
    document.body.appendChild(this.stats);

    this.slowMoBadge = document.createElement('div');
    this.slowMoBadge.className = 'slowmo-badge';
    document.body.appendChild(this.slowMoBadge);

    this.setVisible(false);
  }

  get visible(): boolean {
    return this.gui._hidden === false;
  }

  setVisible(v: boolean): void {
    if (v) this.gui.show();
    else this.gui.hide();
    this.stats.style.display = v ? 'block' : 'none';
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  /** Show values changed from outside the panel (another player's edits, passed on by the server). */
  refresh(): void {
    for (const c of this.gui.controllersRecursive()) c.updateDisplay();
  }

  /** Extra lines for the stats readout (sim tick, camera distance, ...). */
  setExtra(text: string): void {
    this.extra = text;
  }

  /** Call once per rendered frame with real (unscaled) frame time in seconds. */
  frame(realDt: number): void {
    this.frames++;
    this.frameTimeAcc += realDt;
    if (this.frameTimeAcc >= 0.5) {
      this.lastFps = this.frames / this.frameTimeAcc;
      this.lastMs = (this.frameTimeAcc / this.frames) * 1000;
      this.frames = 0;
      this.frameTimeAcc = 0;
    }
    if (this.visible) {
      this.stats.textContent = `${this.lastFps.toFixed(0)} fps  ${this.lastMs.toFixed(1)} ms\n${this.extra}`;
    }
    const slow = tuning.debug.slowMo;
    this.slowMoBadge.style.display = slow ? 'block' : 'none';
    if (slow) this.slowMoBadge.textContent = `SLOW MOTION ${tuning.debug.slowMoScale}x`;
  }

  private copyTuning(): void {
    const text = JSON.stringify(tuning, null, 2);
    navigator.clipboard.writeText(text).then(
      () => console.info('[tuning] copied to clipboard'),
      () => console.info('[tuning]\n' + text),
    );
  }

  private reset(): void {
    const target = tuning as unknown as Record<string, Section>;
    const defaults = tuningDefaults as unknown as Record<string, Section>;
    for (const section of Object.keys(defaults)) {
      for (const [key, v] of Object.entries(defaults[section])) if (target[section][key] !== v) this.onEdit(`${section}.${key}`, v);
      Object.assign(target[section], defaults[section]);
    }
    for (const c of this.gui.controllersRecursive()) c.updateDisplay();
  }
}
