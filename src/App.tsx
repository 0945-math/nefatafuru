import { useState, useEffect } from 'react';
import {
  GameState, createInitialState, Player,
  BOARD_SIZE, CORNERS,
  canMoveTo, getValidMoves, movePiece,
} from './gameLogic';
import { getAIMove, AIMove } from './ai';

const CELL_SIZE = 40;
const SVG_SIZE = CELL_SIZE * BOARD_SIZE + 40;
const OFFSET = 20;

function toSvgX(gridX: number): number { return OFFSET + gridX * CELL_SIZE + CELL_SIZE / 2; }
function toSvgY(gridY: number): number { return OFFSET + gridY * CELL_SIZE + CELL_SIZE / 2; }

export default function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [playerSide, setPlayerSide] = useState<'attacker' | 'defender'>('defender');

  const resetGame = () => {
    setGameState(createInitialState());
    setAiThinking(false);
    setGameStarted(true);
  };

  // AI move
  useEffect(() => {
    if (!gameStarted || gameState.winner) return;
    if (gameState.currentPlayer === playerSide) return;

    setAiThinking(true);
    setTimeout(() => {
      const aiMove: AIMove | null = getAIMove(gameState, difficulty);

      if (!aiMove) {
        setGameState(prev => ({
          ...prev,
          winner: playerSide,
          message: `🏆 ${playerSide === 'attacker' ? '攻撃側' : '防御側'}の勝利！`,
        }));
        setAiThinking(false);
        return;
      }

      setGameState(prev => movePiece(prev, aiMove.fromX, aiMove.fromY, aiMove.toX, aiMove.toY));
      setAiThinking(false);
    }, 500);
  }, [gameState.currentPlayer, gameState.winner, gameStarted, difficulty, playerSide]);

  const handleCellClick = (x: number, y: number) => {
    if (!gameStarted || gameState.winner || aiThinking) return;
    if (gameState.currentPlayer !== playerSide) return;

    const piece = gameState.board[y][x];
    
    if ((playerSide === 'attacker' && piece === 'attacker') ||
        (playerSide === 'defender' && (piece === 'defender' || piece === 'king'))) {
      setGameState(prev => ({ ...prev, selectedPiece: { x, y } }));
      return;
    }
    
    if (gameState.selectedPiece) {
      const { x: fromX, y: fromY } = gameState.selectedPiece;
      if (canMoveTo(gameState, fromX, fromY, x, y)) {
        setGameState(prev => movePiece(prev, fromX, fromY, x, y));
      }
    }
  };

  const validMoves = gameState.selectedPiece
    ? getValidMoves(gameState, gameState.selectedPiece.x, gameState.selectedPiece.y)
    : [];
  const validMoveSet = new Set(validMoves.map(m => `${m.x},${m.y}`));

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-white/20">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">⚔️</div>
            <h1 className="text-5xl font-bold text-white mb-3">ネファタフル</h1>
            <p className="text-purple-200 text-xl">Hnefatafl - ヴァイキングチェス</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-purple-200 font-medium mb-3 text-sm uppercase tracking-wider">あなたの陣営</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPlayerSide('attacker')}
                  className={`p-4 rounded-2xl border-4 transition-all ${
                    playerSide === 'attacker' ? 'border-red-400 shadow-lg scale-105' : 'border-white/20'
                  }`}
                >
                  <div className="text-3xl mb-2">🗡️</div>
                  <div className="text-white font-bold">攻撃側</div>
                  <div className="text-purple-300 text-xs mt-1">24駒 - 王を捕獲</div>
                </button>
                <button
                  onClick={() => setPlayerSide('defender')}
                  className={`p-4 rounded-2xl border-4 transition-all ${
                    playerSide === 'defender' ? 'border-blue-400 shadow-lg scale-105' : 'border-white/20'
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
                {(['easy', 'normal', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`p-4 rounded-xl transition-all ${
                      difficulty === d
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                        : 'bg-white/10 text-purple-200'
                    }`}
                  >
                    <div className="text-2xl mb-1">{d === 'easy' ? '🌱' : d === 'normal' ? '⚔️' : '🔥'}</div>
                    <div className="font-bold text-sm">{d === 'easy' ? '簡単' : d === 'normal' ? '普通' : '難しい'}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl shadow-xl transition-all hover:scale-[1.02] text-lg"
            >
              ⚔️ ゲーム開始
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      <header className="text-center py-4">
        <h1 className="text-3xl font-bold text-white">⚔️ ネファタフル</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <div className={`text-center py-2 px-4 rounded-xl text-sm font-medium ${
          gameState.winner
            ? gameState.winner === playerSide ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
            : gameState.currentPlayer === playerSide
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-purple-500/20 text-purple-300'
        }`}>
          {aiThinking ? 'AI思考中...' : gameState.message}
        </div>

        <div className="bg-gradient-to-br from-amber-900/40 to-amber-950/40 rounded-3xl p-4 shadow-2xl border border-amber-700/30">
          <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-[320px] h-[320px] md:w-[480px] md:h-[480px]">
            <defs>
              <radialGradient id="boardGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c8a882" />
                <stop offset="100%" stopColor="#8B6914" />
              </radialGradient>
            </defs>

            <rect x="5" y="5" width={SVG_SIZE - 10} height={SVG_SIZE - 10} fill="url(#boardGrad)" rx="10" />
            <rect x="5" y="5" width={SVG_SIZE - 10} height={SVG_SIZE - 10} fill="none" stroke="#5d4037" strokeWidth="3" rx="10" />

            {Array.from({ length: BOARD_SIZE }).map((_, i) => (
              <g key={`grid-${i}`}>
                <line x1={toSvgX(0)} y1={toSvgY(i)} x2={toSvgX(BOARD_SIZE - 1)} y2={toSvgY(i)} stroke="#5d4037" strokeWidth="1.5" opacity="0.5" />
                <line x1={toSvgX(i)} y1={toSvgY(0)} x2={toSvgX(i)} y2={toSvgY(BOARD_SIZE - 1)} stroke="#5d4037" strokeWidth="1.5" opacity="0.5" />
              </g>
            ))}

            {CORNERS.map((c, i) => (
              <rect key={`corner-${i}`} x={toSvgX(c.x) - CELL_SIZE / 2 + 2} y={toSvgY(c.y) - CELL_SIZE / 2 + 2} width={CELL_SIZE - 4} height={CELL_SIZE - 4} fill="rgba(250, 204, 21, 0.2)" stroke="rgba(250, 204, 21, 0.5)" strokeWidth="2" rx="4" />
            ))}

            <rect x={toSvgX(5) - CELL_SIZE / 2 + 2} y={toSvgY(5) - CELL_SIZE / 2 + 2} width={CELL_SIZE - 4} height={CELL_SIZE - 4} fill="rgba(168, 85, 247, 0.2)" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2" rx="4" />

            {Array.from(validMoveSet).map(key => {
              const [x, y] = key.split(',').map(Number);
              return (
                <rect key={`valid-${key}`} x={toSvgX(x) - CELL_SIZE / 2 + 3} y={toSvgY(y) - CELL_SIZE / 2 + 3} width={CELL_SIZE - 6} height={CELL_SIZE - 6} fill="rgba(34, 197, 94, 0.25)" stroke="rgba(34, 197, 94, 0.7)" strokeWidth="2" rx="4" className="animate-pulse" />
              );
            })}

            {gameState.board.map((row, y) =>
              row.map((cell, x) => {
                if (cell === 0) return null;
                
                const cx = toSvgX(x);
                const cy = toSvgY(y);
                const isSelected = gameState.selectedPiece?.x === x && gameState.selectedPiece?.y === y;
                
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
                  <g key={`piece-${x}-${y}`} onClick={() => handleCellClick(x, y)} className="cursor-pointer">
                    {isSelected && <circle cx={cx} cy={cy} r={CELL_SIZE / 2 - 2} fill="none" stroke="rgba(96, 165, 250, 0.9)" strokeWidth="3" />}
                    <circle cx={cx} cy={cy + 2} r={CELL_SIZE / 2 - 5} fill="rgba(0,0,0,0.3)" />
                    <circle cx={cx} cy={cy} r={CELL_SIZE / 2 - 5} fill={fill} stroke={isSelected ? '#60a5fa' : stroke} strokeWidth={isSelected ? 3 : 2} />
                    <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize="16">{symbol}</text>
                  </g>
                );
              })
            )}

            {gameState.board.map((row, y) =>
              row.map((_, x) => (
                <rect key={`click-${x}-${y}`} x={toSvgX(x) - CELL_SIZE / 2} y={toSvgY(y) - CELL_SIZE / 2} width={CELL_SIZE} height={CELL_SIZE} fill="transparent" onClick={() => handleCellClick(x, y)} className="cursor-pointer" />
              ))
            )}
          </svg>
        </div>

        <div className="flex gap-2">
          <button onClick={resetGame} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium py-2 px-4 rounded-lg">
            🔄 リセット
          </button>
          <button onClick={() => setGameStarted(false)} className="bg-white/10 text-purple-200 font-medium py-2 px-4 rounded-lg border border-white/10">
            ⚙️ 設定
          </button>
        </div>
      </main>

      {gameState.winner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-white/20">
            <div className="text-8xl mb-4">{gameState.winner === playerSide ? '🏆' : '💀'}</div>
            <h2 className="text-4xl font-bold text-white mb-3">{gameState.winner === playerSide ? '勝利！' : '敗北...'}</h2>
            <p className="text-purple-200 text-lg mb-6">
              {gameState.winner === 'attacker' ? '攻撃側が王を捕獲しました！' : '防御側の王が脱出しました！'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={resetGame} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl">
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
