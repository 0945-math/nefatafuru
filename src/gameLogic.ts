// Morabaraba (モラバラバ) Game Logic - Complete Rewrite

export type Player = 1 | 2;
export type CellState = 0 | 1 | 2;
export type Board = CellState[];
export type GamePhase = 'placing' | 'moving';

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: GamePhase;
  piecesToPlace: [number, number];
  piecesOnBoard: [number, number];
  removingPiece: boolean;
  winner: Player | null;
  selectedPiece: number | null;
  message: string;
  moveHistory: MoveRecord[];
  millCount: [number, number];
  lastMove: { from: number | null; to: number } | null;
}

export interface MoveRecord {
  player: Player;
  type: 'place' | 'move' | 'remove' | 'fly';
  from?: number;
  to: number;
  formedMill: boolean;
}

// Board positions (24 points)
// 0 --------- 1 --------- 2
// |           |           |
// |   3 ------4 ------ 5  |
// |   |       |       |   |
// |   |  6 -- 7 -- 8  |   |
// |   |  |         |  |   |
// 9 --10-11       12-13-- 14
// |   |  |         |  |   |
// |   | 15--16--17   |   |
// |   |       |       |   |
// |  18 -----19----- 20  |
// |           |           |
// 21--------- 22---------23

export const ADJACENCY: number[][] = [
  [1, 9],        // 0
  [0, 2, 4],     // 1
  [1, 14],       // 2
  [4, 10],       // 3
  [1, 3, 5, 7],  // 4
  [4, 13],       // 5
  [7, 11],       // 6
  [4, 6, 8],     // 7
  [7, 12],       // 8
  [0, 10, 21],   // 9
  [3, 9, 11, 18],// 10
  [6, 10, 15],   // 11
  [8, 13, 17],   // 12
  [5, 12, 14, 20],// 13
  [2, 13, 23],   // 14
  [11, 16],      // 15
  [15, 17, 19],  // 16
  [16, 12],      // 17
  [10, 19],      // 18
  [16, 18, 20, 22],// 19
  [19, 13],      // 20
  [9, 22],       // 21
  [21, 19, 23],  // 22
  [22, 14],      // 23
];

export const MILLS: number[][] = [
  [0, 1, 2], [2, 14, 23], [21, 22, 23], [0, 9, 21],
  [3, 4, 5], [5, 13, 20], [18, 19, 20], [3, 10, 18],
  [6, 7, 8], [8, 12, 17], [15, 16, 17], [6, 11, 15],
  [1, 4, 7], [16, 19, 22], [9, 10, 11], [12, 13, 14],
];

