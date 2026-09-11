// Ultimate AI for Morabaraba - Minimax with Alpha-Beta Pruning & Iterative Deepening
import {
  Board, Player, GameState, ADJACENCY, MILLS,
  isInMill, canRemovePiece,
  isFlying, hasValidMoves,
  getValidPlacements, getRemovablePieces,
} from './gameLogic';

const DEPTH_MAP = { easy: 2, normal: 4, hard: 6 };

// Position weights - center and intersections are more valuable
const POS_WEIGHT: number[] = [
  2, 3, 2,
  3, 5, 3,
  4, 5, 4,
  2, 4, 5,
  5, 4, 2,
  4, 5, 4,
  3, 5, 3,
  2, 3, 2,
];

interface Move {
  type: 'place' | 'move';
  from?: number;
  to: number;
}

function generateMoves(board: Board, player: Player, piecesToPlace: [number, number]): Move[] {
  const idx = player - 1;
  const moves: Move[] = [];

  if (piecesToPlace[idx] > 0) {
    for (const pos of getValidPlacements(board)) {
      moves.push({ type: 'place', to: pos });
    }
  } else {
    const flying = isFlying(board, player);
    for (let from = 0; from < 24; from++) {
      if (board[from] !== player) continue;
      if (flying) {
        for (let to = 0; to < 24; to++) {
          if (board[to] === 0 && from !== to) moves.push({ type: 'move', from, to });
        }
      } else {
        for (const to of ADJACENCY[from]) {
          if (board[to] === 0) moves.push({ type: 'move', from, to });
        }
      }
    }
  }
  return moves;
}

function applyMove(board: Board, move: Move, player: Player): Board {
  const newBoard = [...board] as Board;
  if (move.type === 'place') {
    newBoard[move.to] = player;
  } else {
    newBoard[move.from!] = 0;
    newBoard[move.to] = player;
  }
  return newBoard;
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

function countPieces(board: Board, player: Player): number {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (board[i] === player) count++;
  }
  return count;
}

// Smart removal: pick the piece that hurts opponent most
function getBestRemoval(board: Board, removingPlayer: Player): number {
  const opponent: Player = removingPlayer === 1 ? 2 : 1;
  const removable = getRemovablePieces(board, opponent);

  if (removable.length === 0) return -1;
  if (removable.length === 1) return removable[0];

  let bestPiece = removable[0];
  let bestScore = -Infinity;

  for (const pos of removable) {
    let score = 0;
    
    // Prefer removing pieces that are part of potential mills
    for (const mill of MILLS) {
      if (!mill.includes(pos)) continue;
      const oppCount = mill.filter(p => board[p] === opponent).length;
      if (oppCount === 2) score += 100;
      if (oppCount === 3) score += 200;
    }
    
    // Prefer removing pieces at valuable positions
    score += POS_WEIGHT[pos] * 20;
    
    // Prefer removing pieces with many connections
    const adjOwn = ADJACENCY[pos].filter(a => board[a] === opponent).length;
    score += adjOwn * 30;
    
    // Prefer removing pieces that block opponent's flying
    const oppCount = countPieces(board, opponent);
    if (oppCount === 4) score += 50; // Removing could prevent flying

    if (score > bestScore) {
      bestScore = score;
      bestPiece = pos;
    }
  }
  return bestPiece;
}

