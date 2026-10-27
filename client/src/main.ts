import './style.css';
import './theme.css';
import { Game } from './game/Game';

const container = document.getElementById('app')!;
new Game(container).start();
