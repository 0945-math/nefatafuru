// ネファタフル AI - モンテカルロ木探索 (MCTS) - AlphaGo方式
import {
  Board, Player, GameState, BOARD_SIZE,
  isValidPosition, isCorner, isThrone,
  canMoveTo, getValidMoves, movePiece,
  isKingCaptured, hasKingEscaped,
} from './gameLogic';

const ITERATION_MAP = { easy: 100, normal: 500, hard: 2000 };

interface Move {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// MCTS Node
class MCTSNode {
  parent: MCTSNode | null;
  state: GameState;
  move: Move | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: Move[];

  constructor(state: GameState, parent: MCTSNode | null = null, move: Move | null = null) {
    this.parent = parent;
    this.state = state;
    this.move = move;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.untriedMoves = generateMoves(state, state.currentPlayer);
  }

  isFullyExpanded(): boolean {
    return this.untriedMoves.length === 0;
  }

  ucb1(exploration: number = 1.41): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.wins / this.visits;
    const exploration_term = exploration * Math.sqrt(Math.log(this.parent!.visits) / this.visits);
    return exploitation + exploration_term;
  }

  bestChild(): MCTSNode {
    let best = this.children[0];
    let bestUCB = best.ucb1();
    
    for (let i = 1; i < this.children.length; i++) {
      const ucb = this.children[i].ucb1();
      if (ucb > bestUCB) {
        bestUCB = ucb;
        best = this.children[i];
      }
    }
    
    return best;
  }
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

// プレイアウト（高速シミュレーション）
function playout(state: GameState, aiPlayer: Player): number {
  let currentState = { ...state };
  
  while (!currentState.winner) {
    const moves = generateMoves(currentState, currentState.currentPlayer);
    if (moves.length === 0) {
      return currentState.currentPlayer === aiPlayer ? 0 : 1;
    }
    
    // 70%の確率でランダム、30%でヒューリスティック
    let selectedMove: Move;
    if (Math.random() < 0.7) {
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } else {
      // 簡単なヒューリスティック
      const scored = moves.map(m => ({
        move: m,
        score: quickScore(currentState, m, currentState.currentPlayer)
      }));
      scored.sort((a, b) => b.score - a.score);
      selectedMove = scored[0].move;
    }
    
    currentState = movePiece(currentState, selectedMove.fromX, selectedMove.fromY, selectedMove.toX, selectedMove.toY);
    
    if (currentState.moveCount > 200) {
      return 0.5;
    }
  }
  
  return currentState.winner === aiPlayer ? 1 : 0;
}

// 高速スコアリング（プレイアウト用）
function quickScore(state: GameState, move: Move, player: Player): number {
  let score = 0;
  
  // 王の位置を探す
  let kingX = -1, kingY = -1;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.board[y][x] === 'king') {
        kingX = x;
        kingY = y;
        break;
      }
    }
    if (kingX !== -1) break;
  }
  
  if (kingX !== -1) {
    if (player === 'attacker') {
      // 王に近づく
      const oldDist = Math.abs(move.fromX - kingX) + Math.abs(move.fromY - kingY);
      const newDist = Math.abs(move.toX - kingX) + Math.abs(move.toY - kingY);
      score += (oldDist - newDist) * 5;
    } else {
      // 王を四隅に近づける
      const piece = state.board[move.fromY][move.fromX];
      if (piece === 'king') {
        const minCornerDist = Math.min(
          Math.abs(move.toX) + Math.abs(move.toY),
          Math.abs(move.toX - 10) + Math.abs(move.toY),
          Math.abs(move.toX) + Math.abs(move.toY - 10),
          Math.abs(move.toX - 10) + Math.abs(move.toY - 10)
        );
        score += (20 - minCornerDist) * 8;
      }
    }
  }
  
  // 捕獲チャンス
  const newState = movePiece(state, move.fromX, move.fromY, move.toX, move.toY);
  const captured = checkCaptureAfterMove(newState, move.toX, move.toY, player);
  score += captured * 50;
  
  return score;
}

