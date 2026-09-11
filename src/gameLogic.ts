// Morabaraba (モラバラバ) Game Logic

export type Player = 1 | 2;
export type CellState = 0 | 1 | 2; // 0: empty, 1: player1, 2: player2
export type Board = CellState[];
export type Phase = 'placing' | 'moving' | 'removing';

export interface GameState {
  board: Board;
  currentPlayer: Player;
  phase: Phase;
  piecesToPlace: [number, number]; // [player1, player2]
  piecesOnBoard: [number, number];
  removingPiece: boolean;
  lastMill: number[] | null;
  winner: Player | null;
  selectedPiece: number | null;
  message: string;
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

// Adjacency list for each position
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

// All possible mills (three in a row)
export const MILLS: number[][] = [
  // Outer square
  [0, 1, 2],
  [2, 14, 23],
  [21, 22, 23],
  [0, 9, 21],
  // Middle square
  [3, 4, 5],
  [5, 13, 20],
  [18, 19, 20],
  [3, 10, 18],
  // Inner square
  [6, 7, 8],
  [8, 12, 17],
  [15, 16, 17],
  [6, 11, 15],
  // Cross lines
  [1, 4, 7],
  [16, 19, 22],
  [9, 10, 11],
  [12, 13, 14],
];

// Position coordinates for rendering (on a 6x6 grid)
export const POSITIONS: [number, number][] = [
  [0, 0], [1, 0], [2, 0],       // 0, 1, 2
  [0.5, 0.5], [1, 0.5], [1.5, 0.5], // 3, 4, 5
  [1, 1], [1.5, 1], [2, 1],     // Wait, this doesn't work well
];

// Let me use a simpler coordinate system
// Using percentage-based positions for SVG rendering
export const POS_COORDS: { x: number; y: number }[] = [
  { x: 0, y: 0 },     // 0
  { x: 3, y: 0 },     // 1
  { x: 6, y: 0 },     // 2
  { x: 1, y: 1 },     // 3
  { x: 3, y: 1 },     // 4
  { x: 5, y: 1 },     // 5
  { x: 2, y: 2 },     // 6
  { x: 3, y: 2 },     // 7
  { x: 4, y: 2 },     // 8
  { x: 0, y: 3 },     // 9
  { x: 1, y: 3 },     // 10
  { x: 2, y: 3 },     // 11
  { x: 4, y: 3 },     // 12
  { x: 5, y: 3 },     // 13
  { x: 6, y: 3 },     // 14
  { x: 2, y: 4 },     // 15
  { x: 3, y: 4 },     // 16
  { x: 4, y: 4 },     // 17
  { x: 1, y: 5 },     // 18
  { x: 3, y: 5 },     // 19
  { x: 5, y: 5 },     // 20
  { x: 0, y: 6 },     // 21
  { x: 3, y: 6 },     // 22
  { x: 6, y: 6 },     // 23
];

export function createInitialState(): GameState {
  return {
    board: Array(24).fill(0) as Board,
    currentPlayer: 1,
    phase: 'placing',
    piecesToPlace: [12, 12],
    piecesOnBoard: [0, 0],
    removingPiece: false,
    lastMill: null,
    winner: null,
    selectedPiece: null,
    message: 'プレイヤー1の番です（配置フェーズ）',
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
  const player = cellValue as Player;
  return MILLS.some(mill => 
    mill.includes(pos) && mill.every(p => board[p] === player)
  );
}

export function canRemovePiece(board: Board, pos: number, opponent: Player): boolean {
  // Can't remove a piece that's in a mill, unless all opponent pieces are in mills
  if (!isInMill(board, pos)) return true;
  // Check if all opponent pieces are in mills
  const opponentPieces = board.reduce<number[]>((acc, cell, idx) => {
    if (cell === opponent) acc.push(idx);
    return acc;
  }, []);
  return opponentPieces.every(p => isInMill(board, p));
}

export function getValidMoves(board: Board, player: Player, flying: boolean): [number, number][] {
  const moves: [number, number][] = [];
  
  for (let from = 0; from < 24; from++) {
    if (board[from] !== player) continue;
    
    if (flying) {
      // Can move to any empty position
      for (let to = 0; to < 24; to++) {
        if (board[to] === 0 && from !== to) {
          moves.push([from, to]);
        }
      }
    } else {
      // Can only move to adjacent empty positions
      for (const to of ADJACENCY[from]) {
        if (board[to] === 0) {
          moves.push([from, to]);
        }
      }
    }
  }
  
  return moves;
}

export function isFlying(board: Board, player: Player): boolean {
  const pieceCount = board.filter(c => c === player).length;
  return pieceCount === 3;
}

export function hasValidMoves(board: Board, player: Player): boolean {
  const flying = isFlying(board, player);
  return getValidMoves(board, player, flying).length > 0;
}

export function checkWinner(board: Board, piecesToPlace: [number, number], piecesOnBoard: [number, number]): Player | null {
  // Check if any player has fewer than 3 pieces and no pieces to place
  for (const player of [1, 2] as Player[]) {
    const idx = player - 1;
    const totalPieces = piecesToPlace[idx] + piecesOnBoard[idx];
    if (totalPieces < 3) {
      return player === 1 ? 2 : 1;
    }
  }
  
  // Check if current player (the one who just moved) has no valid moves
  // This is checked after a move is made
  return null;
}

export function placePiece(state: GameState, pos: number): GameState {
  if (state.board[pos] !== 0) return state;
  if (state.phase !== 'placing') return state;
  
  const newBoard = [...state.board] as Board;
  newBoard[pos] = state.currentPlayer;
  
  const newPiecesToPlace: [number, number] = [...state.piecesToPlace];
  const newPiecesOnBoard: [number, number] = [...state.piecesOnBoard];
  const idx = state.currentPlayer - 1;
  newPiecesToPlace[idx]--;
  newPiecesOnBoard[idx]++;
  
  // Check if a mill was formed
  const newMills = getMillsForPosition(newBoard, pos, state.currentPlayer);
  
  if (newMills.length > 0) {
    // Player formed a mill, can remove opponent's piece
    const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
    const removablePieces = Array.from({ length: 24 }, (_, i) => i)
      .filter(i => newBoard[i] === opponent && canRemovePiece(newBoard, i, opponent));
    
    if (removablePieces.length > 0) {
      return {
        ...state,
        board: newBoard,
        piecesToPlace: newPiecesToPlace,
        piecesOnBoard: newPiecesOnBoard,
        removingPiece: true,
        lastMill: newMills[0],
        message: `ミル成立！相手の駒を1つ取ってください`,
      };
    }
  }
  
  // No mill or no removable pieces, switch player
  return switchPlayerAfterPlace({
    ...state,
    board: newBoard,
    piecesToPlace: newPiecesToPlace,
    piecesOnBoard: newPiecesOnBoard,
    lastMill: null,
  });
}

export function removePiece(state: GameState, pos: number): GameState {
  if (!state.removingPiece) return state;
  
  const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
  if (state.board[pos] !== opponent) return state;
  if (!canRemovePiece(state.board, pos, opponent)) return state;
  
  const newBoard = [...state.board] as Board;
  newBoard[pos] = 0;
  
  const newPiecesOnBoard: [number, number] = [...state.piecesOnBoard];
  const oppIdx = opponent - 1;
  newPiecesOnBoard[oppIdx]--;
  
  // Check winner
  const winner = checkWinner(newBoard, state.piecesToPlace, newPiecesOnBoard);
  if (winner) {
    return {
      ...state,
      board: newBoard,
      piecesOnBoard: newPiecesOnBoard,
      removingPiece: false,
      lastMill: null,
      winner,
      message: `プレイヤー${winner}の勝利！`,
    };
  }
  
  if (state.phase === 'placing') {
    return switchPlayerAfterPlace({
      ...state,
      board: newBoard,
      piecesOnBoard: newPiecesOnBoard,
      removingPiece: false,
      lastMill: null,
    });
  } else {
    return switchPlayerAfterMove({
      ...state,
      board: newBoard,
      piecesOnBoard: newPiecesOnBoard,
      removingPiece: false,
      lastMill: null,
    });
  }
}

function switchPlayerAfterPlace(state: GameState): GameState {
  const nextPlayer: Player = state.currentPlayer === 1 ? 2 : 1;
  const nextIdx = nextPlayer - 1;
  
  // Check if both players have placed all pieces
  if (state.piecesToPlace[0] === 0 && state.piecesToPlace[1] === 0) {
    // Transition to moving phase
    const canMove = hasValidMoves(state.board, nextPlayer);
    if (!canMove) {
      return {
        ...state,
        currentPlayer: nextPlayer,
        phase: 'moving',
        winner: state.currentPlayer,
        message: `プレイヤー${state.currentPlayer}の勝利！（相手が動けません）`,
      };
    }
    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      selectedPiece: null,
      message: `プレイヤー${nextPlayer}の番です（移動フェーズ）`,
    };
  }
  
  // Check if next player still has pieces to place
  if (state.piecesToPlace[nextIdx] > 0) {
    return {
      ...state,
      currentPlayer: nextPlayer,
      selectedPiece: null,
      message: `プレイヤー${nextPlayer}の番です（配置フェーズ）`,
    };
  }
  
  // Next player has no pieces to place, current player continues placing
  return {
    ...state,
    selectedPiece: null,
    message: `プレイヤー${state.currentPlayer}の番です（配置フェーズ）`,
  };
}

function switchPlayerAfterMove(state: GameState): GameState {
  const nextPlayer: Player = state.currentPlayer === 1 ? 2 : 1;
  const flying = isFlying(state.board, nextPlayer);
  const canMove = hasValidMoves(state.board, nextPlayer);
  
  if (!canMove) {
    return {
      ...state,
      currentPlayer: nextPlayer,
      phase: 'moving',
      winner: state.currentPlayer,
      selectedPiece: null,
      message: `プレイヤー${state.currentPlayer}の勝利！（相手が動けません）`,
    };
  }
  
  const phaseText = flying ? 'フライトフェーズ' : '移動フェーズ';
  return {
    ...state,
    currentPlayer: nextPlayer,
    phase: 'moving',
    selectedPiece: null,
    message: `プレイヤー${nextPlayer}の番です（${phaseText}）`,
  };
}

export function selectPiece(state: GameState, pos: number): GameState {
  if (state.phase !== 'moving') return state;
  if (state.board[pos] !== state.currentPlayer) return state;
  
  return {
    ...state,
    selectedPiece: pos,
    message: `駒${pos}を選択中。移動先を選んでください。`,
  };
}

export function movePiece(state: GameState, from: number, to: number): GameState {
  if (state.phase !== 'moving') return state;
  if (state.board[from] !== state.currentPlayer) return state;
  if (state.board[to] !== 0) return state;
  
  const flying = isFlying(state.board, state.currentPlayer);
  
  if (!flying && !ADJACENCY[from].includes(to)) return state;
  
  const newBoard = [...state.board] as Board;
  newBoard[from] = 0;
  newBoard[to] = state.currentPlayer;
  
  // Check if a mill was formed
  const newMills = getMillsForPosition(newBoard, to, state.currentPlayer);
  
  if (newMills.length > 0) {
    const opponent: Player = state.currentPlayer === 1 ? 2 : 1;
    const removablePieces = Array.from({ length: 24 }, (_, i) => i)
      .filter(i => newBoard[i] === opponent && canRemovePiece(newBoard, i, opponent));
    
    if (removablePieces.length > 0) {
      return {
        ...state,
        board: newBoard,
        removingPiece: true,
        selectedPiece: null,
        lastMill: newMills[0],
        message: `ミル成立！相手の駒を1つ取ってください`,
      };
    }
  }
  
  return switchPlayerAfterMove({
    ...state,
    board: newBoard,
    selectedPiece: null,
    lastMill: null,
  });
}

export function getValidPlacements(board: Board): number[] {
  return Array.from({ length: 24 }, (_, i) => i).filter(i => board[i] === 0);
}

export function getValidTargets(board: Board, from: number, player: Player): number[] {
  const flying = isFlying(board, player);
  if (flying) {
    return Array.from({ length: 24 }, (_, i) => i).filter(i => board[i] === 0 && i !== from);
  }
  return ADJACENCY[from].filter(i => board[i] === 0);
}

export function getRemovablePieces(board: Board, opponent: Player): number[] {
  return Array.from({ length: 24 }, (_, i) => i)
    .filter(i => board[i] === opponent && canRemovePiece(board, i, opponent));
}
