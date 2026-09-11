// Advanced AI for Morabaraba with improved strategy
import {
  Board, Player, GameState, MILLS, ADJACENCY,
  isInMill, canRemovePiece,
  isFlying, hasValidMoves,
  getValidPlacements, getValidTargets, getRemovablePieces,
} from './gameLogic';

// Helper function to get all valid moves
function getValidMoves(board: Board, player: Player, flying: boolean): [number, number][] {
  const moves: [number, number][] = [];
  for (let from = 0; from < 24; from++) {
    if (board[from] !== player) continue;
    const targets = flying 
      ? Array.from({length: 24}, (_, i) => i).filter(i => board[i] === 0 && i !== from)
      : ADJACENCY[from].filter(i => board[i] === 0);
    for (const to of targets) {
      moves.push([from, to]);
    }
  }
  return moves;
}

const DEPTH_MAP = { easy: 2, normal: 4, hard: 6 };

// Strategic position values
const POSITION_VALUE: number[] = [
  10, 5, 10,   // Outer corners (high value)
  7, 15, 7,    // Edge middles
  5, 12, 5,    // Inner corners
  10, 7, 5,    // Left side
  5, 7, 10,    // Right side
  5, 12, 5,    // Inner bottom
  7, 15, 7,    // Bottom edges
  10, 5, 10,   // Bottom corners
];

