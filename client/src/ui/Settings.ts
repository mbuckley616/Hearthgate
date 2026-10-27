import { tuning, tuningDefaults } from '@hearthgate/shared/config/tuning';

const STORAGE_KEY = 'combat-slice.settings.v1';

/** Player preferences. Defaults come from tuning.ts; choices override those tuning values on this machine. */
export interface SettingsData {
  master: number;
  music: number;
  sfx: number;
  sensitivity: number;
  pixelSize: number;
  retro: boolean;
  scanlines: number;
  shake: number;
}

function defaults(): SettingsData {
  const t = tuningDefaults;
  return {
    master: t.audio.masterVolume,
    music: t.audio.musicVolume,
    sfx: t.hitFeel.sfxVolume,
    sensitivity: t.camera.mouseSensitivity,
    pixelSize: t.look.pixelSize,
    retro: t.look.crt && t.look.retro,
    scanlines: t.look.scanlines,
    shake: t.hitFeel.screenShake,
  };
}

interface Row {
  key: keyof SettingsData;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** How the value reads next to the slider. */
  show?: (v: number) => string;
}

const ROWS: Row[] = [
  { key: 'master', label: 'Master volume', min: 0, max: 1, step: 0.05, show: (v) => `${Math.round(v * 100)}%` },
  { key: 'music', label: 'Music', min: 0, max: 1, step: 0.05, show: (v) => `${Math.round(v * 100)}%` },
  { key: 'sfx', label: 'Sound effects', min: 0, max: 1, step: 0.05, show: (v) => `${Math.round(v * 100)}%` },
  { key: 'sensitivity', label: 'Mouse sensitivity', min: 0.02, max: 0.4, step: 0.01, show: (v) => v.toFixed(2) },
  { key: 'shake', label: 'Screen shake', min: 0, max: 1.5, step: 0.05, show: (v) => `${Math.round(v * 100)}%` },
  { key: 'retro', label: 'Retro CRT look' },
  { key: 'pixelSize', label: 'Pixel size', min: 1, max: 5, step: 1, show: (v) => (v <= 1 ? 'off' : `${v}×`) },
  { key: 'scanlines', label: 'Scanlines', min: 0, max: 0.8, step: 0.02, show: (v) => `${Math.round(v * 100)}%` },
];

/** Settings: load and save in the browser, push them into tuning, and draw the panel. */
export class Settings {
  data: SettingsData;
  readonly panel = document.createElement('div');

  constructor() {
    this.data = Settings.load();
    this.apply();
    this.panel.className = 'settings-panel';
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.render();
  }

  private static load(): SettingsData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return { ...defaults(), ...(raw ? (JSON.parse(raw) as Partial<SettingsData>) : {}) };
    } catch {
      return defaults();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Private windows: settings just won't stick.
    }
  }

  /** Write the choices into the live tuning object. */
  apply(): void {
    const d = this.data;
    tuning.audio.masterVolume = d.master;
    tuning.audio.musicVolume = d.music;
    tuning.hitFeel.sfxVolume = d.sfx;
    tuning.camera.mouseSensitivity = d.sensitivity;
    tuning.hitFeel.screenShake = d.shake;
    tuning.look.crt = d.retro;
    tuning.look.retro = d.retro;
    tuning.look.pixelSize = d.retro ? d.pixelSize : 1;
    tuning.look.scanlines = d.scanlines;
  }

  private render(): void {
    this.panel.innerHTML = '';
    for (const row of ROWS) {
      const line = document.createElement('label');
      line.className = 'settings-row';
      const name = document.createElement('span');
      name.textContent = row.label;
      line.appendChild(name);
      const value = this.data[row.key];
      if (typeof value === 'boolean') {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = value;
        box.addEventListener('change', () => this.set(row.key, box.checked));
        line.appendChild(box);
      } else {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(row.min);
        slider.max = String(row.max);
        slider.step = String(row.step);
        slider.value = String(value);
        const out = document.createElement('em');
        out.textContent = row.show ? row.show(value) : String(value);
        slider.addEventListener('input', () => {
          const v = Number(slider.value);
          out.textContent = row.show ? row.show(v) : String(v);
          this.set(row.key, v);
        });
        line.append(slider, out);
      }
      this.panel.appendChild(line);
    }
    const reset = document.createElement('button');
    reset.className = 'menu-btn small';
    reset.textContent = 'Reset to defaults';
    reset.addEventListener('click', () => {
      this.data = defaults();
      this.apply();
      this.save();
      this.render();
    });
    this.panel.appendChild(reset);
  }

  private set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    this.apply();
    this.save();
  }
}
