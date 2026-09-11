import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GameState, createInitialState, Player,
  POS_COORDS, MILLS,
  placePiece, removePiece, selectPiece, movePiece,
  getValidPlacements, getValidTargets, getRemovablePieces,
  isFlying,
} from './gameLogic';
import { getAIMove, AIMove } from './ai';
import { soundManager } from './sounds';

// Board lines
const BOARD_LINES: [number, number][] = [
  [0, 1], [1, 2], [2, 14], [14, 23], [23, 22], [22, 21], [21, 9], [9, 0],
  [3, 4], [4, 5], [5, 13], [13, 20], [20, 19], [19, 18], [18, 10], [10, 3],
  [6, 7], [7, 8], [8, 12], [12, 17], [17, 16], [16, 15], [15, 11], [11, 6],
  [1, 4], [4, 7], [9, 10], [10, 11], [12, 13], [13, 14], [16, 19], [19, 22],
];

const SVG_SIZE = 500;
const PADDING = 50;
const SCALE = (SVG_SIZE - PADDING * 2) / 6;

function toSvgX(gridX: number): number { return PADDING + gridX * SCALE; }
function toSvgY(gridY: number): number { return PADDING + gridY * SCALE; }

// Find active mills
function getActiveMills(board: (0 | 1 | 2)[]): { mill: number[]; player: Player }[] {
  const result: { mill: number[]; player: Player }[] = [];
  for (const mill of MILLS) {
    if (mill.every(p => board[p] === 1)) result.push({ mill, player: 1 });
    if (mill.every(p => board[p] === 2)) result.push({ mill, player: 2 });
  }
  return result;
}

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<'dark' | 'light'>('dark');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animatingPieces, setAnimatingPieces] = useState<Set<number>>(new Set());
  const [showRules, setShowRules] = useState(false);
  const prevBoardRef = useRef<(0 | 1 | 2)[]>(Array(24).fill(0));

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setAiThinking(false);
    setGameStarted(true);
    setAnimatingPieces(new Set());
    prevBoardRef.current = Array(24).fill(0);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      soundManager.setEnabled(!prev);
      return !prev;
    });
  }, []);

  // Track board changes for animations
  useEffect(() => {
    const prev = prevBoardRef.current;
    const curr = gameState.board;
    const newAnimating = new Set<number>();
    
    for (let i = 0; i < 24; i++) {
      if (prev[i] !== curr[i]) {
        newAnimating.add(i);
      }
    }
    
    if (newAnimating.size > 0) {
      setAnimatingPieces(newAnimating);
      setTimeout(() => setAnimatingPieces(new Set()), 300);
    }
    
    prevBoardRef.current = [...curr];
  }, [gameState.board]);

  // AI move execution
  useEffect(() => {
    if (!gameStarted) return;
    if (gameState.currentPlayer !== 2 || gameState.winner) return;

    if (gameState.removingPiece) {
      const timer = setTimeout(() => {
        setGameState(prev => {
          if (!prev.removingPiece || prev.currentPlayer !== 2) return prev;
          const removable = getRemovablePieces(prev.board, 1);
          if (removable.length > 0) {
            soundManager.playRemove();
            return removePiece(prev, removable[0]);
          }
          return { ...prev, removingPiece: false };
        });
      }, 600);
      return () => clearTimeout(timer);
    }

    setAiThinking(true);
    const timer = setTimeout(() => {
      const aiMove: AIMove | null = getAIMove(gameState, difficulty);

      if (!aiMove) {
        setGameState(prev => ({
          ...prev,
          winner: 1,
          message: '🎉 AIが動けません！あなたの勝利です！',
        }));
        setAiThinking(false);
        soundManager.playWin();
        return;
      }

      setGameState(prev => {
        let newState = { ...prev };

        if (newState.phase === 'placing') {
          soundManager.playPlace();
          newState = placePiece(newState, aiMove.to);
        } else {
          if (aiMove.from !== undefined) {
            soundManager.playMove();
            newState = selectPiece(newState, aiMove.from);
            newState = movePiece(newState, aiMove.from!, aiMove.to);
          }
        }

        // Handle AI removal
        if (newState.removingPiece && newState.currentPlayer === 2) {
          soundManager.playMill();
          const removal = aiMove.removal !== undefined && aiMove.removal >= 0
            ? aiMove.removal
            : getRemovablePieces(newState.board, 1)[0];
          
          if (removal !== undefined) {
            setTimeout(() => {
              soundManager.playRemove();
              setGameState(p => {
                if (!p.removingPiece || p.currentPlayer !== 2) return p;
                return removePiece(p, removal);
              });
            }, 700);
          } else {
            newState = { ...newState, removingPiece: false };
          }
        }

        return newState;
      });

      setAiThinking(false);
    }, 800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.winner, gameState.removingPiece, gameStarted, difficulty]);

  // Play win/lose sounds
  useEffect(() => {
    if (gameState.winner) {
      if (gameState.winner === 1) {
        soundManager.playWin();
      } else {
        soundManager.playLose();
      }
    }
  }, [gameState.winner]);

  const handlePositionClick = useCallback((pos: number) => {
    if (!gameStarted || gameState.winner || gameState.currentPlayer !== 1 || aiThinking) return;

    if (gameState.removingPiece) {
      const removable = getRemovablePieces(gameState.board, 2);
      if (removable.includes(pos)) {
        soundManager.playRemove();
        setGameState(prev => removePiece(prev, pos));
      }
      return;
    }

    if (gameState.phase === 'placing') {
      const valid = getValidPlacements(gameState.board);
      if (valid.includes(pos)) {
        soundManager.playPlace();
        setGameState(prev => {
          const newState = placePiece(prev, pos);
          if (newState.removingPiece) {
            soundManager.playMill();
          }
          return newState;
        });
      }
      return;
    }

    if (gameState.phase === 'moving') {
      if (gameState.board[pos] === 1) {
        setGameState(prev => selectPiece(prev, pos));
        return;
      }
      if (gameState.selectedPiece !== null && gameState.board[pos] === 0) {
        const targets = getValidTargets(gameState.board, gameState.selectedPiece, 1);
        if (targets.includes(pos)) {
          soundManager.playMove();
          setGameState(prev => {
            const newState = movePiece(prev, gameState.selectedPiece!, pos);
            if (newState.removingPiece) {
              soundManager.playMill();
            }
            return newState;
          });
        }
      }
    }
  }, [gameState, aiThinking, gameStarted]);

  // Compute highlights
  const getHighlights = () => {
    const valid = new Set<number>();
    const removable = new Set<number>();

    if (gameState.currentPlayer !== 1 || aiThinking || gameState.winner) return { valid, removable };

    if (gameState.removingPiece) {
      getRemovablePieces(gameState.board, 2).forEach(p => removable.add(p));
    } else if (gameState.phase === 'placing') {
      getValidPlacements(gameState.board).forEach(p => valid.add(p));
    } else if (gameState.phase === 'moving' && gameState.selectedPiece !== null) {
      getValidTargets(gameState.board, gameState.selectedPiece, 1).forEach(p => valid.add(p));
    }

    return { valid, removable };
  };

  const { valid: validHighlights, removable: removableHighlights } = getHighlights();
  const activeMills = getActiveMills(gameState.board);
  const millPositions = new Set<number>();
  activeMills.forEach(m => m.mill.forEach(p => millPositions.add(p)));

  const playerFill = playerColor === 'dark' ? '#1e293b' : '#fef3c7';
  const aiFill = playerColor === 'dark' ? '#fef3c7' : '#1e293b';
  const playerStroke = playerColor === 'dark' ? '#60a5fa' : '#f59e0b';
  const aiStroke = playerColor === 'dark' ? '#f59e0b' : '#60a5fa';

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-white/20">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">♟️</div>
            <h1 className="text-5xl font-bold text-white mb-3">モラバラバ</h1>
            <p className="text-purple-200 text-xl">Morabaraba - AI対戦ボードゲーム</p>
          </div>

          <div className="space-y-6">
            {/* Color selection */}
            <div>
              <label className="block text-purple-200 font-medium mb-3 text-sm uppercase tracking-wider">あなたの駒の色</label>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setPlayerColor('dark')}
                  className={`w-24 h-24 rounded-2xl border-4 transition-all duration-300 ${
                    playerColor === 'dark' ? 'border-blue-400 shadow-lg shadow-blue-500/50 scale-110' : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: '#1e293b' }}
                >
                  <span className="text-white text-sm font-bold">黒</span>
                </button>
                <button
                  onClick={() => setPlayerColor('light')}
                  className={`w-24 h-24 rounded-2xl border-4 transition-all duration-300 ${
                    playerColor === 'light' ? 'border-amber-400 shadow-lg shadow-amber-500/50 scale-110' : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: '#fef3c7' }}
                >
                  <span className="text-gray-800 text-sm font-bold">白</span>
                </button>
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-purple-200 font-medium mb-3 text-sm uppercase tracking-wider">難易度</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'easy', label: '簡単', emoji: '🌱' },
                  { key: 'normal', label: '普通', emoji: '⚔️' },
                  { key: 'hard', label: '難しい', emoji: '🔥' },
                ] as const).map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className={`p-4 rounded-xl transition-all duration-300 ${
                      difficulty === d.key
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                        : 'bg-white/10 text-purple-200 hover:bg-white/20'
                    }`}
                  >
                    <div className="text-3xl mb-2">{d.emoji}</div>
                    <div className="font-bold">{d.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules button */}
            <button
              onClick={() => setShowRules(true)}
              className="w-full bg-white/10 hover:bg-white/20 text-purple-200 font-medium py-3 px-4 rounded-xl transition-all text-sm border border-white/10"
            >
              📖 ルールを見る
            </button>

            {/* Start button */}
            <button
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 px-8 rounded-xl shadow-xl transition-all hover:scale-[1.02] text-lg"
            >
              🎮 ゲーム開始
            </button>
          </div>
        </div>

        {/* Rules Modal */}
        {showRules && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
              <h2 className="text-3xl font-bold text-white mb-6">📖 モラバラバのルール</h2>
              
              <div className="space-y-4 text-purple-200">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🎯 ゲームの目的</h3>
                  <p>相手の駒を2個以下にする、または相手が動けなくする</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">📍 配置フェーズ</h3>
                  <p>各プレイヤー12個の駒を交互に空いている交点に配置します</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🔄 移動フェーズ</h3>
                  <p>駒を隣接する空いている点に移動します</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🦅 フライトフェーズ</h3>
                  <p>駒が3個になったら、どこにでも移動できるようになります</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">✨ ミル（3つ並べ）</h3>
                  <p>直線上に3つ並べると「ミル」成立！相手の駒を1つ取ることができます</p>
                  <p className="text-sm mt-2 text-purple-300">※ミルを構成している駒は取れませんが、全ての駒がミルの場合は取れます</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">💡 戦略のコツ</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>中央の交点は価値が高い</li>
                    <li>2つ並べたら3つ目を狙う</li>
                    <li>相手のミルを阻止しよう</li>
                    <li>複数のミルを同時に狙うと強力</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setShowRules(false)}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="text-center py-4 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white">♟️ モラバラバ</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 px-4 pb-4">
        {/* Left Panel */}
        <div className="w-full lg:w-80 order-2 lg:order-1">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10 space-y-4">
            {/* Status message */}
            <div className={`text-center py-3 px-4 rounded-xl ${
              gameState.winner
                ? gameState.winner === 1 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                : gameState.removingPiece
                  ? 'bg-amber-500/20 text-amber-300'
                  : gameState.currentPlayer === 1
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-purple-500/20 text-purple-300'
            }`}>
              <div className="text-sm font-medium">
                {aiThinking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></span>
                    AI思考中...
                  </span>
                ) : gameState.message}
              </div>
            </div>

            {/* Player cards */}
            <div className="space-y-3">
              <div className={`p-4 rounded-xl transition-all ${
                gameState.currentPlayer === 1 && !gameState.winner
                  ? 'bg-blue-500/20 border-2 border-blue-400/50'
                  : 'bg-white/5 border-2 border-transparent'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full shadow-lg" style={{ backgroundColor: playerFill, border: `3px solid ${playerStroke}` }} />
                  <div>
                    <div className="text-white font-bold">あなた</div>
                    <div className="text-purple-300 text-xs">
                      {gameState.phase === 'placing' ? `配置残り: ${gameState.piecesToPlace[0]}個` : '移動フェーズ'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg">{gameState.piecesOnBoard[0]}</div>
                    <div className="text-purple-300 text-xs">盤上</div>
                  </div>
                  <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg">{gameState.piecesToPlace[0]}</div>
                    <div className="text-purple-300 text-xs">残り</div>
                  </div>
                  <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg">{activeMills.filter(m => m.player === 1).length}</div>
                    <div className="text-purple-300 text-xs">ミル</div>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl transition-all ${
                gameState.currentPlayer === 2 && !gameState.winner
                  ? 'bg-red-500/20 border-2 border-red-400/50'
                  : 'bg-white/5 border-2 border-transparent'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full shadow-lg" style={{ backgroundColor: aiFill, border: `3px solid ${aiStroke}` }} />
                  <div>
                    <div className="text-white font-bold">AI 🤖</div>
                    <div className="text-purple-300 text-xs">
                      {difficulty === 'easy' ? '簡単' : difficulty === 'normal' ? '普通' : '難しい'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg">{gameState.piecesOnBoard[1]}</div>
                    <div className="text-purple-300 text-xs">盤上</div>
                  </div>
                  <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg">{gameState.piecesToPlace[1]}</div>
                    <div className="text-purple-300 text-xs">残り</div>
                  </div>
                  <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg">{activeMills.filter(m => m.player === 2).length}</div>
                    <div className="text-purple-300 text-xs">ミル</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phase indicator */}
            <div className="flex items-center justify-center gap-2 py-2">
              <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                gameState.phase === 'placing' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
              }`}>
                {gameState.phase === 'placing' ? '📍 配置フェーズ' :
                 gameState.removingPiece ? '🎯 駒を取る' :
                 isFlying(gameState.board, gameState.currentPlayer) ? '🦅 フライト' :
                 '🔄 移動フェーズ'}
              </div>
            </div>

            {/* Move counter */}
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <div className="text-purple-300 text-xs">手数</div>
              <div className="text-white font-bold text-2xl">{gameState.moveCount}</div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={toggleSound}
                className="flex-1 bg-white/10 hover:bg-white/20 text-purple-200 font-medium py-2 px-3 rounded-lg transition-all text-sm border border-white/10"
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>
              <button
                onClick={resetGame}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium py-2 px-3 rounded-lg transition-all text-sm"
              >
                🔄 リセット
              </button>
              <button
                onClick={() => setGameStarted(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-purple-200 font-medium py-2 px-3 rounded-lg transition-all text-sm border border-white/10"
              >
                ⚙️ 設定
              </button>
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="order-1 lg:order-2 flex-shrink-0">
          <div className="bg-gradient-to-br from-amber-800/40 to-amber-900/40 backdrop-blur-xl rounded-3xl p-4 md:p-6 shadow-2xl border border-amber-600/20">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px]"
            >
              <defs>
                <radialGradient id="boardGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d4a574" />
                  <stop offset="100%" stopColor="#8B6914" />
                </radialGradient>
                <filter id="shadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                </filter>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              <rect x="10" y="10" width={SVG_SIZE - 20} height={SVG_SIZE - 20} fill="url(#boardGrad)" rx="20" />
              <rect x="10" y="10" width={SVG_SIZE - 20} height={SVG_SIZE - 20} fill="none" stroke="#6b4423" strokeWidth="4" rx="20" />

              {/* Active mill lines */}
              {activeMills.map((m, idx) => {
                const color = m.player === 1 ? playerStroke : aiStroke;
                return m.mill.map((pos, i) => {
                  if (i === 0) return null;
                  const prev = m.mill[i - 1];
                  return (
                    <line
                      key={`mill-${idx}-${i}`}
                      x1={toSvgX(POS_COORDS[prev].x)}
                      y1={toSvgY(POS_COORDS[prev].y)}
                      x2={toSvgX(POS_COORDS[pos].x)}
                      y2={toSvgY(POS_COORDS[pos].y)}
                      stroke={color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      opacity="0.6"
                      filter="url(#glow)"
                    />
                  );
                });
              })}

              {/* Board lines */}
              {BOARD_LINES.map(([from, to], idx) => (
                <line
                  key={idx}
                  x1={toSvgX(POS_COORDS[from].x)}
                  y1={toSvgY(POS_COORDS[from].y)}
                  x2={toSvgX(POS_COORDS[to].x)}
                  y2={toSvgY(POS_COORDS[to].y)}
                  stroke="#4a3520"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ))}

              {/* Position markers and pieces */}
              {POS_COORDS.map((coord, pos) => {
                const cx = toSvgX(coord.x);
                const cy = toSvgY(coord.y);
                const isValid = validHighlights.has(pos);
                const isRemovable = removableHighlights.has(pos);
                const isSelected = gameState.selectedPiece === pos;
                const isInMill = millPositions.has(pos);
                const cellState = gameState.board[pos];

                return (
                  <g key={pos} onClick={() => handlePositionClick(pos)} className="cursor-pointer">
                    {/* Valid move highlight */}
                    {isValid && cellState === 0 && (
                      <>
                        <circle cx={cx} cy={cy} r={24} fill="rgba(34, 197, 94, 0.15)" />
                        <circle cx={cx} cy={cy} r={16} fill="rgba(34, 197, 94, 0.4)" className="animate-pulse" />
                        <circle cx={cx} cy={cy} r={8} fill="rgba(34, 197, 94, 0.8)" />
                      </>
                    )}

                    {/* Removable highlight */}
                    {isRemovable && (
                      <>
                        <circle cx={cx} cy={cy} r={28} fill="none" stroke="rgba(239, 68, 68, 0.7)" strokeWidth="3" strokeDasharray="6,4" className="animate-pulse" />
                        <circle cx={cx} cy={cy} r={24} fill="rgba(239, 68, 68, 0.1)" />
                      </>
                    )}

                    {/* Mill glow */}
                    {isInMill && cellState !== 0 && (
                      <circle cx={cx} cy={cy} r={26} fill="none" stroke="rgba(250, 204, 21, 0.6)" strokeWidth="3" filter="url(#glow)" />
                    )}

                    {/* Selected highlight */}
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={28} fill="none" stroke="rgba(96, 165, 250, 0.9)" strokeWidth="3" filter="url(#glow)" />
                    )}

                    {/* Empty position marker */}
                    {cellState === 0 && (
                      <circle cx={cx} cy={cy} r={7} fill="#4a3520" opacity={0.6} />
                    )}

                    {/* Player 1 piece */}
                    {cellState === 1 && (
                      <g className={animatingPieces.has(pos) ? 'animate-piece-in' : ''}>
                        <circle cx={cx} cy={cy + 2} r={20} fill="rgba(0,0,0,0.3)" />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={20}
                          fill={playerFill}
                          stroke={isSelected ? '#60a5fa' : playerStroke}
                          strokeWidth={isSelected ? 4 : 3}
                          filter="url(#shadow)"
                        />
                        <circle cx={cx - 6} cy={cy - 6} r={7} fill="rgba(255,255,255,0.2)" />
                        <circle cx={cx - 4} cy={cy - 4} r={3} fill="rgba(255,255,255,0.3)" />
                      </g>
                    )}

                    {/* Player 2 (AI) piece */}
                    {cellState === 2 && (
                      <g className={animatingPieces.has(pos) ? 'animate-piece-in' : ''}>
                        <circle cx={cx} cy={cy + 2} r={20} fill="rgba(0,0,0,0.3)" />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={20}
                          fill={aiFill}
                          stroke={isRemovable ? '#ef4444' : aiStroke}
                          strokeWidth={isRemovable ? 4 : 3}
                          filter="url(#shadow)"
                        />
                        <circle cx={cx - 6} cy={cy - 6} r={7} fill="rgba(255,255,255,0.2)" />
                        <circle cx={cx - 4} cy={cy - 4} r={3} fill="rgba(255,255,255,0.3)" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Panel - Tips */}
        <div className="w-full lg:w-80 order-3">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
            <h3 className="text-white font-bold mb-3">💡 ゲームのコツ</h3>
            <div className="text-sm text-purple-200 space-y-2">
              <p>🟢 <strong>緑のハイライト</strong> = 配置/移動可能な場所</p>
              <p>🔴 <strong>赤の破線</strong> = 取れる相手の駒</p>
              <p>🟡 <strong>金の光</strong> = ミルを構成する駒</p>
              <p>🔵 <strong>青い輪</strong> = 選択中の駒</p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-purple-200 font-bold mb-2 text-sm">🎯 戦略</h4>
              <ul className="text-xs text-purple-300 space-y-1">
                <li>• 中央の交点は価値が高い</li>
                <li>• 2つ並べたら3つ目を狙う</li>
                <li>• 相手のミルを阻止しよう</li>
                <li>• 駒が3個になったらフライト可能</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Winner Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-white/20">
            <div className="text-8xl mb-4">
              {gameState.winner === 1 ? '🏆' : '💀'}
            </div>
            <h2 className="text-4xl font-bold text-white mb-3">
              {gameState.winner === 1 ? '勝利！' : '敗北...'}
            </h2>
            <p className="text-purple-200 text-lg mb-6">
              {gameState.winner === 1
                ? '見事です！AIを打ち負かしました！'
                : 'AIに敗れました。再挑戦しましょう！'}
            </p>
            
            {/* Game Statistics */}
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
              <h3 className="text-white font-bold mb-3 text-sm">📊 ゲーム統計</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-purple-500/10 rounded-lg p-2">
                  <div className="text-purple-300 text-xs">総手数</div>
                  <div className="text-white font-bold text-lg">{gameState.moveCount}</div>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-2">
                  <div className="text-amber-300 text-xs">難易度</div>
                  <div className="text-white font-bold text-lg">{difficulty === 'easy' ? '簡単' : difficulty === 'normal' ? '普通' : '難しい'}</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2">
                  <div className="text-blue-300 text-xs">あなたの駒</div>
                  <div className="text-white font-bold text-lg">{gameState.piecesOnBoard[0]}</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2">
                  <div className="text-red-300 text-xs">AIの駒</div>
                  <div className="text-white font-bold text-lg">{gameState.piecesOnBoard[1]}</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2">
                  <div className="text-blue-300 text-xs">あなたのミル</div>
                  <div className="text-white font-bold text-lg">{activeMills.filter(m => m.player === 1).length}</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2">
                  <div className="text-red-300 text-xs">AIのミル</div>
                  <div className="text-white font-bold text-lg">{activeMills.filter(m => m.player === 2).length}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={resetGame}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105"
              >
                🔄 もう一度
              </button>
              <button
                onClick={() => setGameStarted(false)}
                className="bg-white/10 hover:bg-white/20 text-purple-200 font-medium py-3 px-6 rounded-xl transition-all border border-white/10"
              >
                ⚙️ 設定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
