// ネファタフル (Hnefatafl) - ゲームロジック
export type Player = 'attacker' | 'defender';
export type CellState = 0 | 'attacker' | 'defender' | 'king';
export type Board = CellState[][];
export interface GameState {
  board: Board; currentPlayer: Player; winner: Player | null;
  selectedPiece: { x: number; y: number } | null; message: string; moveCount: number;
}
export const BOARD_SIZE = 11;
export const CORNERS = [{x:0,y:0},{x:0,y:10},{x:10,y:0},{x:10,y:10}];
export const CENTER = {x:5,y:5};
const ATTACKER_POSITIONS=[
{x:3,y:0},{x:4,y:0},{x:5,y:0},{x:6,y:0},{x:7,y:0},{x:5,y:1},
{x:3,y:10},{x:4,y:10},{x:5,y:10},{x:6,y:10},{x:7,y:10},{x:5,y:9},
{x:0,y:3},{x:0,y:4},{x:0,y:5},{x:0,y:6},{x:0,y:7},{x:1,y:5},
{x:10,y:3},{x:10,y:4},{x:10,y:5},{x:10,y:6},{x:10,y:7},{x:9,y:5}];
const DEFENDER_POSITIONS=[
{x:5,y:3},{x:5,y:7},{x:3,y:5},{x:7,y:5},{x:4,y:4},{x:6,y:4},
{x:4,y:6},{x:6,y:6},{x:4,y:5},{x:6,y:5},{x:5,y:4},{x:5,y:6}];
export function createInitialState():GameState{
 const board:Board=Array.from({length:BOARD_SIZE},()=>Array< CellState>(BOARD_SIZE).fill(0));
 for(const p of ATTACKER_POSITIONS) board[p.y][p.x]='attacker';
 for(const p of DEFENDER_POSITIONS) board[p.y][p.x]='defender';
 board[5][5]='king';
 return {board,currentPlayer:'attacker',winner:null,selectedPiece:null,message:'攻撃側の番です',moveCount:0};
}
export function isValidPosition(x:number,y:number){return x>=0&&x<BOARD_SIZE&&y>=0&&y<BOARD_SIZE;}
export function isCorner(x:number,y:number){return CORNERS.some(c=>c.x===x&&c.y===y);}
export function isThrone(x:number,y:number){return x===5&&y===5;}
export function canMoveTo(state:GameState,fx:number,fy:number,tx:number,ty:number){
 if(!isValidPosition(tx,ty)||state.board[ty][tx]!==0) return false;
 const piece=state.board[fy][fx]; if(piece===0) return false;
 if((isThrone(tx,ty)||isCorner(tx,ty))&&piece!=='king') return false;
 if(fx!==tx&&fy!==ty)return false;
 if(fx===tx){for(let y=Math.min(fy,ty)+1;y<Math.max(fy,ty);y++)if(state.board[y][fx]!==0)return false;}
 else {for(let x=Math.min(fx,tx)+1;x<Math.max(fx,tx);x++)if(state.board[fy][x]!==0)return false;}
 return true;
}
export function getValidMoves(state:GameState,x:number,y:number){
 const moves:{x:number;y:number}[]=[]; if(state.board[y][x]===0)return moves;
 for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
  let nx=x+dx,ny=y+dy;
  while(isValidPosition(nx,ny)){if(canMoveTo(state,x,y,nx,ny))moves.push({x:nx,y:ny});else break;nx+=dx;ny+=dy;}
 } return moves;
}
export function checkCapture(state:GameState,x:number,y:number,player:Player){
 const captured:{x:number;y:number}[]=[]; const opponent=player==='attacker'?'defender':'attacker';
 const hostile=(sx:number,sy:number,victim:'attacker'|'defender')=>{
  if(!isValidPosition(sx,sy)||isCorner(sx,sy))return true;
  return isThrone(sx,sy)&&(victim==='attacker'||state.board[sy][sx]===0);
 };
 for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
  const nx=x+dx,ny=y+dy;if(!isValidPosition(nx,ny)||state.board[ny][nx]!==opponent)continue;
  const ox=nx+dx,oy=ny+dy;
  if(hostile(ox,oy,opponent)||state.board[oy]?.[ox]===player)captured.push({x:nx,y:ny});
 } return captured;
}
export function isKingCaptured(state:GameState){
 let kx=-1,ky=-1;for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++)if(state.board[y][x]==='king'){kx=x;ky=y;}
 if(kx<0)return true;
 const dirs=[[0,-1],[0,1],[-1,0],[1,0]];
 const on= isThrone(kx,ky), adj=Math.abs(kx-5)+Math.abs(ky-5)===1;
 if(on||adj)return dirs.every(([dx,dy])=>{const x=kx+dx,y=ky+dy;if(!isValidPosition(x,y))return true;return state.board[y][x]==='attacker'||isThrone(x,y)||isCorner(x,y);});
 for(const [dx,dy] of dirs){const ax=kx-dx,ay=ky-dy,bx=kx+dx,by=ky+dy;
  if(isValidPosition(ax,ay)&&isValidPosition(bx,by)&&state.board[ay][ax]==='attacker'&&state.board[by][bx]==='attacker')return true;}
 return false;
}
export function hasKingEscaped(state:GameState){return CORNERS.some(c=>state.board[c.y][c.x]==='king');}
export function movePiece(state:GameState,fx:number,fy:number,tx:number,ty:number):GameState{
 if(!canMoveTo(state,fx,fy,tx,ty))return state;
 const board=state.board.map(r=>[...r]);const piece=board[fy][fx];board[fy][fx]=0;board[ty][tx]=piece;
 const next:{board:Board;currentPlayer:Player;winner:Player|null;selectedPiece:null;message:string;moveCount:number}={...state,board,selectedPiece:null,moveCount:state.moveCount+1};
 for(const p of checkCapture(next,tx,ty,state.currentPlayer))board[p.y][p.x]=0;
 if(state.currentPlayer==='attacker'&&isKingCaptured(next))return {...next,winner:'attacker',message:'攻撃側の勝利！王を捕獲しました！'};
 if(state.currentPlayer==='defender'&&hasKingEscaped(next))return {...next,winner:'defender',message:'防御側の勝利！王が脱出しました！'};
 const np=state.currentPlayer==='attacker'?'defender':'attacker';return {...next,currentPlayer:np,message:np==='attacker'?'攻撃側の番です':'防御側の番です'};
}