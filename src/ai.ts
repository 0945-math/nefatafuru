// AI for Morabaraba using Minimax with Alpha-Beta Pruning
import {
  Board, Player, GameState, MILLS,
  isInMill, canRemovePiece,
  getValidMoves, isFlying, hasValidMoves,
  getValidPlacements, getRemovablePieces,
} from './gameLogic';

const DEPTH_MAP = { easy: 1, normal: 3, hard: 4 };

// Position weights for strategic value
const POSITION_WEIGHT: number[] = [
  4, 2, 4,   // corners of outer
  3, 6, 3,   // middle of outer edges + center top
  2, 5, 2,   // inner corners + center
  4, 3, 2,   // left edge
  2, 3, 4,   // right edge
  2, 5, 2,   // inner bottom corners + center
  3, 6, 3,   // middle of inner edges
  4, 2, 4,   // corners of outer bottom
];

function evaluateBoard(board: Board, piecesToPlace: [number, number], piecesOnBoard: [number, number]): number {
  let score = 0;
  
  const p1Pieces = piecesToPlace[0] + piecesOnBoard[0];
  const p2Pieces = piecesToPlace[1] + piecesOnBoard[1];
  
  // Material (very important)
  score += (p2Pieces - p1Pieces) * 150;
  
  // Mills
  let p1Mills = 0, p2Mills = 0;
  let p1TwoInRow = 0, p2TwoInRow = 0;
  
  for (const mill of MILLS) {
    const p1c = mill.filter(p => board[p] === 1).length;
    const p2c = mill.filter(p => board[p] === 2).length;
    const empty = mill.filter(p => board[p] === 0).length;
    
    if (p1c === 3) p1Mills++;
    if (p2c === 3) p2Mills++;
    if (p1c === 2 && empty === 1) p1TwoInRow++;
    if (p2c === 2 && empty === 1) p2TwoInRow++;
  }
  
  score += (p2Mills - p1Mills) * 80;
  score += (p2TwoInRow - p1TwoInRow) * 25;
  
  // Positional value
  for (let i = 0; i < 24; i++) {
    if (board[i] === 2) score += POSITION_WEIGHT[i] * 3;
    if (board[i] === 1) score -= POSITION_WEIGHT[i] * 3;
  }
  
  // Mobility (only in moving phase)
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    const p1Flying = isFlying(board, 1);
    const p2Flying = isFlying(board, 2);
    const p1Moves = getValidMoves(board, 1, p1Flying).length;
    const p2Moves = getValidMoves(board, 2, p2Flying).length;
    
    if (p1Moves === 0 && !p1Flying) return 100000;
    if (p2Moves === 0 && !p2Flying) return -100000;
    
    score += (p2Moves - p1Moves) * 8;
    
    // Flying bonus
    if (p2Flying && !p1Flying) score += 40;
    if (p1Flying && !p2Flying) score -= 40;
  }
  
  // Double mill potential
  for (const mill of MILLS) {
    if (mill.every(p => board[p] === 2)) {
      // Check if any adjacent position can extend to another mill
      for (const pos of mill) {
        const adjMills = MILLS.filter(m => m.includes(pos) && m !== mill && m.every(p => board[p] === 2 || board[p] === 0));
        score += adjMills.length * 5;
      }
    }
  }
  
  // Terminal states
  if (p1Pieces < 3) return 100000;
  if (p2Pieces < 3) return -100000;
  
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
    for (const [from, to] of getValidMoves(board, player, flying)) {
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

function getBestRemoval(board: Board, player: Player): number {
  const opponent: Player = player === 1 ? 2 : 1;
  const removable = getRemovablePieces(board, opponent);
  
  if (removable.length === 0) return -1;
  if (removable.length === 1) return removable[0];
  
  let bestPiece = removable[0];
  let bestScore = -Infinity;
  
  for (const pos of removable) {
    let score = POSITION_WEIGHT[pos] * 2;
    
    // Prefer removing pieces in potential mills
    for (const mill of MILLS) {
      if (!mill.includes(pos)) continue;
      const oppCount = mill.filter(p => board[p] === opponent).length;
      if (oppCount === 2) score += 30; // Break potential mill
    }
    
    // Prefer removing pieces that give opponent fewer moves
    const testBoard = [...board] as Board;
    testBoard[pos] = 0;
    const oppMoves = getValidMoves(testBoard, opponent, isFlying(testBoard, opponent)).length;
    score += (24 - oppMoves) * 2;
    
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
  
  const p1Total = piecesToPlace[0] + piecesOnBoard[0];
  const p2Total = piecesToPlace[1] + piecesOnBoard[1];
  
  if (p1Total < 3) return 100000 + depth;
  if (p2Total < 3) return -100000 - depth;
  
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 100000 + depth;
    if (!hasValidMoves(board, 2)) return -100000 - depth;
  }
  
  if (depth === 0) {
    return evaluateBoard(board, piecesToPlace, piecesOnBoard);
  }
  
  const moves = generateMoves(board, player, piecesToPlace);
  
  if (moves.length === 0) {
    return isMaximizing ? -100000 - depth : 100000 + depth;
  }
  
  // Move ordering: prefer moves that form mills
  const millMoves: Move[] = [];
  const normalMoves: Move[] = [];
  
  for (const move of moves) {
    const testBoard = applyMove(board, move, player);
    if (formsMill(testBoard, move.to, player)) {
      millMoves.push(move);
    } else {
      normalMoves.push(move);
    }
  }
  
  const orderedMoves = [...millMoves, ...normalMoves];
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      const newBoard = applyMove(board, move, player);
      const nPTP: [number, number] = [...piecesToPlace];
      const nPOB: [number, number] = [...piecesOnBoard];
      
      if (move.type === 'place') {
        nPTP[1]--;
        nPOB[1]++;
      }
      
      let evalScore: number;
      
      if (formsMill(newBoard, move.to, player)) {
        const removal = getBestRemoval(newBoard, player);
        if (removal >= 0) {
          newBoard[removal] = 0;
          nPOB[0]--;
        }
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
    for (const move of orderedMoves) {
      const newBoard = applyMove(board, move, player);
      const nPTP: [number, number] = [...piecesToPlace];
      const nPOB: [number, number] = [...piecesOnBoard];
      
      if (move.type === 'place') {
        nPTP[0]--;
        nPOB[0]++;
      }
      
      let evalScore: number;
      
      if (formsMill(newBoard, move.to, player)) {
        const removal = getBestRemoval(newBoard, player);
        if (removal >= 0) {
          newBoard[removal] = 0;
          nPOB[1]--;
        }
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
  evaluation?: number;
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
      const removable = getRemovablePieces(testBoard, 1);
      if (removable.length > 0) {
        result.removal = removable[Math.floor(Math.random() * removable.length)];
      }
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
  let bestRemoval: number | undefined;
  
  for (const move of moves) {
    const newBoard = applyMove(state.board, move, player);
    const nPTP: [number, number] = [...state.piecesToPlace];
    const nPOB: [number, number] = [...state.piecesOnBoard];
    
    if (move.type === 'place') {
      nPTP[1]--;
      nPOB[1]++;
    }
    
    let score: number;
    let removal: number | undefined;
    
    if (formsMill(newBoard, move.to, player)) {
      removal = getBestRemoval(newBoard, player);
      if (removal !== undefined && removal >= 0) {
        newBoard[removal] = 0;
        nPOB[0]--;
      }
    }
    
    score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, nPTP, nPOB);
    
    // Add slight randomness to avoid repetitive play
    score += (Math.random() - 0.5) * 5;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestRemoval = removal;
    }
  }
  
  const result: AIMove = {
    type: bestMove.type,
    to: bestMove.to,
    evaluation: bestScore,
  };
  
  if (bestMove.from !== undefined) result.from = bestMove.from;
  if (bestRemoval !== undefined) result.removal = bestRemoval;
  
  return result;
}
