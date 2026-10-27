import { pixelTitle } from './pixelArt';

export interface TitleActions {
  play: () => void;
  host: () => void;
  join: (code: string) => void;
}

/**
 * The title screen (brief M6: "menus and a title screen"): the logo over the
 * live arena, and Play / Host / Join / Settings / Controls. Settings and the
 * controls list are shared with the pause menu.
 */
export class TitleScreen {
  private root = document.createElement('div');
  private side = document.createElement('div');
  visible = true;

  constructor(
    private readonly actions: TitleActions,
    private readonly settings: HTMLElement,
    private readonly controls: HTMLElement,
  ) {
    this.root.className = 'title-screen';
    const logo = document.createElement('div');
    logo.className = 'title-logo';
    logo.appendChild(pixelTitle('HEARTHGATE'));
    const tag = document.createElement('div');
    tag.className = 'title-tag';
    tag.textContent = 'A combat slice';

    const menu = document.createElement('div');
    menu.className = 'title-menu';
    const button = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = 'menu-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      menu.appendChild(b);
      return b;
    };
    button('Play', () => this.actions.play());
    button('Host a party', () => this.actions.host());
    const joinRow = document.createElement('div');
    joinRow.className = 'title-join';
    joinRow.style.display = 'none';
    joinRow.innerHTML = '<input maxlength="4" placeholder="CODE" spellcheck="false"><button class="menu-btn small">Join</button>';
    const code = joinRow.querySelector('input')!;
    const go = () => {
      const c = code.value.trim().toUpperCase();
      if (c.length === 4) this.actions.join(c);
    };
    joinRow.querySelector('button')!.addEventListener('click', go);
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    button('Join a party', () => {
      joinRow.style.display = joinRow.style.display === 'none' ? 'flex' : 'none';
      code.focus();
    });
    menu.appendChild(joinRow);
    button('Settings', () => this.showSide(this.settings));
    button('Controls', () => this.showSide(this.controls));

    this.side.className = 'title-side';
    const foot = document.createElement('div');
    foot.className = 'title-foot';
    foot.textContent = 'Solo, or with up to three friends  ·  M6 polish build';
    const left = document.createElement('div');
    left.className = 'title-left';
    left.append(logo, tag, menu);
    this.root.append(left, this.side, foot);
    document.body.appendChild(this.root);
    document.body.classList.add('on-title');
  }

  private showSide(panel: HTMLElement): void {
    const same = this.side.firstChild === panel && this.side.style.display !== 'none';
    this.side.innerHTML = '';
    this.side.style.display = same ? 'none' : 'block';
    if (!same) this.side.appendChild(panel);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
    // The game's HUD stays hidden behind the title.
    document.body.classList.toggle('on-title', v);
    if (!v) this.side.style.display = 'none';
  }
}
