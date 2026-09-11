// ネファタフル (Hnefatafl) - ヴァイキングチェス

export type Player = 'attacker' | 'defender';
export type CellState = 0 | 'attacker' | 'defender' | 'king';
export type Board = CellState[][];

export interface GameState {
  board: Board;
  currentPlayer: Player;
  winner: Player | null;
  selectedPiece: { x: number; y: number } | null;
  message: string;
  moveCount: number;
  capturedAttackers: number;
  capturedDefenders: number;
}

export const BOARD_SIZE = 11;

// 特殊な位置
export const CORNERS = [
  { x: 0, y: 0 },
  { x: 0, y: 10 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

export const CENTER = { x: 5, y: 5 };

// 攻撃側の初期配置（24駒 - 各辺に6駒ずつ）
const ATTACKER_POSITIONS = [
  // 上辺
  { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
  // 下辺
  { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 },
  // 左辺
  { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 },
  // 右辺
  { x: 10, y: 2 }, { x: 10, y: 3 }, { x: 10, y: 4 }, { x: 10, y: 5 }, { x: 10, y: 6 }, { x: 10, y: 7 },
];

// 防御側の初期配置（12駒 + 王）
const DEFENDER_POSITIONS = [
  // 王の周囲
  { x: 5, y: 3 }, { x: 5, y: 7 },
  { x: 3, y: 5 }, { x: 7, y: 5 },
  // 王の周囲の周囲
  { x: 4, y: 4 }, { x: 6, y: 4 },
  { x: 4, y: 6 }, { x: 6, y: 6 },
  { x: 4, y: 5 }, { x: 6, y: 5 },
  { x: 5, y: 4 }, { x: 5, y: 6 },
];

export function createInitialState(): GameState {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  
  // 攻撃側の駒を配置（24駒）
  for (const pos of ATTACKER_POSITIONS) {
    board[pos.y][pos.x] = 'attacker';
  }
  
  // 防御側の駒を配置（12駒）
  for (const pos of DEFENDER_POSITIONS) {
    board[pos.y][pos.x] = 'defender';
  }
  
  // 王を中央に配置
  board[5][5] = 'king';
  
  return {
    board,
    currentPlayer: 'attacker', // 攻撃側が先手
    winner: null,
    selectedPiece: null,
    message: '攻撃側の番です',
    moveCount: 0,
    capturedAttackers: 0,
    capturedDefenders: 0,
  };
}

export function isValidPosition(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function isCorner(x: number, y: number): boolean {
  return CORNERS.some(c => c.x === x && c.y === y);
}

export function isCenter(x: number, y: number): boolean {
  return x === CENTER.x && y === CENTER.y;
}

export function isThrone(x: number, y: number): boolean {
  return isCenter(x, y);
}

// 駒が移動可能かチェック
export function canMoveTo(state: GameState, fromX: number, fromY: number, toX: number, toY: number): boolean {
  // 盤外は不可
  if (!isValidPosition(toX, toY)) return false;
  
  // 移動先が空でなければならない
  if (state.board[toY][toX] !== 0) return false;
  
  // 特殊な位置（王座、四隅）には王しか入れない
  if (isThrone(toX, toY) || isCorner(toX, toY)) {
    const piece = state.board[fromY][fromX];
    if (piece !== 'king') return false;
  }
  
  // 縦または横の移動のみ
  if (fromX !== toX && fromY !== toY) return false;
  
  // 移動経路に駒がないかチェック
  if (fromX === toX) {
    // 縦移動
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);
    for (let y = minY + 1; y < maxY; y++) {
      if (state.board[y][fromX] !== 0) return false;
    }
  } else {
    // 横移動
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    for (let x = minX + 1; x < maxX; x++) {
      if (state.board[fromY][x] !== 0) return false;
    }
  }
  
  return true;
}

// 有効な移動先を取得
export function getValidMoves(state: GameState, x: number, y: number): { x: number; y: number }[] {
  const moves: { x: number; y: number }[] = [];
  const piece = state.board[y][x];
  
  if (piece === 0) return moves;
  
  // 上下左右に移動可能
  const directions = [
    { dx: 0, dy: -1 }, // 上
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
    { dx: 1, dy: 0 },  // 右
  ];
  
  for (const dir of directions) {
    let nx = x + dir.dx;
    let ny = y + dir.dy;
    
    while (isValidPosition(nx, ny)) {
      if (canMoveTo(state, x, y, nx, ny)) {
        moves.push({ x: nx, y: ny });
      } else {
        break;
      }
      nx += dir.dx;
      ny += dir.dy;
    }
  }
  
  return moves;
}

// 駒を捕獲できるかチェック
export function checkCapture(state: GameState, x: number, y: number, player: Player): { x: number; y: number }[] {
  const captured: { x: number; y: number }[] = [];
  const opponent = player === 'attacker' ? 'defender' : 'attacker';
  
  // 上下左右をチェック
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  
  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    
    if (!isValidPosition(nx, ny)) continue;
    
    const target = state.board[ny][nx];
    
    // 相手の駒（王を除く）
    if (target === opponent || (opponent === 'defender' && target === 'defender')) {
      // 反対側に自分の駒または特殊な位置があるか
      const oppositeX = nx + dir.dx;
      const oppositeY = ny + dir.dy;
      
      if (isValidPosition(oppositeX, oppositeY)) {
        const opposite = state.board[oppositeY][oppositeX];
        
        // 反対側に自分の駒がある
        if (opposite === player) {
          captured.push({ x: nx, y: ny });
        }
        
        // 反対側が特殊な位置（王座または四隅）
        if (isThrone(oppositeX, oppositeY) || isCorner(oppositeX, oppositeY)) {
          captured.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  return captured;
}

// 王を捕獲したかチェック
export function isKingCaptured(state: GameState): boolean {
  // 王の位置を探す
  let kingX = -1, kingY = -1;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.board[y][x] === 'king') {
        kingX = x;
        kingY = y;
        break;
      }
    }
    if (kingX !== -1) break;
  }
  
  if (kingX === -1) return false;
  
  // 盤端では捕獲不可（Fetlarルール）
  if (kingX === 0 || kingX === BOARD_SIZE - 1 || kingY === 0 || kingY === BOARD_SIZE - 1) {
    return false;
  }
  
  // 王の周囲4方向をチェック
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  
  let surroundedCount = 0;
  let isNextToThrone = false;
  
  // 玉座の隣かどうかチェック
  if ((kingX === 4 && kingY === 5) || (kingX === 6 && kingY === 5) ||
      (kingX === 5 && kingY === 4) || (kingX === 5 && kingY === 6)) {
    isNextToThrone = true;
  }
  
  for (const dir of directions) {
    const nx = kingX + dir.dx;
    const ny = kingY + dir.dy;
    
    if (!isValidPosition(nx, ny)) {
      // 盤外は敵側として扱う
      surroundedCount++;
      continue;
    }
    
    const piece = state.board[ny][nx];
    
    // 攻撃側の駒
    if (piece === 'attacker') {
      surroundedCount++;
      continue;
    }
    
    // 玉座（王が玉座の隣にある場合、玉座は敵対的）
    if (isThrone(nx, ny) && piece === 0) {
      if (isNextToThrone) {
        surroundedCount++;
      }
    }
    
    // 四隅（常に敵対的）
    if (isCorner(nx, ny) && piece === 0) {
      surroundedCount++;
    }
  }
  
  // 玉座の隣では3方向で十分、それ以外では4方向必要
  const requiredSides = isNextToThrone ? 3 : 4;
  return surroundedCount >= requiredSides;
}

// 王が脱出したかチェック
export function hasKingEscaped(state: GameState): boolean {
  for (const corner of CORNERS) {
    if (state.board[corner.y][corner.x] === 'king') {
      return true;
    }
  }
  return false;
}

// 駒を移動
export function movePiece(state: GameState, fromX: number, fromY: number, toX: number, toY: number): GameState {
  if (!canMoveTo(state, fromX, fromY, toX, toY)) return state;
  
  const newBoard = state.board.map(row => [...row]);
  const piece = newBoard[fromY][fromX];
  
  newBoard[fromY][fromX] = 0;
  newBoard[toY][toX] = piece;
  
  let newState: GameState = {
    ...state,
    board: newBoard,
    selectedPiece: null,
    moveCount: state.moveCount + 1,
  };
  
  // 捕獲チェック
  const player = state.currentPlayer;
  const captured = checkCapture(newState, toX, toY, player);
  
  let capturedAttackers = state.capturedAttackers;
  let capturedDefenders = state.capturedDefenders;
  
  for (const pos of captured) {
    const capturedPiece = newBoard[pos.y][pos.x];
    if (capturedPiece === 'attacker') {
      capturedAttackers++;
    } else if (capturedPiece === 'defender') {
      capturedDefenders++;
    }
    newBoard[pos.y][pos.x] = 0;
  }
  
  newState = {
    ...newState,
    board: newBoard,
    capturedAttackers,
    capturedDefenders,
  };
  
  // 勝利条件チェック
  if (player === 'attacker' && isKingCaptured(newState)) {
    return {
      ...newState,
      winner: 'attacker',
      message: '🏆 攻撃側の勝利！王を捕獲しました！',
    };
  }
  
  if (player === 'defender' && hasKingEscaped(newState)) {
    return {
      ...newState,
      winner: 'defender',
      message: '🏆 防御側の勝利！王が脱出しました！',
    };
  }
  
  // ターン切り替え
  const nextPlayer = player === 'attacker' ? 'defender' : 'attacker';
  return {
    ...newState,
    currentPlayer: nextPlayer,
    message: nextPlayer === 'attacker' ? '攻撃側の番です' : '防御側の番です',
  };
}
