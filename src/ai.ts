// AI for Morabaraba - Minimax with Alpha-Beta Pruning
import {
  Board, Player, GameState, ADJACENCY, MILLS,
  getMillsForPosition, isInMill, canRemovePiece,
  getValidMoves, isFlying, hasValidMoves,
  getValidPlacements, getRemovablePieces,
  countPieces, countMills,
} from './gameLogic';

const DEPTH_MAP = { easy: 2, normal: 3, hard: 5 };

// Positional weights - center and intersection points are more valuable
const POS_WEIGHT: number[] = [
  2, 3, 2,   // corners of outer
  3, 4, 3,   // mid of outer edges
  4, 5, 4,   // inner corners
  2, 3, 4,   // outer left, mid, inner
  4, 3, 2,   // inner, mid, outer right
  4, 5, 4,   // inner bottom corners
  3, 4, 3,   // mid of bottom edges
  2, 3, 2,   // corners of bottom
];

// Evaluate board state for AI (player 2)
function evaluate(state: {
  board: Board;
  piecesToPlace: [number, number];
  piecesOnBoard: [number, number];
}): number {
  const { board, piecesToPlace, piecesOnBoard } = state;

  // Terminal states
  const p1Total = piecesToPlace[0] + piecesOnBoard[0];
  const p2Total = piecesToPlace[1] + piecesOnBoard[1];
  if (p1Total < 3) return 100000;
  if (p2Total < 3) return -100000;

  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 100000;
    if (!hasValidMoves(board, 2)) return -100000;
  }

  let score = 0;

  // 1. Material (piece count) - very important
  const p1Pieces = piecesOnBoard[0];
  const p2Pieces = piecesOnBoard[1];
  score += (p2Pieces - p1Pieces) * 800;

  // Pieces to place advantage
  score += (piecesToPlace[1] - piecesToPlace[0]) * 200;

  // 2. Mills formed
  const p1Mills = countMills(board, 1);
  const p2Mills = countMills(board, 2);
  score += (p2Mills - p1Mills) * 400;

  // 3. Two-in-a-row potential (close to forming a mill)
  for (const mill of MILLS) {
    const p1Count = mill.filter(p => board[p] === 1).length;
    const p2Count = mill.filter(p => board[p] === 2).length;
    const emptyCount = mill.filter(p => board[p] === 0).length;

    if (p2Count === 2 && emptyCount === 1) score += 150;
    if (p1Count === 2 && emptyCount === 1) score -= 150;
    if (p2Count === 1 && emptyCount === 2) score += 30;
    if (p1Count === 1 && emptyCount === 2) score -= 30;
  }

  // 4. Positional value
  for (let i = 0; i < 24; i++) {
    if (board[i] === 2) score += POS_WEIGHT[i] * 25;
    if (board[i] === 1) score -= POS_WEIGHT[i] * 25;
  }

  // 5. Mobility (in moving phase)
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    const p1Flying = isFlying(board, 1);
    const p2Flying = isFlying(board, 2);
    const p1Moves = getValidMoves(board, 1, p1Flying).length;
    const p2Moves = getValidMoves(board, 2, p2Flying).length;
    score += (p2Moves - p1Moves) * 15;

    // Flying is powerful
    if (p2Flying && !p1Flying) score += 300;
    if (p1Flying && !p2Flying) score -= 300;
  }

  // 6. Blocking opponent mills
  for (const mill of MILLS) {
    const p1Count = mill.filter(p => board[p] === 1).length;
    const p2Count = mill.filter(p => board[p] === 2).length;

    // If we block an opponent's potential mill
    if (p1Count === 2 && p2Count === 1) score += 80;
    if (p2Count === 2 && p1Count === 1) score -= 80;
  }

  // 7. Double mill potential (two mills sharing a piece)
  for (let i = 0; i < 24; i++) {
    if (board[i] === 0) continue;
    const player = board[i] as Player;
    const millsThrough = getMillsForPosition(board, i, player);
    if (millsThrough.length >= 2) {
      score += player === 2 ? 200 : -200;
    }
  }

  return score;
}

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
    const validMoves = getValidMoves(board, player, flying);
    for (const [from, to] of validMoves) {
      moves.push({ type: 'move', from, to });
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

    // How many mills does this piece participate in?
    const millsThrough = getMillsForPosition(board, pos, opponent);
    score -= millsThrough.length * 300; // removing from a mill is less valuable

    // How many potential 2-in-a-rows does this piece contribute to?
    for (const mill of MILLS) {
      if (!mill.includes(pos)) continue;
      const oppInMill = mill.filter(p => board[p] === opponent).length;
      if (oppInMill === 2) score -= 100; // part of a near-mill
    }

    // Positional value
    score -= POS_WEIGHT[pos] * 10;

    // How many adjacent pieces does it have? (more = more connected = more valuable to remove)
    const adjOwn = ADJACENCY[pos].filter(a => board[a] === opponent).length;
    score -= adjOwn * 30;

    // Prefer removing pieces that enable opponent flying prevention
    const oppCount = countPieces(board, opponent);
    if (oppCount === 4) {
      // Removing this could prevent flying next turn
      score += 50;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPiece = pos;
    }
  }

  return bestPiece;
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

  // Terminal states
  const p1Total = piecesToPlace[0] + piecesOnBoard[0];
  const p2Total = piecesToPlace[1] + piecesOnBoard[1];
  if (p1Total < 3) return 100000 + depth;
  if (p2Total < 3) return -100000 - depth;

  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 100000 + depth;
    if (!hasValidMoves(board, 2)) return -100000 - depth;
  }

  if (depth === 0) {
    return evaluate({ board, piecesToPlace, piecesOnBoard });
  }

  const moves = generateMoves(board, player, piecesToPlace);
  if (moves.length === 0) {
    return isMaximizing ? -100000 - depth : 100000 + depth;
  }

  // Move ordering: prioritize moves that form mills
  const millMoves: Move[] = [];
  const blockingMoves: Move[] = [];
  const otherMoves: Move[] = [];

  for (const move of moves) {
    const testBoard = applyMove(board, move, player);
    if (formsMill(testBoard, move.to, player)) {
      millMoves.push(move);
    } else {
      // Check if blocking opponent's near-mill
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

  const orderedMoves = [...millMoves, ...blockingMoves, ...otherMoves];

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      const newBoard = applyMove(board, move, player);
      const newPTP: [number, number] = [...piecesToPlace];
      const newPOB: [number, number] = [...piecesOnBoard];
      newPTP[1]--;
      newPOB[1]++;

      let evalScore: number;
      const newBoardAfterRemoval = [...newBoard] as Board;

      if (formsMill(newBoard, move.to, player)) {
        const removal = getBestRemoval(newBoard, player);
        if (removal >= 0) {
          newBoardAfterRemoval[removal] = 0;
          newPOB[0]--;
        }
        evalScore = minimax(newBoardAfterRemoval, depth - 1, alpha, beta, false, newPTP, newPOB);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, newPTP, newPOB);
      }

      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      const newBoard = applyMove(board, move, player);
      const newPTP: [number, number] = [...piecesToPlace];
      const newPOB: [number, number] = [...piecesOnBoard];
      newPTP[0]--;
      newPOB[0]++;

      let evalScore: number;
      const newBoardAfterRemoval = [...newBoard] as Board;

      if (formsMill(newBoard, move.to, player)) {
        const removal = getBestRemoval(newBoard, player);
        if (removal >= 0) {
          newBoardAfterRemoval[removal] = 0;
          newPOB[1]--;
        }
        evalScore = minimax(newBoardAfterRemoval, depth - 1, alpha, beta, true, newPTP, newPOB);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, newPTP, newPOB);
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

  // Easy mode: 40% random moves
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = { type: randomMove.type, to: randomMove.to };
    if (randomMove.from !== undefined) result.from = randomMove.from;
    const testBoard = applyMove(state.board, randomMove, player);
    if (formsMill(testBoard, randomMove.to, player)) {
      result.removal = getBestRemoval(testBoard, player);
    }
    return result;
  }

  // Normal mode: 15% random moves
  if (difficulty === 'normal' && Math.random() < 0.15) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = { type: randomMove.type, to: randomMove.to };
    if (randomMove.from !== undefined) result.from = randomMove.from;
    const testBoard = applyMove(state.board, randomMove, player);
    if (formsMill(testBoard, randomMove.to, player)) {
      result.removal = getBestRemoval(testBoard, player);
    }
    return result;
  }

  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  const allScores: { move: Move; score: number }[] = [];

  for (const move of moves) {
    const newBoard = applyMove(state.board, move, player);
    const newPTP: [number, number] = [...state.piecesToPlace];
    const newPOB: [number, number] = [...state.piecesOnBoard];
    newPTP[1]--;
    newPOB[1]++;

    let score: number;
    const newBoardAfterRemoval = [...newBoard] as Board;

    if (formsMill(newBoard, move.to, player)) {
      const removal = getBestRemoval(newBoard, player);
      if (removal >= 0) {
        newBoardAfterRemoval[removal] = 0;
        newPOB[0]--;
      }
      score = minimax(newBoardAfterRemoval, maxDepth - 1, -Infinity, Infinity, false, newPTP, newPOB);
    } else {
      score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, newPTP, newPOB);
    }

    allScores.push({ move, score });

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  const result: AIMove = { type: bestMove.type, to: bestMove.to };
  if (bestMove.from !== undefined) result.from = bestMove.from;

  const testBoard = applyMove(state.board, bestMove, player);
  if (formsMill(testBoard, bestMove.to, player)) {
    result.removal = getBestRemoval(testBoard, player);
  }

  return result;
}
