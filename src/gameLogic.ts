// ネファタフル (Hnefatafl) - ゲームロジック

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
}

export const BOARD_SIZE = 11;

export const CORNERS = [
  { x: 0, y: 0 },
  { x: 0, y: 10 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

export const CENTER = { x: 5, y: 5 };

// 攻撃側: 24駒（各辺に6駒）
const ATTACKER_POSITIONS = [
  { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
  { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 },
  { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 },
  { x: 10, y: 2 }, { x: 10, y: 3 }, { x: 10, y: 4 }, { x: 10, y: 5 }, { x: 10, y: 6 }, { x: 10, y: 7 },
];

// 防御側: 12駒
const DEFENDER_POSITIONS = [
  { x: 5, y: 3 }, { x: 5, y: 7 },
  { x: 3, y: 5 }, { x: 7, y: 5 },
  { x: 4, y: 4 }, { x: 6, y: 4 },
  { x: 4, y: 6 }, { x: 6, y: 6 },
  { x: 4, y: 5 }, { x: 6, y: 5 },
  { x: 5, y: 4 }, { x: 5, y: 6 },
];

export function createInitialState(): GameState {
  const board: Board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  
  for (const pos of ATTACKER_POSITIONS) {
    board[pos.y][pos.x] = 'attacker';
  }
  
  for (const pos of DEFENDER_POSITIONS) {
    board[pos.y][pos.x] = 'defender';
  }
  
  board[5][5] = 'king';
  
  return {
    board,
    currentPlayer: 'attacker',
    winner: null,
    selectedPiece: null,
    message: '攻撃側の番です',
    moveCount: 0,
  };
}

export function isValidPosition(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function isCorner(x: number, y: number): boolean {
  return CORNERS.some(c => c.x === x && c.y === y);
}

export function isThrone(x: number, y: number): boolean {
  return x === CENTER.x && y === CENTER.y;
}

export function canMoveTo(state: GameState, fromX: number, fromY: number, toX: number, toY: number): boolean {
  if (!isValidPosition(toX, toY)) return false;
  if (state.board[toY][toX] !== 0) return false;
  
  if (isThrone(toX, toY) || isCorner(toX, toY)) {
    const piece = state.board[fromY][fromX];
    if (piece !== 'king') return false;
  }
  
  if (fromX !== toX && fromY !== toY) return false;
  
  if (fromX === toX) {
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);
    for (let y = minY + 1; y < maxY; y++) {
      if (state.board[y][fromX] !== 0) return false;
    }
  } else {
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    for (let x = minX + 1; x < maxX; x++) {
      if (state.board[fromY][x] !== 0) return false;
    }
  }
  
  return true;
}

export function getValidMoves(state: GameState, x: number, y: number): { x: number; y: number }[] {
  const moves: { x: number; y: number }[] = [];
  const piece = state.board[y][x];
  
  if (piece === 0) return moves;
  
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
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

export function checkCapture(state: GameState, x: number, y: number, player: Player): { x: number; y: number }[] {
  const captured: { x: number; y: number }[] = [];
  const opponent = player === 'attacker' ? 'defender' : 'attacker';
  
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
    
    if (target === opponent || (opponent === 'defender' && target === 'defender')) {
      const oppositeX = nx + dir.dx;
      const oppositeY = ny + dir.dy;
      
      if (isValidPosition(oppositeX, oppositeY)) {
        const opposite = state.board[oppositeY][oppositeX];
        
        if (opposite === player) {
          captured.push({ x: nx, y: ny });
        }
        
        if (isThrone(oppositeX, oppositeY) || isCorner(oppositeX, oppositeY)) {
          captured.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  return captured;
}

export function isKingCaptured(state: GameState): boolean {
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
  
  if (kingX === 0 || kingX === BOARD_SIZE - 1 || kingY === 0 || kingY === BOARD_SIZE - 1) {
    return false;
  }
  
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  
  let surroundedCount = 0;
  let isNextToThrone = false;
  
  if ((kingX === 4 && kingY === 5) || (kingX === 6 && kingY === 5) ||
      (kingX === 5 && kingY === 4) || (kingX === 5 && kingY === 6)) {
    isNextToThrone = true;
  }
  
  for (const dir of directions) {
    const nx = kingX + dir.dx;
    const ny = kingY + dir.dy;
    
    if (!isValidPosition(nx, ny)) {
      surroundedCount++;
      continue;
    }
    
    const piece = state.board[ny][nx];
    
    if (piece === 'attacker') {
      surroundedCount++;
      continue;
    }
    
    if (isThrone(nx, ny) && piece === 0) {
      if (isNextToThrone) {
        surroundedCount++;
      }
    }
    
    if (isCorner(nx, ny) && piece === 0) {
      surroundedCount++;
    }
  }
  
  const requiredSides = isNextToThrone ? 3 : 4;
  return surroundedCount >= requiredSides;
}

export function hasKingEscaped(state: GameState): boolean {
  for (const corner of CORNERS) {
    if (state.board[corner.y][corner.x] === 'king') {
      return true;
    }
  }
  return false;
}

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
  
  const player = state.currentPlayer;
  const captured = checkCapture(newState, toX, toY, player);
  
  for (const pos of captured) {
    newBoard[pos.y][pos.x] = 0;
  }
  
  newState = {
    ...newState,
    board: newBoard,
  };
  
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
  
  const nextPlayer = player === 'attacker' ? 'defender' : 'attacker';
  return {
    ...newState,
    currentPlayer: nextPlayer,
    message: nextPlayer === 'attacker' ? '攻撃側の番です' : '防御側の番です',
  };
}