function evaluate(board: Board, piecesToPlace: [number, number], piecesOnBoard: [number, number]): number {
  const p1Total = piecesToPlace[0] + piecesOnBoard[0];
  const p2Total = piecesToPlace[1] + piecesOnBoard[1];
  if (p1Total < 3) return 100000;
  if (p2Total < 3) return -100000;

  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 100000;
    if (!hasValidMoves(board, 2)) return -100000;
  }

  let score = 0;

  // Material (piece count) - very important
  score += (piecesOnBoard[1] - piecesOnBoard[0]) * 1000;
  score += (piecesToPlace[1] - piecesToPlace[0]) * 250;

  // Mills formed
  score += (countMills(board, 2) - countMills(board, 1)) * 600;

  // Two-in-a-row potential
  for (const mill of MILLS) {
    const p2 = mill.filter(p => board[p] === 2).length;
    const p1 = mill.filter(p => board[p] === 1).length;
    const empty = mill.filter(p => board[p] === 0).length;
    if (p2 === 2 && empty === 1) score += 200;
    if (p1 === 2 && empty === 1) score -= 200;
    if (p2 === 1 && empty === 2) score += 30;
    if (p1 === 1 && empty === 2) score -= 30;
  }

  // Position
  for (let i = 0; i < 24; i++) {
    if (board[i] === 2) score += POS_WEIGHT[i] * 25;
    if (board[i] === 1) score -= POS_WEIGHT[i] * 25;
  }

  // Mobility
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    const f1 = isFlying(board, 1);
    const f2 = isFlying(board, 2);
    const m1 = generateMoves(board, 1, piecesToPlace).length;
    const m2 = generateMoves(board, 2, piecesToPlace).length;
    score += (m2 - m1) * 15;
    if (f2 && !f1) score += 300;
    if (f1 && !f2) score -= 300;
  }

  // Blocking opponent mills
  for (const mill of MILLS) {
    const p1 = mill.filter(p => board[p] === 1).length;
    const p2 = mill.filter(p => board[p] === 2).length;
    if (p1 === 2 && p2 === 1) score += 100;
    if (p2 === 2 && p1 === 1) score -= 100;
  }

  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  piecesToPlace: [number, number],
  piecesOnBoard: [number, number],
): number {
  const player: Player = isMaximizing ? 2 : 1;

  const p1Total = piecesToPlace[0] + piecesOnBoard[0];
  const p2Total = piecesToPlace[1] + piecesOnBoard[1];
  if (p1Total < 3) return 100000 + depth;
  if (p2Total < 3) return -100000 - depth;

  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 100000 + depth;
    if (!hasValidMoves(board, 2)) return -100000 - depth;
  }

  if (depth === 0) return evaluate(board, piecesToPlace, piecesOnBoard);

  const moves = generateMoves(board, player, piecesToPlace);
  if (moves.length === 0) return isMaximizing ? -100000 - depth : 100000 + depth;

  // Move ordering: prioritize moves that form mills
  const millMoves: Move[] = [];
  const blockingMoves: Move[] = [];
  const otherMoves: Move[] = [];
  
  for (const move of moves) {
    const testBoard = applyMove(board, move, player);
    if (formsMill(testBoard, move.to, player)) {
      millMoves.push(move);
    } else {
      let isBlocking = false;
      for (const mill of MILLS) {
        if (mill.includes(move.to)) {
          const opp: Player = player === 1 ? 2 : 1;
          const oppCount = mill.filter(p => board[p] === opp).length;
          if (oppCount === 2) { isBlocking = true; break; }
        }
      }
      if (isBlocking) blockingMoves.push(move);
      else otherMoves.push(move);
    }
  }
  
  const ordered = [...millMoves, ...blockingMoves, ...otherMoves];

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of ordered) {
      const newBoard = applyMove(board, move, player);
      const nPTP: [number, number] = [...piecesToPlace];
      const nPOB: [number, number] = [...piecesOnBoard];
      if (move.type === 'place') { nPTP[1]--; nPOB[1]++; }

      let evalScore: number;
      if (formsMill(newBoard, move.to, player)) {
        const rem = getBestRemoval(newBoard, player);
        if (rem >= 0) { newBoard[rem] = 0; nPOB[0]--; }
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, nPTP, nPOB);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, nPTP, nPOB);
      }
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of ordered) {
      const newBoard = applyMove(board, move, player);
      const nPTP: [number, number] = [...piecesToPlace];
      const nPOB: [number, number] = [...piecesOnBoard];
      if (move.type === 'place') { nPTP[0]--; nPOB[0]++; }

      let evalScore: number;
      if (formsMill(newBoard, move.to, player)) {
        const rem = getBestRemoval(newBoard, player);
        if (rem >= 0) { newBoard[rem] = 0; nPOB[1]--; }
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, nPTP, nPOB);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, nPTP, nPOB);
      }
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export interface AIMove {
  type: 'place' | 'move';
  from?: number;
  to: number;
  removal?: number;
}

export function getAIMove(state: GameState, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): AIMove | null {
  const player: Player = 2;
  const maxDepth = DEPTH_MAP[difficulty];
  const moves = generateMoves(state.board, player, state.piecesToPlace);

  if (moves.length === 0) return null;

  // Easy: 50% random
  if (difficulty === 'easy' && Math.random() < 0.5) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = { type: m.type, to: m.to };
    if (m.from !== undefined) result.from = m.from;
    const tb = applyMove(state.board, m, player);
    if (formsMill(tb, m.to, player)) result.removal = getBestRemoval(tb, player);
    return result;
  }

  // Normal: 15% random
  if (difficulty === 'normal' && Math.random() < 0.15) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = { type: m.type, to: m.to };
    if (m.from !== undefined) result.from = m.from;
    const tb = applyMove(state.board, m, player);
    if (formsMill(tb, m.to, player)) result.removal = getBestRemoval(tb, player);
    return result;
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const newBoard = applyMove(state.board, move, player);
    const nPTP: [number, number] = [...state.piecesToPlace];
    const nPOB: [number, number] = [...state.piecesOnBoard];
    if (move.type === 'place') { nPTP[1]--; nPOB[1]++; }

    let score: number;
    if (formsMill(newBoard, move.to, player)) {
      const rem = getBestRemoval(newBoard, player);
      if (rem >= 0) { newBoard[rem] = 0; nPOB[0]--; }
      score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, nPTP, nPOB);
    } else {
      score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, nPTP, nPOB);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  const result: AIMove = { type: bestMove.type, to: bestMove.to };
  if (bestMove.from !== undefined) result.from = bestMove.from;
  const tb = applyMove(state.board, bestMove, player);
  if (formsMill(tb, bestMove.to, player)) result.removal = getBestRemoval(tb, player);

  return result;
}