// Advanced evaluation function
function evaluateBoard(board: Board, piecesToPlace: [number, number], piecesOnBoard: [number, number], player: Player): number {
  const opponent: Player = player === 1 ? 2 : 1;
  let score = 0;
  
  // 1. Material advantage (most important)
  const myPieces = piecesToPlace[player - 1] + piecesOnBoard[player - 1];
  const oppPieces = piecesToPlace[opponent - 1] + piecesOnBoard[opponent - 1];
  score += (myPieces - oppPieces) * 200;
  
  // 2. Mill analysis
  let myMills = 0, oppMills = 0;
  let myTwoInRow = 0, oppTwoInRow = 0;
  let myOneInRow = 0, oppOneInRow = 0;
  
  for (const mill of MILLS) {
    const myCount = mill.filter(p => board[p] === player).length;
    const oppCount = mill.filter(p => board[p] === opponent).length;
    
    if (myCount === 3) myMills++;
    if (oppCount === 3) oppMills++;
    if (myCount === 2 && mill.some(p => board[p] === 0)) myTwoInRow++;
    if (oppCount === 2 && mill.some(p => board[p] === 0)) oppTwoInRow++;
    if (myCount === 1 && mill.filter(p => board[p] === 0).length === 2) myOneInRow++;
    if (oppCount === 1 && mill.filter(p => board[p] === 0).length === 2) oppOneInRow++;
  }
  
  score += (myMills - oppMills) * 100;
  score += (myTwoInRow - oppTwoInRow) * 40;
  score += (myOneInRow - oppOneInRow) * 10;
  
  // 3. Positional advantage
  for (let i = 0; i < 24; i++) {
    if (board[i] === player) score += POSITION_VALUE[i];
    if (board[i] === opponent) score -= POSITION_VALUE[i];
  }
  
  // 4. Mobility analysis
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    const myFlying = isFlying(board, player);
    const oppFlying = isFlying(board, opponent);
    const myMoves = getValidMoves(board, player, myFlying).length;
    const oppMoves = getValidMoves(board, opponent, oppFlying).length;
    
    // Mobility is crucial
    if (oppMoves === 0 && !oppFlying) return 1000000;
    if (myMoves === 0 && !myFlying) return -1000000;
    
    score += (myMoves - oppMoves) * 15;
    
    // Flying advantage
    if (myFlying && !oppFlying) score += 80;
    if (oppFlying && !myFlying) score -= 80;
    
    // Restricting opponent is valuable
    if (oppMoves <= 2) score += 30;
    if (myMoves <= 2) score -= 30;
  }
  
  // 5. Double mill potential (advanced strategy)
  for (let i = 0; i < 24; i++) {
    if (board[i] === player) {
      const adjacentMills = MILLS.filter(m => 
        m.includes(i) && 
        m.filter(p => board[p] === player).length === 2 &&
        m.some(p => board[p] === 0)
      );
      score += adjacentMills.length * 8;
    }
  }
  
  // 6. Blocking opponent's mills
  for (const mill of MILLS) {
    const oppCount = mill.filter(p => board[p] === opponent).length;
    if (oppCount === 2) {
      // Check if we're blocking
      const emptyPos = mill.find(p => board[p] === 0);
      if (emptyPos !== undefined) {
        // Check if this position is valuable for us too
        score += POSITION_VALUE[emptyPos] * 0.5;
      }
    }
  }
  
  // 7. Endgame considerations
  if (myPieces <= 4 || oppPieces <= 4) {
    // In endgame, prioritize forming mills
    score += myTwoInRow * 20;
    score -= oppTwoInRow * 20;
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
    // Prioritize positions that form mills
    const placements = getValidPlacements(board);
    
    // Sort by strategic value
    placements.sort((a: number, b: number) => {
      const testBoardA = [...board] as Board;
      testBoardA[a] = player;
      const formsMillA = MILLS.some(mill => 
        mill.includes(a) && mill.every(p => testBoardA[p] === player)
      );
      
      const testBoardB = [...board] as Board;
      testBoardB[b] = player;
      const formsMillB = MILLS.some(mill => 
        mill.includes(b) && mill.every(p => testBoardB[p] === player)
      );
      
      if (formsMillA && !formsMillB) return -1;
      if (!formsMillA && formsMillB) return 1;
      return POSITION_VALUE[b] - POSITION_VALUE[a];
    });
    
    for (const pos of placements) {
      moves.push({ type: 'place', to: pos });
    }
  } else {
    const flying = isFlying(board, player);
    const validMoves = getValidMoves(board, player, flying);
    
    // Sort moves by strategic value
    validMoves.sort((a: [number, number], b: [number, number]) => {
      const testBoardA = [...board] as Board;
      testBoardA[a[0]] = 0;
      testBoardA[a[1]] = player;
      const formsMillA = MILLS.some(mill => 
        mill.includes(a[1]) && mill.every(p => testBoardA[p] === player)
      );
      
      const testBoardB = [...board] as Board;
      testBoardB[b[0]] = 0;
      testBoardB[b[1]] = player;
      const formsMillB = MILLS.some(mill => 
        mill.includes(b[1]) && mill.every(p => testBoardB[p] === player)
      );
      
      if (formsMillA && !formsMillB) return -1;
      if (!formsMillA && formsMillB) return 1;
      return POSITION_VALUE[b[1]] - POSITION_VALUE[a[1]];
    });
    
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

// Advanced piece removal strategy
function getBestRemoval(board: Board, player: Player): number {
  const opponent: Player = player === 1 ? 2 : 1;
  const removable = getRemovablePieces(board, opponent);
  
  if (removable.length === 0) return -1;
  if (removable.length === 1) return removable[0];
  
  let bestPiece = removable[0];
  let bestScore = -Infinity;
  
  for (const pos of removable) {
    let score = 0;
    
    // 1. Position value
    score += POSITION_VALUE[pos] * 3;
    
    // 2. Break opponent's potential mills
    for (const mill of MILLS) {
      if (!mill.includes(pos)) continue;
      const oppCount = mill.filter(p => board[p] === opponent).length;
      if (oppCount === 2) score += 50; // Breaking a 2-in-row
    }
    
    // 3. Reduce opponent's mobility
    const testBoard = [...board] as Board;
    testBoard[pos] = 0;
    const oppMoves = getValidMoves(testBoard, opponent, isFlying(testBoard, opponent)).length;
    score += (24 - oppMoves) * 3;
    
    // 4. Prefer removing pieces that are part of multiple potential mills
    const millCount = MILLS.filter(m => m.includes(pos)).length;
    score += millCount * 10;
    
    // 5. Endgame: prefer removing pieces to prevent flying
    const oppPieces = board.filter(c => c === opponent).length;
    if (oppPieces <= 4) {
      score += POSITION_VALUE[pos] * 2;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestPiece = pos;
    }
  }
  
  return bestPiece;
}

// Minimax with alpha-beta pruning and move ordering
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  piecesToPlace: [number, number],
  piecesOnBoard: [number, number],
  player: Player,
): number {
  const currentPlayer: Player = isMaximizing ? player : (player === 1 ? 2 : 1);
  
  // Terminal conditions
  const myPieces = piecesToPlace[player - 1] + piecesOnBoard[player - 1];
  const oppPieces = piecesToPlace[player === 1 ? 1 : 0] + piecesOnBoard[player === 1 ? 1 : 0];
  
  if (myPieces < 3) return -1000000 - depth;
  if (oppPieces < 3) return 1000000 + depth;
  
  if (piecesToPlace[0] === 0 && piecesToPlace[1] === 0) {
    if (!hasValidMoves(board, 1)) return player === 2 ? 1000000 + depth : -1000000 - depth;
    if (!hasValidMoves(board, 2)) return player === 1 ? 1000000 + depth : -1000000 - depth;
  }
  
  if (depth === 0) {
    return evaluateBoard(board, piecesToPlace, piecesOnBoard, player);
  }
  
  const moves = generateMoves(board, currentPlayer, piecesToPlace);
  
  if (moves.length === 0) {
    return isMaximizing ? -1000000 - depth : 1000000 + depth;
  }
  
  // Move ordering: prioritize mill-forming moves
  const millMoves: Move[] = [];
  const normalMoves: Move[] = [];
  
  for (const move of moves) {
    const testBoard = applyMove(board, move, currentPlayer);
    if (formsMill(testBoard, move.to, currentPlayer)) {
      millMoves.push(move);
    } else {
      normalMoves.push(move);
    }
  }
  
  const orderedMoves = [...millMoves, ...normalMoves];
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of orderedMoves) {
      const newBoard = applyMove(board, move, currentPlayer);
      const nPTP: [number, number] = [...piecesToPlace];
      const nPOB: [number, number] = [...piecesOnBoard];
      
      if (move.type === 'place') {
        nPTP[currentPlayer - 1]--;
        nPOB[currentPlayer - 1]++;
      }
      
      let evalScore: number;
      
      if (formsMill(newBoard, move.to, currentPlayer)) {
        const removal = getBestRemoval(newBoard, currentPlayer);
        if (removal >= 0) {
          newBoard[removal] = 0;
          const oppIdx = currentPlayer === 1 ? 1 : 0;
          nPOB[oppIdx]--;
        }
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, nPTP, nPOB, player);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, false, nPTP, nPOB, player);
      }
      
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of orderedMoves) {
      const newBoard = applyMove(board, move, currentPlayer);
      const nPTP: [number, number] = [...piecesToPlace];
      const nPOB: [number, number] = [...piecesOnBoard];
      
      if (move.type === 'place') {
        nPTP[currentPlayer - 1]--;
        nPOB[currentPlayer - 1]++;
      }
      
      let evalScore: number;
      
      if (formsMill(newBoard, move.to, currentPlayer)) {
        const removal = getBestRemoval(newBoard, currentPlayer);
        if (removal >= 0) {
          newBoard[removal] = 0;
          const oppIdx = currentPlayer === 1 ? 1 : 0;
          nPOB[oppIdx]--;
        }
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, nPTP, nPOB, player);
      } else {
        evalScore = minimax(newBoard, depth - 1, alpha, beta, true, nPTP, nPOB, player);
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
  thinking?: string;
}

export function getAIMove(state: GameState, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): AIMove | null {
  const player: Player = 2;
  const maxDepth = DEPTH_MAP[difficulty];
  const moves = generateMoves(state.board, player, state.piecesToPlace);
  
  if (moves.length === 0) return null;
  
  // Easy mode: 50% random moves
  if (difficulty === 'easy' && Math.random() < 0.5) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = { type: randomMove.type, to: randomMove.to, thinking: 'ランダム' };
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
  
  // Normal mode: 20% random moves
  if (difficulty === 'normal' && Math.random() < 0.2) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const result: AIMove = { type: randomMove.type, to: randomMove.to, thinking: '戦略的選択' };
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
  let thinkingText = '';
  
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
      thinkingText = 'ミルを形成';
    } else {
      thinkingText = '位置最適化';
    }
    
    score = minimax(newBoard, maxDepth - 1, -Infinity, Infinity, false, nPTP, nPOB, player);
    
    // Add slight randomness for variety
    score += (Math.random() - 0.5) * 10;
    
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
    thinking: thinkingText,
  };
  
  if (bestMove.from !== undefined) result.from = bestMove.from;
  if (bestRemoval !== undefined) result.removal = bestRemoval;
  
  return result;
}