// Visual coordinates (grid 0-6)
export const POS_COORDS: { x: number; y: number }[] = [
  { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 },
  { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
  { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
  { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
  { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
  { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 },
  { x: 0, y: 6 }, { x: 3, y: 6 }, { x: 6, y: 6 },
];

// Position names for display
export const POS_NAMES: string[] = [
  'A1','D1','G1',
  'B2','D2','F2',
  'C3','D3','E3',
  'A4','B4','C4',
  'E4','F4','G4',
  'C5','D5','E5',
  'B6','D6','F6',
  'A7','D7','G7',
];

export function createInitialState(): GameState {
  return {
    board: Array(24).fill(0) as Board,
    currentPlayer: 1,
    phase: 'placing',
    piecesToPlace: [12, 12],
    piecesOnBoard: [0, 0],
    removingPiece: false,
    winner: null,
    selectedPiece: null,
    message: 'あなたの番です — 駒を配置してください',
    moveHistory: [],
    millCount: [0, 0],
    lastMove: null,
  };
}

export function getMillsForPosition(board: Board, pos: number, player: Player): number[][] {
  return MILLS.filter(mill =>
    mill.includes(pos) && mill.every(p => board[p] === player)
  );
}

export function isInMill(board: Board, pos: number): boolean {
  const cellValue = board[pos];
  if (cellValue === 0) return false;
  return MILLS.some(mill =>
    mill.includes(pos) && mill.every(p => board[p] === cellValue)
  );
}

export function canRemovePiece(board: Board, pos: number, opponent: Player): boolean {
  if (board[pos] !== opponent) return false;
  if (!isInMill(board, pos)) return true;
  const opponentPieces: number[] = [];
  for (let i = 0; i < 24; i++) {
    if (board[i] === opponent) opponentPieces.push(i);
  }
  return opponentPieces.every(p => isInMill(board, p));
}

export function isFlying(board: Board, player: Player): boolean {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (board[i] === player) count++;
  }
  return count === 3;
}

export function countPieces(board: Board, player: Player): number {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (board[i] === player) count++;
  }
  return count;
}

export function countMills(board: Board, player: Player): number {
  let count = 0;
  for (const mill of MILLS) {
    if (mill.every(p => board[p] === player)) count++;
  }
  return count;
}

export function getValidMoves(board: Board, player: Player, flying: boolean): [number, number][] {
  const moves: [number, number][] = [];
  for (let from = 0; from < 24; from++) {
    if (board[from] !== player) continue;
    if (flying) {
      for (let to = 0; to < 24; to++) {
        if (board[to] === 0 && from !== to) {
          moves.push([from, to]);
        }
      }
    } else {
      for (const to of ADJACENCY[from]) {
        if (board[to] === 0) {
          moves.push([from, to]);
        }
      }
    }
  }
  return moves;
}

export function hasValidMoves(board: Board, player: Player): boolean {
  const flying = isFlying(board, player);
  return getValidMoves(board, player, flying).length > 0;
}

export function getValidPlacements(board: Board): number[] {
  const result: number[] = [];
  for (let i = 0; i < 24; i++) {
    if (board[i] === 0) result.push(i);
  }
  return result;
}

export function getValidTargets(board: Board, from: number, player: Player): number[] {
  const flying = isFlying(board, player);
  if (flying) {
    const result: number[] = [];
    for (let i = 0; i < 24; i++) {
      if (board[i] === 0 && i !== from) result.push(i);
    }
    return result;
  }
  return ADJACENCY[from].filter(i => board[i] === 0);
}

export function getRemovablePieces(board: Board, opponent: Player): number[] {
  const result: number[] = [];
  for (let i = 0; i < 24; i++) {
    if (board[i] === opponent && canRemovePiece(board, i, opponent)) {
      result.push(i);
    }
  }
  return result;
}

// Core game actions that return new state
export function placePiece(state: GameState, pos: number): GameState {
  if (state.board[pos] !== 0 || state.phase !== 'placing' || state.winner) return state;

  const pIdx = state.currentPlayer - 1;
  const newBoard = [...state.board] as Board;
  newBoard[pos] = state.currentPlayer;

  const newPiecesToPlace: [number, number] = [...state.piecesToPlace];
  const newPiecesOnBoard: [number, number] = [...state.piecesOnBoard];
  newPiecesToPlace[pIdx]--;
  newPiecesOnBoard[pIdx]++;

  const mills = getMillsForPosition(newBoard, pos, state.currentPlayer);
  const formedMill = mills.length > 0;
  const newMillCount: [number, number] = [...state.millCount];
  if (formedMill) newMillCount[pIdx] += mills.length;

  const record: MoveRecord = {
    player: state.currentPlayer,
    type: 'place',
    to: pos,
    formedMill,
  };

  let newState: GameState = {
    ...state,
    board: newBoard,
    piecesToPlace: newPiecesToPlace,
    piecesOnBoard: newPiecesOnBoard,
    millCount: newMillCount,
    moveHistory: [...state.moveHistory, record],
    lastMove: { from: null, to: pos },
    selectedPiece: null,
  };

  if (formedMill) {
    const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
    const removable = getRemovablePieces(newBoard, opponent);
    if (removable.length > 0) {
      return {
        ...newState,
        removingPiece: true,
        message: '🎯 ミル成立！相手の駒を1つ選んで取ってください',
      };
    }
  }

  return advanceTurn(newState);
}

export function removePiece(state: GameState, pos: number): GameState {
  if (!state.removingPiece || state.winner) return state;

  const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
  if (!canRemovePiece(state.board, pos, opponent)) return state;

  const newBoard = [...state.board] as Board;
  newBoard[pos] = 0;

  const oppIdx = opponent - 1;
  const newPiecesOnBoard: [number, number] = [...state.piecesOnBoard];
  newPiecesOnBoard[oppIdx]--;

  const record: MoveRecord = {
    player: state.currentPlayer,
    type: 'remove',
    to: pos,
    formedMill: false,
  };

  const newState: GameState = {
    ...state,
    board: newBoard,
    piecesOnBoard: newPiecesOnBoard,
    removingPiece: false,
    moveHistory: [...state.moveHistory, record],
  };

  return advanceTurn(newState);
}

export function selectPiece(state: GameState, pos: number): GameState {
  if (state.phase !== 'moving' || state.winner || state.removingPiece) return state;
  if (state.board[pos] !== state.currentPlayer) return state;

  const targets = getValidTargets(state.board, pos, state.currentPlayer);
  if (targets.length === 0) {
    return { ...state, message: 'この駒は動かせません。別の駒を選んでください。' };
  }

  const flying = isFlying(state.board, state.currentPlayer);
  return {
    ...state,
    selectedPiece: pos,
    message: flying
      ? `🦅 フライトモード — 移動先を選んでください`
      : `駒を選択中 — 移動先を選んでください`,
  };
}

export function movePiece(state: GameState, from: number, to: number): GameState {
  if (state.phase !== 'moving' || state.winner || state.removingPiece) return state;
  if (state.board[from] !== state.currentPlayer) return state;
  if (state.board[to] !== 0) return state;

  const flying = isFlying(state.board, state.currentPlayer);
  if (!flying && !ADJACENCY[from].includes(to)) return state;

  const newBoard = [...state.board] as Board;
  newBoard[from] = 0;
  newBoard[to] = state.currentPlayer;

  const mills = getMillsForPosition(newBoard, to, state.currentPlayer);
  const formedMill = mills.length > 0;
  const pIdx = state.currentPlayer - 1;
  const newMillCount: [number, number] = [...state.millCount];
  if (formedMill) newMillCount[pIdx] += mills.length;

  const record: MoveRecord = {
    player: state.currentPlayer,
    type: flying ? 'fly' : 'move',
    from,
    to,
    formedMill,
  };

  let newState: GameState = {
    ...state,
    board: newBoard,
    millCount: newMillCount,
    moveHistory: [...state.moveHistory, record],
    lastMove: { from, to },
    selectedPiece: null,
  };

  if (formedMill) {
    const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
    const removable = getRemovablePieces(newBoard, opponent);
    if (removable.length > 0) {
      return {
        ...newState,
        removingPiece: true,
        message: '🎯 ミル成立！相手の駒を1つ選んで取ってください',
      };
    }
  }

  return advanceTurn(newState);
}

function advanceTurn(state: GameState): GameState {
  const nextPlayer: Player = state.currentPlayer === 1 ? 2 : 1;
  const nextIdx = nextPlayer - 1;
  const currIdx = state.currentPlayer - 1;

  // Check win: opponent has < 3 total pieces
  const nextTotal = state.piecesToPlace[nextIdx] + state.piecesOnBoard[nextIdx];
  if (nextTotal < 3) {
    return {
      ...state,
      currentPlayer: nextPlayer,
      winner: state.currentPlayer,
      message: state.currentPlayer === 1
        ? '🎉 おめでとうございます！あなたの勝利です！'
        : '😔 AIの勝利…もう一度挑戦しましょう！',
    };
  }

  // Check if we should transition to moving phase
  const bothDonePlacing = state.piecesToPlace[0] === 0 && state.piecesToPlace[1] === 0;

  if (bothDonePlacing && state.phase === 'placing') {
    // Transition to moving
    const canMove = hasValidMoves(state.board, nextPlayer);
    if (!canMove) {
      return {
        ...state,
        currentPlayer: nextPlayer,
        phase: 'moving',
        winner: state.currentPlayer,
        message: state.currentPlayer === 1
          ? '🎉 相手が動けません！あなたの勝利です！'
          : '😔 AIの勝利…もう一度挑戦しましょう！',
      };
    }
    const flying = isFlying(state.board, nextPlayer);
    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      selectedPiece: null,
      message: nextPlayer === 1
        ? (flying ? '🦅 移動フェーズ開始！フライトモードです' : '🔄 移動フェーズ開始！駒を移動してください')
        : 'AIの番です…',
    };
  }

  // Still in placing phase
  if (state.phase === 'placing') {
    // Does the next player still have pieces to place?
    if (state.piecesToPlace[nextIdx] > 0) {
      return {
        ...state,
        currentPlayer: nextPlayer,
        selectedPiece: null,
        message: nextPlayer === 1
          ? `あなたの番です — 駒を配置してください（残り${state.piecesToPlace[0]}個）`
          : 'AIの番です…',
      };
    } else {
      // Next player has no pieces to place, current player keeps placing
      return {
        ...state,
        selectedPiece: null,
        message: state.currentPlayer === 1
          ? `あなたの番です — 駒を配置してください（残り${state.piecesToPlace[0]}個）`
          : 'AIの番です…',
      };
    }
  }

  // Moving phase
  const canMove = hasValidMoves(state.board, nextPlayer);
  if (!canMove) {
    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      winner: state.currentPlayer,
      message: state.currentPlayer === 1
        ? '🎉 相手が動けません！あなたの勝利です！'
        : '😔 AIの勝利…もう一度挑戦しましょう！',
    };
  }

  const flying = isFlying(state.board, nextPlayer);
  return {
    ...state,
    currentPlayer: nextPlayer,
    phase: 'moving',
    selectedPiece: null,
    message: nextPlayer === 1
      ? (flying ? '🦅 あなたの番 — フライトモード！' : '🔄 あなたの番 — 駒を移動してください')
      : 'AIの番です…',
  };
}