// 手の優先度付け（ヒューリスティック）
function scoreMove(state: GameState, move: Move, aiPlayer: Player): number {
  let score = 0;
  
  const newState = movePiece(state, move.fromX, move.fromY, move.toX, move.toY);
  
  // 勝利なら最高優先度
  if (newState.winner === aiPlayer) return 10000;
  
  // 王の位置を評価
  let kingX = -1, kingY = -1;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.board[y][x] === 'king') {
        kingX = x;
        kingY = y;
        break;
      }
    }
    if (kingX !== -1) break;
  }
  
  if (kingX !== -1) {
    // 攻撃側：王に近づく
    if (aiPlayer === 'attacker') {
      const oldDist = Math.abs(move.fromX - kingX) + Math.abs(move.fromY - kingY);
      const newDist = Math.abs(move.toX - kingX) + Math.abs(move.toY - kingY);
      score += (oldDist - newDist) * 10;
      
      // 王を囲む
      const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      ];
      
      for (const dir of directions) {
        const adjX = kingX + dir.dx;
        const adjY = kingY + dir.dy;
        if (adjX === move.toX && adjY === move.toY) {
          score += 50;
        }
      }
    }
    
    // 防御側：王を四隅に近づける
    if (aiPlayer === 'defender') {
      const piece = state.board[move.fromY][move.fromX];
      if (piece === 'king') {
        const minCornerDist = Math.min(
          Math.abs(move.toX) + Math.abs(move.toY),
          Math.abs(move.toX - 10) + Math.abs(move.toY),
          Math.abs(move.toX) + Math.abs(move.toY - 10),
          Math.abs(move.toX - 10) + Math.abs(move.toY - 10)
        );
        score += (20 - minCornerDist) * 15;
      } else {
        // 王の周囲の駒を動かすのは低優先度
        const distToKing = Math.abs(move.fromX - kingX) + Math.abs(move.fromY - kingY);
        if (distToKing <= 2) score -= 20;
      }
    }
  }
  
  // 捕獲チャンス
  const captured = checkCaptureAfterMove(newState, move.toX, move.toY, aiPlayer);
  score += captured * 100;
  
  // 中央や四隅への移動
  if (isThrone(move.toX, move.toY)) score += 30;
  if (isCorner(move.toX, move.toY) && state.board[move.fromY][move.fromX] === 'king') score += 200;
  
  return score;
}

function checkCaptureAfterMove(state: GameState, x: number, y: number, player: Player): number {
  let captured = 0;
  const opponent = player === 'attacker' ? 'defender' : 'attacker';
  
  const directions = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];
  
  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    
    if (!isValidPosition(nx, ny)) continue;
    
    const target = state.board[ny][nx];
    if (target === opponent || (opponent === 'defender' && target === 'defender')) {
      const oppositeX = nx + dir.dx;
      const oppositeY = ny + dir.dy;
      
      if (isValidPosition(oppositeX, oppositeY)) {
        const opposite = state.board[oppositeY][oppositeX];
        if (opposite === player || isThrone(oppositeX, oppositeY) || isCorner(oppositeX, oppositeY)) {
          captured++;
        }
      }
    }
  }
  
  return captured;
}

export interface AIMove {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function getAIMove(state: GameState, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): AIMove | null {
  const maxIterations = ITERATION_MAP[difficulty];
  const aiPlayer = state.currentPlayer;
  
  const moves = generateMoves(state, aiPlayer);
  if (moves.length === 0) return null;
  
  // 簡単モード：30%ランダム
  if (difficulty === 'easy' && Math.random() < 0.3) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  // 普通モード：10%ランダム
  if (difficulty === 'normal' && Math.random() < 0.1) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  // MCTS実行
  const root = new MCTSNode(state);
  
  // 手を優先度でソート
  const scoredMoves = moves.map(m => ({ move: m, score: scoreMove(state, m, aiPlayer) }));
  scoredMoves.sort((a, b) => b.score - a.score);
  root.untriedMoves = scoredMoves.map(s => s.move);
  
  for (let i = 0; i < maxIterations; i++) {
    let node = root;
    
    // 1. Selection - UCB1で最良の子を選択
    while (node.isFullyExpanded() && node.children.length > 0) {
      node = node.bestChild();
    }
    
    // 2. Expansion - 未展開の手を展開
    if (!node.state.winner && node.untriedMoves.length > 0) {
      const move = node.untriedMoves.shift()!;
      const newState = movePiece(node.state, move.fromX, move.fromY, move.toX, move.toY);
      const child = new MCTSNode(newState, node, move);
      node.children.push(child);
      node = child;
    }
    
    // 3. Simulation - プレイアウト
    const result = playout(node.state, aiPlayer);
    
    // 4. Backpropagation - 結果を伝播
    while (node !== null) {
      node.visits++;
      node.wins += result;
      node = node.parent!;
    }
  }
  
  // 最も訪問された手を選択
  if (root.children.length === 0) {
    const m = moves[0];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  let bestChild = root.children[0];
  let bestVisits = bestChild.visits;
  
  for (let i = 1; i < root.children.length; i++) {
    if (root.children[i].visits > bestVisits) {
      bestVisits = root.children[i].visits;
      bestChild = root.children[i];
    }
  }
  
  return {
    fromX: bestChild.move!.fromX,
    fromY: bestChild.move!.fromY,
    toX: bestChild.move!.toX,
    toY: bestChild.move!.toY,
  };
}
