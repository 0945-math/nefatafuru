// モラバラバ (Morabaraba) - ゲームロジック

// ============== 型定義 ==============
export type Player = 1 | 2;
export type CellState = 0 | 1 | 2;
export type Board = CellState[];
export type Phase = 'placing' | 'moving';
export type PiecesCount = [number, number]; // [player1, player2]

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: Phase;
  piecesToPlace: PiecesCount;
  piecesOnBoard: PiecesCount;
  removingPiece: boolean;
  winner: Player | null;
  selectedPiece: number | null;
  message: string;
  moveCount: number;
}

// ============== 定数 ==============
export const BOARD_SIZE = 24;
export const INITIAL_PIECES = 12;

// 隣接リスト
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

// ミル（3つ並べ）の定義
export const MILLS: number[][] = [
  [0, 1, 2], [2, 14, 23], [21, 22, 23], [0, 9, 21],
  [3, 4, 5], [5, 13, 20], [18, 19, 20], [3, 10, 18],
  [6, 7, 8], [8, 12, 17], [15, 16, 17], [6, 11, 15],
  [1, 4, 7], [16, 19, 22], [9, 10, 11], [12, 13, 14],
];

// 視覚座標（グリッド 0-6）
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

// ============== ヘルパー関数 ==============
export const getPlayerIndex = (player: Player): number => player - 1;
export const getOpponent = (player: Player): Player => player === 1 ? 2 : 1;

// ============== 初期状態 ==============
export function createInitialState(): GameState {
  return {
    board: Array(BOARD_SIZE).fill(0) as Board,
    currentPlayer: 1,
    phase: 'placing',
    piecesToPlace: [INITIAL_PIECES, INITIAL_PIECES],
    piecesOnBoard: [0, 0],
    removingPiece: false,
    winner: null,
    selectedPiece: null,
    message: 'あなたの番です - 駒を配置してください',
    moveCount: 0,
  };
}

// ============== 判定関数 ==============
export function isInMill(board: Board, pos: number): boolean {
  const player = board[pos];
  if (player === 0) return false;
  return MILLS.some(mill =>
    mill.includes(pos) && mill.every(p => board[p] === player)
  );
}

export function canRemovePiece(board: Board, pos: number, opponent: Player): boolean {
  if (board[pos] !== opponent) return false;
  if (!isInMill(board, pos)) return true;
  
  // 全ての相手の駒がミルに含まれている場合のみ、ミルの駒を取れる
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (board[i] === opponent && !isInMill(board, i)) {
      return false;
    }
  }
  return true;
}

export function isFlying(board: Board, player: Player): boolean {
  return board.filter(c => c === player).length === 3;
}

export function hasValidMoves(board: Board, player: Player): boolean {
  const flying = isFlying(board, player);
  
  for (let from = 0; from < BOARD_SIZE; from++) {
    if (board[from] !== player) continue;
    
    if (flying) {
      if (board.some(c => c === 0)) return true;
    } else {
      if (ADJACENCY[from].some(to => board[to] === 0)) return true;
    }
  }
  
  return false;
}

// ============== 有効手取得関数 ==============
export function getValidPlacements(board: Board): number[] {
  return board
    .map((cell, index) => cell === 0 ? index : -1)
    .filter(index => index >= 0);
}

export function getValidTargets(board: Board, from: number, player: Player): number[] {
  if (isFlying(board, player)) {
    return board
      .map((cell, index) => cell === 0 && index !== from ? index : -1)
      .filter(index => index >= 0);
  }
  return ADJACENCY[from].filter(to => board[to] === 0);
}

export function getRemovablePieces(board: Board, opponent: Player): number[] {
  return board
    .map((cell, index) => cell === opponent && canRemovePiece(board, index, opponent) ? index : -1)
    .filter(index => index >= 0);
}

// ============== 内部ヘルパー ==============
function formsMill(board: Board, pos: number, player: Player): boolean {
  return MILLS.some(mill =>
    mill.includes(pos) && mill.every(p => board[p] === player)
  );
}

function createNewBoard(board: Board): Board {
  return [...board] as Board;
}

function checkMillAndHandleRemoval(
  state: GameState,
  newBoard: Board,
  pos: number
): GameState {
  if (!formsMill(newBoard, pos, state.currentPlayer)) {
    return advanceTurn(state);
  }

  const opponent = getOpponent(state.currentPlayer);
  const removable = getRemovablePieces(newBoard, opponent);
  
  if (removable.length === 0) {
    return advanceTurn(state);
  }

  const message = state.currentPlayer === 1
    ? '🎯 ミル成立！相手の駒を1つ選んで取ってください'
    : 'AIが駒を取ります...';

  return {
    ...state,
    board: newBoard,
    removingPiece: true,
    message,
  };
}

