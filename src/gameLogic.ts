// モラバラバ (Morabaraba) - Ultimate Game Logic

export type Player = 1 | 2;
export type CellState = 0 | 1 | 2;
export type Board = CellState[];

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: 'placing' | 'moving';
  piecesToPlace: [number, number];
  piecesOnBoard: [number, number];
  removingPiece: boolean;
  winner: Player | null;
  selectedPiece: number | null;
  message: string;
  moveCount: number;
  millsFormed: [number, number];
}

// 24 positions on the board
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
    message: 'あなたの番です - 駒を配置してください',
    moveCount: 0,
    millsFormed: [0, 0],
  };
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
  for (let i = 0; i < 24; i++) {
    if (board[i] === opponent && !isInMill(board, i)) {
      return false;
    }
  }
  return true;
}

export function isFlying(board: Board, player: Player): boolean {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (board[i] === player) count++;
  }
  return count === 3;
}

export function hasValidMoves(board: Board, player: Player): boolean {
  const flying = isFlying(board, player);
  for (let from = 0; from < 24; from++) {
    if (board[from] !== player) continue;
    if (flying) {
      for (let to = 0; to < 24; to++) {
        if (board[to] === 0 && from !== to) return true;
      }
    } else {
      for (const to of ADJACENCY[from]) {
        if (board[to] === 0) return true;
      }
    }
  }
  return false;
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

function formsMill(board: Board, pos: number, player: Player): boolean {
  return MILLS.some(mill =>
    mill.includes(pos) && mill.every(p => board[p] === player)
  );
}

function countMills(board: Board, player: Player): number {
  let count = 0;
  for (const mill of MILLS) {
    if (mill.every(p => board[p] === player)) count++;
  }
  return count;
}

export function placePiece(state: GameState, pos: number): GameState {
  if (state.board[pos] !== 0 || state.phase !== 'placing' || state.winner) return state;

  const pIdx = state.currentPlayer - 1;
  const newBoard = [...state.board] as Board;
  newBoard[pos] = state.currentPlayer;

  const newPiecesToPlace: [number, number] = [...state.piecesToPlace];
  const newPiecesOnBoard: [number, number] = [...state.piecesOnBoard];
  newPiecesToPlace[pIdx]--;
  newPiecesOnBoard[pIdx]++;

  const newMillsFormed: [number, number] = [...state.millsFormed];
  let millJustFormed = false;

  let newState: GameState = {
    ...state,
    board: newBoard,
    piecesToPlace: newPiecesToPlace,
    piecesOnBoard: newPiecesOnBoard,
    moveCount: state.moveCount + 1,
  };

  if (formsMill(newBoard, pos, state.currentPlayer)) {
    const newMills = countMills(newBoard, state.currentPlayer);
    const oldMills = countMills(state.board, state.currentPlayer);
    newMillsFormed[pIdx] += (newMills - oldMills);
    newState.millsFormed = newMillsFormed;
    millJustFormed = true;
  }

  if (millJustFormed) {
    const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
    const removable = getRemovablePieces(newBoard, opponent);
    if (removable.length > 0) {
      return {
        ...newState,
        removingPiece: true,
        message: state.currentPlayer === 1
          ? '🎯 ミル成立！相手の駒を1つ選んで取ってください'
          : 'AIが駒を取ります...',
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

  const newState: GameState = {
    ...state,
    board: newBoard,
    piecesOnBoard: newPiecesOnBoard,
    removingPiece: false,
  };

  return advanceTurn(newState);
}

export function selectPiece(state: GameState, pos: number): GameState {
  if (state.phase !== 'moving' || state.winner || state.removingPiece) return state;
  if (state.board[pos] !== state.currentPlayer) return state;

  const targets = getValidTargets(state.board, pos, state.currentPlayer);
  if (targets.length === 0) {
    return { ...state, message: 'この駒は動かせません' };
  }

  const flying = isFlying(state.board, state.currentPlayer);
  return {
    ...state,
    selectedPiece: pos,
    message: flying ? '🦅 フライトモード - 移動先を選択' : '移動先を選択してください',
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

  const pIdx = state.currentPlayer - 1;
  const newMillsFormed: [number, number] = [...state.millsFormed];
  let millJustFormed = false;

  let newState: GameState = {
    ...state,
    board: newBoard,
    selectedPiece: null,
    moveCount: state.moveCount + 1,
  };

  if (formsMill(newBoard, to, state.currentPlayer)) {
    const newMills = countMills(newBoard, state.currentPlayer);
    const oldMills = countMills(state.board, state.currentPlayer);
    newMillsFormed[pIdx] += (newMills - oldMills);
    newState.millsFormed = newMillsFormed;
    millJustFormed = true;
  }

  if (millJustFormed) {
    const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
    const removable = getRemovablePieces(newBoard, opponent);
    if (removable.length > 0) {
      return {
        ...newState,
        removingPiece: true,
        message: state.currentPlayer === 1
          ? '🎯 ミル成立！相手の駒を1つ選んで取ってください'
          : 'AIが駒を取ります...',
      };
    }
  }

  return advanceTurn(newState);
}

function advanceTurn(state: GameState): GameState {
  const nextPlayer: Player = state.currentPlayer === 1 ? 2 : 1;
  const nextIdx = nextPlayer - 1;

  const nextTotal = state.piecesToPlace[nextIdx] + state.piecesOnBoard[nextIdx];
  if (nextTotal < 3) {
    return {
      ...state,
      currentPlayer: nextPlayer,
      winner: state.currentPlayer,
      message: state.currentPlayer === 1
        ? '🎉 おめでとうございます！あなたの勝利です！'
        : '😔 AIの勝利...もう一度挑戦しましょう！',
    };
  }

  if (state.piecesToPlace[0] === 0 && state.piecesToPlace[1] === 0 && state.phase === 'placing') {
    const canMove = hasValidMoves(state.board, nextPlayer);
    if (!canMove) {
      return {
        ...state,
        currentPlayer: nextPlayer,
        phase: 'moving',
        winner: state.currentPlayer,
        message: state.currentPlayer === 1
          ? '🎉 相手が動けません！あなたの勝利です！'
          : '😔 AIの勝利...',
      };
    }
    const flying = isFlying(state.board, nextPlayer);
    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      selectedPiece: null,
      message: nextPlayer === 1
        ? (flying ? '🦅 移動フェーズ開始！フライトモード' : '🔄 移動フェーズ開始！駒を移動してください')
        : 'AIの番です...',
    };
  }

  if (state.phase === 'placing') {
    if (state.piecesToPlace[nextIdx] > 0) {
      return {
        ...state,
        currentPlayer: nextPlayer,
        selectedPiece: null,
        message: nextPlayer === 1
          ? `あなたの番です - 駒を配置してください（残り${state.piecesToPlace[0]}個）`
          : 'AIの番です...',
      };
    } else {
      return {
        ...state,
        selectedPiece: null,
        message: state.currentPlayer === 1
          ? `あなたの番です - 駒を配置してください（残り${state.piecesToPlace[0]}個）`
          : 'AIの番です...',
      };
    }
  }

  const canMove = hasValidMoves(state.board, nextPlayer);
  if (!canMove) {
    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      winner: state.currentPlayer,
      message: state.currentPlayer === 1
        ? '🎉 相手が動けません！あなたの勝利です！'
        : '😔 AIの勝利...',
    };
  }

  const flying = isFlying(state.board, nextPlayer);
  return {
    ...state,
    currentPlayer: nextPlayer,
    phase: 'moving',
    selectedPiece: null,
    message: nextPlayer === 1
      ? (flying ? '🦅 あなたの番 - フライトモード！' : '🔄 あなたの番 - 駒を移動してください')
      : 'AIの番です...',
  };
}
