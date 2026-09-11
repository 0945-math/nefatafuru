// AI for Morabaraba using Minimax with Alpha-Beta Pruning
import {
  Board, Player, GameState, ADJACENCY, MILLS,
  getMillsForPosition, isInMill, canRemovePiece,
  getValidMoves, isFlying, hasValidMoves,
  getValidPlacements, getValidTargets, getRemovablePieces,
} from './gameLogic';

const DEPTH_MAP = { easy: 1, normal: 3, hard: 5 };

// Evaluate board state for the AI (player 2)
function evaluateBoard(board: Board, piecesToPlace: [number, number], piecesOnBoard: [number, number]): number {
  let score = 0;
  
  // Material advantage
  const p1Pieces = piecesToPlace[0] + piecesOnBoard[0];
  const p2Pieces = piecesToPlace[1] + piecesOnBoard[1];
  score += (p2Pieces - p1Pieces) * 100;
  
  // Count mills for each player
  let p1Mills = 0;
  let p2Mills = 0;
  
  for (const mill of MILLS) {
    const p1Count = mill.filter(p => board[p] === 1).length;
    const p2Count = mill.filter(p => board[p] === 2).length;
    
    if (p1Count === 3) p1Mills++;
    if (p2Count === 3) p2Mills++;
    
    if (p1Count === 2 && mill.some(p => board[p] === 0)) score -= 10;
    if (p2Count === 2 && mill.some(p => board[p] === 0)) score += 10;
  }
  
  score += (p2Mills - p1Mills) * 50;
  
  // Mobility
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    const p1Moves = getValidMoves(board, 1, isFlying(board, 1)).length;
    const p2Moves = getValidMoves(board, 2, isFlying(board, 2)).length;
    score += (p2Moves - p1Moves) * 5;
  }
  
  // Positional value - prefer center positions
  const centerPositions = [4, 7, 10, 12, 13, 16, 19];
  for (const pos of centerPositions) {
    if (board[pos] === 2) score += 8;
    if (board[pos] === 1) score -= 8;
  }
  
  // Check for winning/losing
  if (p1Pieces < 3) return 10000;
  if (p2Pieces < 3) return -10000;
  
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 10000;
    if (!hasValidMoves(board, 2)) return -10000;
  }
  
  return score;
}

// Generate all possible moves for a given state
interface Move {
  type: 'place' | 'move';
  from?: number;
  to: number;
}

function generateMoves(board: Board, player: Player, piecesToPlace: [number, number]): Move[] {
  const idx = player - 1;
  const moves: Move[] = [];
  
  if (piecesToPlace[idx] > 0) {
    // Placing phase
    const placements = getValidPlacements(board);
    for (const pos of placements) {
      moves.push({ type: 'place', to: pos });
    }
  } else {
    // Moving phase
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

function getBestRemoval(board: Board, player: Player): number {
  const opponent: Player = player === 1 ? 2 : 1;
  const removable = getRemovablePieces(board, opponent);
  
  if (removable.length === 0) return -1;
  
  // Simple heuristic: remove piece that's part of most potential mills
  let bestPiece = removable[0];
  let bestScore = -Infinity;
  
  for (const pos of removable) {
    let score = 0;
    // Prefer removing pieces that are in 2-in-a-row situations
    for (const mill of MILLS) {
      if (!mill.includes(pos)) continue;
      const opponentInMill = mill.filter(p => board[p] === opponent).length;
      score += opponentInMill * 10;
    }
    // Prefer center positions
    if ([4, 7, 10, 12, 13, 16, 19].includes(pos)) score += 5;
    
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
  
  // Terminal conditions
  const p1Total = piecesToPlace[0] + piecesOnBoard[0];
  const p2Total = piecesToPlace[1] + piecesOnBoard[1];
  
  if (p1Total < 3) return 10000 + depth;
  if (p2Total < 3) return -10000 - depth;
  
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return 10000 + depth;
    if (!hasValidMoves(board, 2)) return -10000 - depth;
  }
  
  if (depth === 0) {
    return evaluateBoard(board, piecesToPlace, piecesOnBoard);
  }
  
  const moves = generateMoves(board, player, piecesToPlace);
  
  if (moves.length === 0) {
    return isMaximizing ? -10000 - depth : 10000 + depth;
  }
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move, player);
      const newPiecesToPlace: [number, number] = [...piecesToPlace];
      const newPiecesOnBoard: [number, number] = [...piecesOnBoard];
      
      if (move.type === 'place') {
        newPiecesToPlace[1]--;
        newPiecesOnBoard[1]++;
      }
      
      let evalScore: number;
      
      // Check if this move forms a mill
      if (formsMill(newBoard, move.to, player)) {
        // AI gets to remove a piece
        const removal = getBestRemoval(newBoard, player);
        if (removal >= 0) {
          newBoard[removal] = 0;
          newPiecesOnBoard[0]--;
        }
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, newPiecesToPlace, newPiecesOnBoard);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, newPiecesToPlace, newPiecesOnBoard);
      }
      
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move, player);
      const newPiecesToPlace: [number, number] = [...piecesToPlace];
      const newPiecesOnBoard: [number, number] = [...piecesOnBoard];
      
      if (move.type === 'place') {
        newPiecesToPlace[0]--;
        newPiecesOnBoard[0]++;
      }
      
      let evalScore: number;
      
      // Check if this move forms a mill
      if (formsMill(newBoard, move.to, player)) {
        // Opponent gets to remove a piece
        const removal = getBestRemoval(newBoard, player);
        if (removal >= 0) {
          newBoard[removal] = 0;
          newPiecesOnBoard[1]--;
        }
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, newPiecesToPlace, newPiecesOnBoard);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, newPiecesToPlace, newPiecesOnBoard);
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
  
  // Add randomness for easy mode
  if (difficulty === 'easy' && Math.random() < 0.3) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = {
      type: randomMove.type,
      to: randomMove.to,
    };
    if (randomMove.from !== undefined) result.from = randomMove.from;
    const testBoard = applyMove(state.board, randomMove, player);
    if (formsMill(testBoard, randomMove.to, player)) {
      result.removal = getBestRemoval(testBoard, player);
    }
    return result;
  }
  
  let bestMove: Move = moves[0];
  let bestScore = -Infinity;
  
  for (const move of moves) {
    const newBoard = applyMove(state.board, move, player);
    const newPiecesToPlace: [number, number] = [...state.piecesToPlace];
    const newPiecesOnBoard: [number, number] = [...state.piecesOnBoard];
    
    if (move.type === 'place') {
      newPiecesToPlace[1]--;
      newPiecesOnBoard[1]++;
    }
    
    let score: number;
    let removal: number | undefined;
    
    if (formsMill(newBoard, move.to, player)) {
      removal = getBestRemoval(newBoard, player);
      if (removal !== undefined && removal >= 0) {
        newBoard[removal] = 0;
        newPiecesOnBoard[0]--;
      }
    }
    
    score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, newPiecesToPlace, newPiecesOnBoard);
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  const result: AIMove = {
    type: bestMove.type,
    to: bestMove.to,
  };
  
  if (bestMove.from !== undefined) {
    result.from = bestMove.from;
  }
  
  // Determine if we need a removal
  const testBoard = applyMove(state.board, bestMove, player);
  if (formsMill(testBoard, bestMove.to, player)) {
    result.removal = getBestRemoval(testBoard, player);
  }
  
  return result;
}
