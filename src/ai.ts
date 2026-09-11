// ネファタフル AI - モンテカルロ木探索 (MCTS)
import {
  Board, Player, GameState, BOARD_SIZE,
  isValidPosition, isCorner, isThrone,
  canMoveTo, getValidMoves, movePiece,
} from './gameLogic';

const ITERATION_MAP = { easy: 200, normal: 1000, hard: 3000 };

interface Move {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

class MCTSNode {
  parent: MCTSNode | null;
  state: GameState;
  move: Move | null;
  children: MCTSNode[];
  visits: number;
  totalReward: number;
  untriedMoves: Move[];

  constructor(state: GameState, parent: MCTSNode | null = null, move: Move | null = null) {
    this.parent = parent;
    this.state = state;
    this.move = move;
    this.children = [];
    this.visits = 0;
    this.totalReward = 0;
    this.untriedMoves = generateMoves(state, state.currentPlayer);
  }

  isFullyExpanded(): boolean {
    return this.untriedMoves.length === 0;
  }

  ucb1(exploration: number = Math.sqrt(2)): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.totalReward / this.visits;
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

function playout(state: GameState, aiPlayer: Player): number {
  let currentState = { ...state };
  
  while (!currentState.winner) {
    const moves = generateMoves(currentState, currentState.currentPlayer);
    if (moves.length === 0) {
      return currentState.currentPlayer === aiPlayer ? 0 : 1;
    }
    
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    currentState = movePiece(currentState, randomMove.fromX, randomMove.fromY, randomMove.toX, randomMove.toY);
    
    if (currentState.moveCount > 200) {
      return 0.5;
    }
  }
  
  return currentState.winner === aiPlayer ? 1 : 0;
}

function evaluate(state: GameState, aiPlayer: Player): number {
  if (state.winner === aiPlayer) return 1;
  if (state.winner && state.winner !== aiPlayer) return 0;
  
  let score = 0.5;
  
  let attackerCount = 0;
  let defenderCount = 0;
  let kingX = -1, kingY = -1;
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const piece = state.board[y][x];
      if (piece === 'attacker') attackerCount++;
      if (piece === 'defender') defenderCount++;
      if (piece === 'king') {
        kingX = x;
        kingY = y;
      }
    }
  }
  
  const pieceAdvantage = aiPlayer === 'attacker' 
    ? (attackerCount / 24) - (defenderCount / 12) * 1.5
    : (defenderCount / 12) * 1.5 - (attackerCount / 24);
  score += pieceAdvantage * 0.2;
  
  if (kingX !== -1) {
    const minCornerDist = Math.min(
      kingX + kingY,
      (BOARD_SIZE - 1 - kingX) + kingY,
      kingX + (BOARD_SIZE - 1 - kingY),
      (BOARD_SIZE - 1 - kingX) + (BOARD_SIZE - 1 - kingY)
    );
    
    const maxDist = (BOARD_SIZE - 1) * 2;
    const cornerProximity = 1 - (minCornerDist / maxDist);
    
    if (aiPlayer === 'defender') {
      score += cornerProximity * 0.3;
    } else {
      score -= cornerProximity * 0.3;
    }
    
    const kingMoves = getValidMoves(state, kingX, kingY);
    const mobility = kingMoves.length / 20;
    
    if (aiPlayer === 'defender') {
      score += mobility * 0.2;
    } else {
      score -= mobility * 0.2;
    }
  }
  
  return Math.max(0, Math.min(1, score));
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
  
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  if (difficulty === 'normal' && Math.random() < 0.15) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { fromX: m.fromX, fromY: m.fromY, toX: m.toX, toY: m.toY };
  }
  
  const root = new MCTSNode(state);
  
  for (let i = 0; i < maxIterations; i++) {
    let node = root;
    
    while (node.isFullyExpanded() && node.children.length > 0) {
      node = node.bestChild();
    }
    
    if (!node.state.winner && node.untriedMoves.length > 0) {
      const move = node.untriedMoves.shift()!;
      const newState = movePiece(node.state, move.fromX, move.fromY, move.toX, move.toY);
      const child = new MCTSNode(newState, node, move);
      node.children.push(child);
      node = child;
    }
    
    let result: number;
    if (node.state.winner) {
      result = node.state.winner === aiPlayer ? 1 : 0;
    } else if (node.state.moveCount > 100) {
      result = evaluate(node.state, aiPlayer);
    } else {
      result = playout(node.state, aiPlayer);
    }
    
    while (node !== null) {
      node.visits++;
      node.totalReward += result;
      node = node.parent!;
    }
  }
  
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