// ============== ゲームアクション ==============
export function placePiece(state: GameState, pos: number): GameState {
  if (state.board[pos] !== 0 || state.phase !== 'placing' || state.winner) {
    return state;
  }

  const playerIdx = getPlayerIndex(state.currentPlayer);
  const newBoard = createNewBoard(state.board);
  newBoard[pos] = state.currentPlayer;

  const newPiecesToPlace: PiecesCount = [...state.piecesToPlace];
  const newPiecesOnBoard: PiecesCount = [...state.piecesOnBoard];
  newPiecesToPlace[playerIdx]--;
  newPiecesOnBoard[playerIdx]++;

  const newState: GameState = {
    ...state,
    board: newBoard,
    piecesToPlace: newPiecesToPlace,
    piecesOnBoard: newPiecesOnBoard,
    moveCount: state.moveCount + 1,
  };

  return checkMillAndHandleRemoval(newState, newBoard, pos);
}

export function removePiece(state: GameState, pos: number): GameState {
  if (!state.removingPiece || state.winner) return state;

  const opponent = getOpponent(state.currentPlayer);
  if (!canRemovePiece(state.board, pos, opponent)) return state;

  const newBoard = createNewBoard(state.board);
  newBoard[pos] = 0;

  const opponentIdx = getPlayerIndex(opponent);
  const newPiecesOnBoard: PiecesCount = [...state.piecesOnBoard];
  newPiecesOnBoard[opponentIdx]--;

  return advanceTurn({
    ...state,
    board: newBoard,
    piecesOnBoard: newPiecesOnBoard,
    removingPiece: false,
  });
}

export function selectPiece(state: GameState, pos: number): GameState {
  if (state.phase !== 'moving' || state.winner || state.removingPiece) return state;
  if (state.board[pos] !== state.currentPlayer) return state;

  const targets = getValidTargets(state.board, pos, state.currentPlayer);
  if (targets.length === 0) {
    return { ...state, message: 'この駒は動かせません' };
  }

  const message = isFlying(state.board, state.currentPlayer)
    ? '🦅 フライトモード - 移動先を選択'
    : '移動先を選択してください';

  return {
    ...state,
    selectedPiece: pos,
    message,
  };
}

export function movePiece(state: GameState, from: number, to: number): GameState {
  if (state.phase !== 'moving' || state.winner || state.removingPiece) return state;
  if (state.board[from] !== state.currentPlayer) return state;
  if (state.board[to] !== 0) return state;

  const flying = isFlying(state.board, state.currentPlayer);
  if (!flying && !ADJACENCY[from].includes(to)) return state;

  const newBoard = createNewBoard(state.board);
  newBoard[from] = 0;
  newBoard[to] = state.currentPlayer;

  const newState: GameState = {
    ...state,
    board: newBoard,
    selectedPiece: null,
    moveCount: state.moveCount + 1,
  };

  return checkMillAndHandleRemoval(newState, newBoard, to);
}

// ============== ターン進行 ==============
function advanceTurn(state: GameState): GameState {
  const nextPlayer = getOpponent(state.currentPlayer);
  const nextPlayerIdx = getPlayerIndex(nextPlayer);

  // 勝利判定
  const nextTotal = state.piecesToPlace[nextPlayerIdx] + state.piecesOnBoard[nextPlayerIdx];
  if (nextTotal < 3) {
    const message = state.currentPlayer === 1
      ? '🎉 あなたの勝利です！'
      : '😔 AIの勝利...';

    return {
      ...state,
      currentPlayer: nextPlayer,
      winner: state.currentPlayer,
      message,
    };
  }

  // 移動フェーズへの移行
  if (state.piecesToPlace[0] === 0 && state.piecesToPlace[1] === 0 && state.phase === 'placing') {
    const canMove = hasValidMoves(state.board, nextPlayer);
    
    if (!canMove) {
      const message = state.currentPlayer === 1
        ? '🎉 相手が動けません！あなたの勝利！'
        : '😔 AIの勝利...';

      return {
        ...state,
        currentPlayer: nextPlayer,
        phase: 'moving',
        winner: state.currentPlayer,
        message,
      };
    }

    const flying = isFlying(state.board, nextPlayer);
    const message = nextPlayer === 1
      ? (flying ? '🦅 移動フェーズ開始！フライトモード' : '🔄 移動フェーズ開始！')
      : 'AIの番です...';

    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      selectedPiece: null,
      message,
    };
  }

  // 配置フェーズ中
  if (state.phase === 'placing') {
    const activePlayer = state.piecesToPlace[nextPlayerIdx] > 0 ? nextPlayer : state.currentPlayer;
    const message = activePlayer === 1
      ? `あなたの番です - 駒を配置してください（残り${state.piecesToPlace[0]}個）`
      : 'AIの番です...';

    return {
      ...state,
      currentPlayer: activePlayer,
      selectedPiece: null,
      message,
    };
  }

  // 移動フェーズ中
  const canMove = hasValidMoves(state.board, nextPlayer);
  if (!canMove) {
    const message = state.currentPlayer === 1
      ? '🎉 相手が動けません！あなたの勝利！'
      : '😔 AIの勝利...';

    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      winner: state.currentPlayer,
      message,
    };
  }

  const flying = isFlying(state.board, nextPlayer);
  const message = nextPlayer === 1
    ? (flying ? '🦅 あなたの番 - フライトモード！' : '🔄 あなたの番 - 駒を移動してください')
    : 'AIの番です...';

  return {
    ...state,
    currentPlayer: nextPlayer,
    phase: 'moving',
    selectedPiece: null,
    message,
  };
}
