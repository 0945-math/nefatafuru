import {GameState,Player,BOARD_SIZE,getValidMoves,movePiece} from './gameLogic';
type Move={fromX:number;fromY:number;toX:number;toY:number};
const ITERATION_MAP={beginner:100,easy:500,normal:2000,hard:5000,expert:10000} as const;
function generateMoves(state:GameState,p:Player):Move[]{const a:Move[]=[];for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++){const q=state.board[y][x];if((p==='attacker'&&q!=='attacker')||(p==='defender'&&q!=='defender'&&q!=='king'))continue;for(const t of getValidMoves(state,x,y))a.push({fromX:x,fromY:y,toX:t.x,toY:t.y});}return a;}
function score(state:GameState,ai:Player){if(state.winner)return state.winner===ai?1:0;let a=0,d=0,kx=5,ky=5;for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++){if(state.board[y][x]==='attacker')a++;if(state.board[y][x]==='defender')d++;if(state.board[y][x]==='king'){kx=x;ky=y;}}const material=ai==='attacker'?(a/24-d/12):((d/12)-(a/24));const corner=Math.min(kx+ky,20-kx+ky,kx+20-ky,40-kx-ky)/20;return Math.max(0,Math.min(1,.5+.25*material+(ai==='defender'?.35*(1-corner):-.35*(1-corner))));}
export interface AIMove extends Move{}
export function getAIMove(state:GameState,difficulty:keyof typeof ITERATION_MAP='normal'):AIMove|null{
 const moves=generateMoves(state,state.currentPlayer);if(!moves.length)return null;
 if(difficulty==='beginner'||(difficulty==='easy'&&Math.random()<.25)||(difficulty==='normal'&&Math.random()<.1)){return moves[Math.floor(Math.random()*moves.length)];}
 const ai=state.currentPlayer;let best=moves[0],bestScore=-Infinity;const iterations=ITERATION_MAP[difficulty];
 for(let i=0;i<Math.min(iterations,5000);i++){const m=moves[Math.floor(Math.random()*moves.length)];const s=movePiece(state,m.fromX,m.fromY,m.toX,m.toY);const v=score(s,ai)+(Math.random()*.08);if(v>bestScore){bestScore=v;best=m;}}
 return best;
}