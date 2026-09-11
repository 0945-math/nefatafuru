// ネファタフル AI - Minimax with Alpha-Beta Pruning
import {
  Board, Player, GameState, BOARD_SIZE,
  isValidPosition, isCorner, isThrone,
  canMoveTo, getValidMoves, checkCapture,
  isKingCaptured, hasKingEscaped, movePiece,
} from './gameLogic';

const DEPTH_MAP = { easy: 2, normal: 3, hard: 4 };

// 位置の重要度
function getPosWeight(x: number, y: number): number {
  const dist = Math.abs(x - 5) + Math.abs(y - 5);
  if (isCorner(x, y)) return 10;
  if (isThrone(x, y)) return 8;
  if (dist <= 1) return 6;
  if (dist <= 2) return 4;
  if (dist <= 3) return 3;
  return 2;
}

interface Move {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

function generateMoves(state: GameState, player: Player): Move[] {
  const moves: Move[] = [];
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const piece = state.board[y][x];
      if (piece === 0) continue;
      if (player === 'attacker' && piece !== 'attacker') continue;
      if (player === 'defender' && piece !== 'defender' && piece !== 'king') continue;
      
      const validTargets = getValidMoves(state, x, y);
      for (const target of validTargets) {
        moves.push({ fromX: x, fromY: y, toX: target.x, toY: target.y });
      }
    }
  }
  return moves;
}

function applyMove(state: GameState, move: Move): GameState {
  return movePiece(state, move.fromX, move.fromY, move.toX, move.toY);
}

function countPieces(board: Board, type: 'attacker' | 'defender' | 'king'): number {
  let count = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === type) count++;
    }
  }
  return count;
}

function findKing(board: Board): { x: number; y: number } | null {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === 'king') return { x, y };
    }
  }
  return null;
}

function evaluate(state: GameState): number {
  // 勝利/敗北
  if (state.winner === 'attacker') return 100000;
  if (state.winner === 'defender') return -100000;
  
  let score = 0;
  
  // 1. 駒の数
  const attackers = countPieces(state.board, 'attacker');
  const defenders = countPieces(state.board, 'defender');
  const hasKing = findKing(state.board) !== null;
  
  score += (attackers - 24) * -500; // 攻撃側は減ると不利
  score += (defenders - 12) * 400; // 防御側も減ると不利
  if (!hasKing) return 100000; // 王がいなければ攻撃側勝ち
  
  // 2. 王の位置（四隅に近いほど防御側に有利）
  const king = findKing(state.board);
  if (king) {
    const minCornerDist = Math.min(
      ...[
        Math.abs(king.x) + Math.abs(king.y),
        Math.abs(king.x - 10) + Math.abs(king.y),
        Math.abs(king.x) + Math.abs(king.y - 10),
        Math.abs(king.x - 10) + Math.abs(king.y - 10),
      ]
    );
    score -= minCornerDist * 80; // 四隅に近いほど防御側に有利
  }
  
  // 3. 王の周囲の自由度
  if (king) {
    const kingMoves = getValidMoves(state, king.x, king.y);
    score += kingMoves.length * 30;
    
    // 王が囲まれているか
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    
    let surrounded = 0;
    for (const dir of directions) {
      const nx = king.x + dir.dx;
      const ny = king.y + dir.dy;
      if (!isValidPosition(nx, ny)) {
        surrounded++;
        continue;
      }
      if (state.board[ny][nx] === 'attacker') surrounded++;
    }
    score -= surrounded * 100;
  }
  
  // 4. 位置の重要度
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const piece = state.board[y][x];
      if (piece === 0) continue;
      const weight = getPosWeight(x, y);
      if (piece === 'attacker') score -= weight * 10;
      if (piece === 'defender') score += weight * 15;
    }
  }
  
  // 5. 捕獲チャンス
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.board[y][x] === 'attacker') {
        const captures = checkCapture(state, x, y, 'attacker');
        score += captures.length * 50;
      }
      if (state.board[y][x] === 'defender') {
        const captures = checkCapture(state, x, y, 'defender');
        score += captures.length * 40;
      }
    }
  }
  
  // 6. 攻撃側のモビリティ
  const attackerMoves = generateMoves(state, 'attacker').length;
  const defenderMoves = generateMoves(state, 'defender').length;
  
  if (state.currentPlayer === 'attacker') {
    score += attackerMoves * 3;
    score -= defenderMoves * 2;
  } else {
    score -= attackerMoves * 2;
    score += defenderMoves * 3;
  }
  
  return score;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
): number {
  if (state.winner) {
    return state.winner === 'attacker' ? 100000 + depth : -100000 - depth;
  }
  
  if (depth === 0) return evaluate(state);
  
  const player = state.currentPlayer;
  const moves = generateMoves(state, player);
  
  if (moves.length === 0) {
    return isMaximizing ? -100000 - depth : 100000 + depth;
  }
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newState = applyMove(state, move);
      const evalScore = minimax(newState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newState = applyMove(state, move);
      const evalScore = minimax(newState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export interface AIMove {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function getAIMove(state: GameState, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): AIMove | null {
  const maxDepth = DEPTH_MAP[difficulty];
  const moves = generateMoves(state, state.currentPlayer);
  
  if (moves.length === 0) return null;
  
  // 簡単モード：50%ランダム
  if (difficulty === 'easy' && Math.random() < 0.5) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  // 普通モード：20%ランダム
  if (difficulty === 'normal' && Math.random() < 0.2) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  const isMaximizing = state.currentPlayer === 'defender';
  let bestMove = moves[0];
  let bestScore = isMaximizing ? -Infinity : Infinity;
  
  for (const move of moves) {
    const newState = applyMove(state, move);
    const score = minimax(newState, maxDepth - 1, -Infinity, Infinity, !isMaximizing);
    
    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }
  
  return { fromX: bestMove.fromX, fromY: bestMove.fromY, toX: bestMove.toX, toY: bestMove.toY };
}
