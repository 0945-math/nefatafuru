import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GameState, createInitialState, Player,
  BOARD_SIZE, CORNERS, CENTER,
  isValidPosition, isCorner, isThrone,
  canMoveTo, getValidMoves, movePiece,
} from './gameLogic';
import { getAIMove, AIMove } from './ai';
import { soundManager } from './sounds';
import { hapticManager } from './haptic';

const CELL_SIZE = 44;
const SVG_SIZE = CELL_SIZE * BOARD_SIZE + 40;
const OFFSET = 20;

function toSvgX(gridX: number): number { return OFFSET + gridX * CELL_SIZE + CELL_SIZE / 2; }
function toSvgY(gridY: number): number { return OFFSET + gridY * CELL_SIZE + CELL_SIZE / 2; }

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [playerSide, setPlayerSide] = useState<'attacker' | 'defender'>('defender');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animatingCells, setAnimatingCells] = useState<Set<string>>(new Set());
  const [showRules, setShowRules] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const prevBoardRef = useRef<string>(JSON.stringify(createInitialState().board));

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setAiThinking(false);
    setGameStarted(true);
    setAnimatingCells(new Set());
    prevBoardRef.current = JSON.stringify(createInitialState().board);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      soundManager.setEnabled(!prev);
      return !prev;
    });
  }, []);

  // Splash screen
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Animation tracking
  useEffect(() => {
    const prev = JSON.parse(prevBoardRef.current);
    const curr = gameState.board;
    const newAnimating = new Set<string>();
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (prev[y][x] !== curr[y][x]) {
          newAnimating.add(`${x},${y}`);
        }
      }
    }
    
    if (newAnimating.size > 0) {
      setAnimatingCells(newAnimating);
      setTimeout(() => setAnimatingCells(new Set()), 300);
    }
    
    prevBoardRef.current = JSON.stringify(curr);
  }, [gameState.board]);

  // AI move
  useEffect(() => {
    if (!gameStarted || gameState.winner) return;
    if (gameState.currentPlayer === playerSide) return;

    setAiThinking(true);
    const timer = setTimeout(() => {
      const aiMove: AIMove | null = getAIMove(gameState, difficulty);

      if (!aiMove) {
        setGameState(prev => ({
          ...prev,
          winner: playerSide,
          message: `🏆 ${playerSide === 'attacker' ? '攻撃側' : '防御側'}の勝利！`,
        }));
        setAiThinking(false);
        soundManager.playWin();
        return;
      }

      soundManager.playMove();
      setGameState(prev => movePiece(prev, aiMove.fromX, aiMove.fromY, aiMove.toX, aiMove.toY));
      setAiThinking(false);
    }, 700);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.winner, gameStarted, difficulty, playerSide]);

  // Win/lose sounds
  useEffect(() => {
    if (gameState.winner) {
      if (gameState.winner === playerSide) {
        soundManager.playWin();
        hapticManager.success();
      } else {
        soundManager.playLose();
        hapticManager.error();
      }
    }
  }, [gameState.winner, playerSide]);

  const handleCellClick = useCallback((x: number, y: number) => {
    if (!gameStarted || gameState.winner || aiThinking) return;
    if (gameState.currentPlayer !== playerSide) return;

    const piece = gameState.board[y][x];
    
    // Select own piece
    if ((playerSide === 'attacker' && piece === 'attacker') ||
        (playerSide === 'defender' && (piece === 'defender' || piece === 'king'))) {
      hapticManager.light();
      setGameState(prev => ({ ...prev, selectedPiece: { x, y } }));
      return;
    }
    
    // Move selected piece
    if (gameState.selectedPiece) {
      const { x: fromX, y: fromY } = gameState.selectedPiece;
      if (canMoveTo(gameState, fromX, fromY, x, y)) {
        hapticManager.medium();
        soundManager.playPlace();
        setGameState(prev => movePiece(prev, fromX, fromY, x, y));
      } else {
        hapticManager.error();
      }
    }
  }, [gameState, aiThinking, gameStarted, playerSide]);

  // Valid moves for selected piece
  const validMoves = gameState.selectedPiece
    ? getValidMoves(gameState, gameState.selectedPiece.x, gameState.selectedPiece.y)
    : [];
  const validMoveSet = new Set(validMoves.map(m => `${m.x},${m.y}`));

  // Count pieces
  let attackerCount = 0;
  let defenderCount = 0;
  let hasKing = false;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (gameState.board[y][x] === 'attacker') attackerCount++;
      if (gameState.board[y][x] === 'defender') defenderCount++;
      if (gameState.board[y][x] === 'king') hasKing = true;
    }
  }

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-8xl mb-6 animate-float">⚔️</div>
          <h1 className="text-5xl font-bold text-white mb-3">ネファタフル</h1>
          <p className="text-purple-200 text-xl">Hnefatafl - ヴァイキングチェス</p>
          <div className="mt-8 flex justify-center">
            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        </div>

        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-white/20">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4 animate-float">⚔️</div>
            <h1 className="text-5xl font-bold text-white mb-3">ネファタフル</h1>
            <p className="text-purple-200 text-xl">Hnefatafl - ヴァイキングチェス</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-purple-200 font-medium mb-3 text-sm uppercase tracking-wider">あなたの陣営</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { hapticManager.light(); setPlayerSide('attacker'); }}
                  className={`p-4 rounded-2xl border-4 transition-all duration-300 ${
                    playerSide === 'attacker' ? 'border-red-400 shadow-lg shadow-red-500/50 scale-105' : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="text-3xl mb-2">🗡️</div>
                  <div className="text-white font-bold">攻撃側</div>
                  <div className="text-purple-300 text-xs mt-1">24駒 - 王を捕獲</div>
                </button>
                <button
                  onClick={() => { hapticManager.light(); setPlayerSide('defender'); }}
                  className={`p-4 rounded-2xl border-4 transition-all duration-300 ${
                    playerSide === 'defender' ? 'border-blue-400 shadow-lg shadow-blue-500/50 scale-105' : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="text-3xl mb-2">🛡️</div>
                  <div className="text-white font-bold">防御側</div>
                  <div className="text-purple-300 text-xs mt-1">12駒+王 - 王を脱出</div>
                </button>
              </div>
            </div>

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
                    onClick={() => { hapticManager.light(); setDifficulty(d.key); }}
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

            <button
              onClick={() => { hapticManager.light(); setShowRules(true); }}
              className="w-full bg-white/10 hover:bg-white/20 text-purple-200 font-medium py-3 px-4 rounded-xl transition-all text-sm border border-white/10"
            >
              📖 ルールを見る
            </button>

            <button
              onClick={() => { hapticManager.heavy(); resetGame(); }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 px-8 rounded-xl shadow-xl transition-all hover:scale-[1.02] text-lg"
            >
              ⚔️ ゲーム開始
            </button>
          </div>
        </div>

        {showRules && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
              <h2 className="text-3xl font-bold text-white mb-6">📖 ネファタフルのルール</h2>
              <div className="space-y-4 text-purple-200">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">⚔️ 非対称ゲーム</h3>
                  <p>攻撃側（24駒）vs 防御側（12駒 + 王）の非対称なゲームです</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🗡️ 攻撃側の目的</h3>
                  <p>中央の王を四方から囲んで捕獲する</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🛡️ 防御側の目的</h3>
                  <p>王を盤の四隅のいずれかに脱出させる</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">♜ 駒の動き</h3>
                  <p>すべての駒はチェスのルークのように縦横に何マスでも移動できます（他の駒を飛び越えることはできません）</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">⚡ 捕獲ルール</h3>
                  <p>敵の駒を自分の駒ではさむと捕獲できます（王は除く）</p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">👑 王の特別ルール</h3>
                  <p>王は中央の王座と四隅にのみ入ることができます</p>
                </div>
              </div>
              <button
                onClick={() => setShowRules(false)}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
      </div>

      <header className="relative z-10 text-center py-3 px-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">⚔️ ネファタフル</h1>
      </header>

      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 px-4 pb-24">
        {/* Left Panel */}
        <div className="w-full lg:w-72 order-2 lg:order-1">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10 space-y-3">
            {/* Status */}
            <div className={`text-center py-2 px-3 rounded-xl text-sm font-medium ${
              gameState.winner
                ? gameState.winner === playerSide ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                : gameState.currentPlayer === playerSide
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-purple-500/20 text-purple-300'
            }`}>
              {aiThinking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></span>
                  AI思考中...
                </span>
              ) : gameState.message}
            </div>

            {/* Attacker info */}
            <div className={`p-3 rounded-xl ${
              gameState.currentPlayer === 'attacker' && !gameState.winner ? 'bg-red-500/20 border border-red-400/50' : 'bg-white/5'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🗡️</span>
                <span className="text-white font-bold text-sm">攻撃側 {gameState.currentPlayer === 'attacker' && !gameState.winner ? '(ターン)' : ''}</span>
              </div>
              <div className="text-red-300 text-xs">駒数: {attackerCount} / 24</div>
            </div>

            {/* Defender info */}
            <div className={`p-3 rounded-xl ${
              gameState.currentPlayer === 'defender' && !gameState.winner ? 'bg-blue-500/20 border border-blue-400/50' : 'bg-white/5'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🛡️</span>
                <span className="text-white font-bold text-sm">防御側 {gameState.currentPlayer === 'defender' && !gameState.winner ? '(ターン)' : ''}</span>
              </div>
              <div className="text-blue-300 text-xs">駒数: {defenderCount} / 12 {hasKing ? '+ 👑' : '(王捕獲!)'}</div>
            </div>

            {/* Move counter */}
            <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
              <div className="text-purple-300 text-xs">手数</div>
              <div className="text-white font-bold text-xl">{gameState.moveCount}</div>
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="order-1 lg:order-2 flex-shrink-0">
          <div className="bg-gradient-to-br from-amber-900/40 to-amber-950/40 backdrop-blur-xl rounded-3xl p-3 md:p-4 shadow-2xl border border-amber-700/30">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px]"
            >
              <defs>
                <radialGradient id="boardGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#c8a882" />
                  <stop offset="100%" stopColor="#8B6914" />
                </radialGradient>
                <filter id="shadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4" />
                </filter>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Board background */}
              <rect x="5" y="5" width={SVG_SIZE - 10} height={SVG_SIZE - 10} fill="url(#boardGrad)" rx="10" />
              <rect x="5" y="5" width={SVG_SIZE - 10} height={SVG_SIZE - 10} fill="none" stroke="#5d4037" strokeWidth="3" rx="10" />

              {/* Grid lines */}
              {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                <g key={`grid-${i}`}>
                  <line
                    x1={toSvgX(0)} y1={toSvgY(i)}
                    x2={toSvgX(BOARD_SIZE - 1)} y2={toSvgY(i)}
                    stroke="#5d4037" strokeWidth="1.5" opacity="0.5"
                  />
                  <line
                    x1={toSvgX(i)} y1={toSvgY(0)}
                    x2={toSvgX(i)} y2={toSvgY(BOARD_SIZE - 1)}
                    stroke="#5d4037" strokeWidth="1.5" opacity="0.5"
                  />
                </g>
              ))}

              {/* Special positions */}
              {/* Corners */}
              {CORNERS.map((c, i) => (
                <rect
                  key={`corner-${i}`}
                  x={toSvgX(c.x) - CELL_SIZE / 2 + 2}
                  y={toSvgY(c.y) - CELL_SIZE / 2 + 2}
                  width={CELL_SIZE - 4}
                  height={CELL_SIZE - 4}
                  fill="rgba(250, 204, 21, 0.2)"
                  stroke="rgba(250, 204, 21, 0.5)"
                  strokeWidth="2"
                  rx="4"
                />
              ))}

              {/* Throne (center) */}
              <rect
                x={toSvgX(CENTER.x) - CELL_SIZE / 2 + 2}
                y={toSvgY(CENTER.y) - CELL_SIZE / 2 + 2}
                width={CELL_SIZE - 4}
                height={CELL_SIZE - 4}
                fill="rgba(168, 85, 247, 0.2)"
                stroke="rgba(168, 85, 247, 0.5)"
                strokeWidth="2"
                rx="4"
              />

              {/* Valid move highlights */}
              {Array.from(validMoveSet).map(key => {
                const [x, y] = key.split(',').map(Number);
                return (
                  <rect
                    key={`valid-${key}`}
                    x={toSvgX(x) - CELL_SIZE / 2 + 3}
                    y={toSvgY(y) - CELL_SIZE / 2 + 3}
                    width={CELL_SIZE - 6}
                    height={CELL_SIZE - 6}
                    fill="rgba(34, 197, 94, 0.25)"
                    stroke="rgba(34, 197, 94, 0.7)"
                    strokeWidth="2"
                    rx="4"
                    className="animate-pulse"
                  />
                );
              })}

              {/* Pieces */}
              {gameState.board.map((row, y) =>
                row.map((cell, x) => {
                  if (cell === 0) return null;
                  
                  const cx = toSvgX(x);
                  const cy = toSvgY(y);
                  const isSelected = gameState.selectedPiece?.x === x && gameState.selectedPiece?.y === y;
                  const isAnimating = animatingCells.has(`${x},${y}`);
                  
                  let fill = '#888';
                  let stroke = '#333';
                  let symbol = '';
                  
                  if (cell === 'attacker') {
                    fill = '#dc2626';
                    stroke = '#7f1d1d';
                    symbol = '🗡️';
                  } else if (cell === 'defender') {
                    fill = '#2563eb';
                    stroke = '#1e3a8a';
                    symbol = '🛡️';
                  } else if (cell === 'king') {
                    fill = '#eab308';
                    stroke = '#854d0e';
                    symbol = '👑';
                  }
                  
                  return (
                    <g
                      key={`piece-${x}-${y}`}
                      onClick={() => handleCellClick(x, y)}
                      className="cursor-pointer"
                    >
                      {/* Selection highlight */}
                      {isSelected && (
                        <circle cx={cx} cy={cy} r={CELL_SIZE / 2 - 2} fill="none" stroke="rgba(96, 165, 250, 0.9)" strokeWidth="3" filter="url(#glow)" />
                      )}
                      
                      {/* Piece shadow */}
                      <circle cx={cx} cy={cy + 2} r={CELL_SIZE / 2 - 5} fill="rgba(0,0,0,0.3)" />
                      
                      {/* Piece */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={CELL_SIZE / 2 - 5}
                        fill={fill}
                        stroke={isSelected ? '#60a5fa' : stroke}
                        strokeWidth={isSelected ? 3 : 2}
                        filter="url(#shadow)"
                        className={isAnimating ? 'animate-piece-in' : ''}
                      />
                      
                      {/* Symbol */}
                      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize="16">
                        {symbol}
                      </text>
                    </g>
                  );
                })
              )}

              {/* Clickable cells overlay */}
              {gameState.board.map((row, y) =>
                row.map((_, x) => (
                  <rect
                    key={`click-${x}-${y}`}
                    x={toSvgX(x) - CELL_SIZE / 2}
                    y={toSvgY(y) - CELL_SIZE / 2}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    fill="transparent"
                    onClick={() => handleCellClick(x, y)}
                    className="cursor-pointer"
                  />
                ))
              )}
            </svg>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-72 order-3">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <h3 className="text-white font-bold mb-3 text-sm">💡 ヒント</h3>
            <div className="text-xs text-purple-200 space-y-2">
              <p>🟢 <strong>緑</strong> = 移動可能な場所</p>
              <p>🔵 <strong>青い輪</strong> = 選択中の駒</p>
              <p>🟡 <strong>四隅</strong> = 王の脱出先</p>
              <p>🟣 <strong>中央</strong> = 王座</p>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <h4 className="text-purple-200 font-bold mb-2 text-xs">🎯 戦略</h4>
              <ul className="text-xs text-purple-300 space-y-1">
                <li>• 攻撃側：王を四方から囲む</li>
                <li>• 防御側：王を四隅に逃がす</li>
                <li>• 駒をはさんで捕獲できる</li>
                <li>• 中央と四隅は特別</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom z-40">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button onClick={() => { hapticManager.light(); resetGame(); }} className="flex flex-col items-center justify-center flex-1 h-full text-purple-300">
            <span className="text-2xl">🔄</span>
            <span className="text-xs mt-1">リセット</span>
          </button>
          <button onClick={() => { hapticManager.light(); toggleSound(); }} className="flex flex-col items-center justify-center flex-1 h-full text-purple-300">
            <span className="text-2xl">{soundEnabled ? '🔊' : '🔇'}</span>
            <span className="text-xs mt-1">サウンド</span>
          </button>
          <button onClick={() => { hapticManager.light(); setGameStarted(false); }} className="flex flex-col items-center justify-center flex-1 h-full text-purple-300">
            <span className="text-2xl">⚙️</span>
            <span className="text-xs mt-1">設定</span>
          </button>
        </div>
      </nav>

      {/* Winner Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-white/20">
            <div className="text-8xl mb-4">
              {gameState.winner === playerSide ? '🏆' : '💀'}
            </div>
            <h2 className="text-4xl font-bold text-white mb-3">
              {gameState.winner === playerSide ? '勝利！' : '敗北...'}
            </h2>
            <p className="text-purple-200 text-lg mb-6">
              {gameState.winner === 'attacker'
                ? '攻撃側が王を捕獲しました！'
                : '防御側の王が脱出しました！'}
            </p>
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-purple-500/10 rounded-lg p-2">
                  <div className="text-purple-300 text-xs">総手数</div>
                  <div className="text-white font-bold text-lg">{gameState.moveCount}</div>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-2">
                  <div className="text-amber-300 text-xs">難易度</div>
                  <div className="text-white font-bold text-lg">{difficulty === 'easy' ? '簡単' : difficulty === 'normal' ? '普通' : '難しい'}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={resetGame} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all">
                🔄 もう一度
              </button>
              <button onClick={() => setGameStarted(false)} className="bg-white/10 text-purple-200 font-medium py-3 px-6 rounded-xl border border-white/10">
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
