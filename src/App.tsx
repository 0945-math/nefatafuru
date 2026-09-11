import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GameState, createInitialState,
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
const PADDING = 40;
const SCALE = (SVG_SIZE - PADDING * 2) / 6;

function toSvgX(gridX: number): number {
  return PADDING + gridX * SCALE;
}

function toSvgY(gridY: number): number {
  return PADDING + gridY * SCALE;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<'black' | 'white'>('black');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [aiThinkingText, setAiThinkingText] = useState('');
  const particleIdRef = useRef(0);

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setAiThinking(false);
    setGameStarted(true);
    setAiThinkingText('');
    setParticles([]);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      soundManager.setEnabled(!prev);
      return !prev;
    });
  }, []);

  // Particle animation
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.5,
            life: p.life - 1,
          }))
          .filter(p => p.life > 0)
      );
    }, 50);

    return () => clearInterval(interval);
  }, [particles.length]);

  const createParticles = useCallback((x: number, y: number, color: string, count: number = 20) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 5,
        life: 30 + Math.random() * 20,
        color,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

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
            const newState = removePiece(prev, removable[0]);
            soundManager.playRemove();
            return newState;
          }
          return { ...prev, removingPiece: false, currentPlayer: 1, message: 'あなたの番です' };
        });
      }, 500);
      return () => clearTimeout(timer);
    }
    
    setAiThinking(true);
    setAiThinkingText('思考中...');
    
    const timer = setTimeout(() => {
      setAiThinkingText('最善手を計算中...');
      
      const aiMove: AIMove | null = getAIMove(gameState, difficulty);
      
      if (!aiMove) {
        setGameState(prev => ({
          ...prev,
          winner: 1,
          message: 'あなたの勝利！AIが動けません',
        }));
        setAiThinking(false);
        setAiThinkingText('');
        return;
      }
      
      setAiThinkingText(aiMove.thinking || '手を決定');
      
      setTimeout(() => {
        setGameState(prev => {
          let newState = { ...prev };
          
          if (newState.phase === 'placing') {
            newState = placePiece(newState, aiMove.to);
            soundManager.playPlace();
          } else {
            if (aiMove.from !== undefined) {
              newState = selectPiece(newState, aiMove.from);
              newState = movePiece(newState, aiMove.from!, aiMove.to);
              soundManager.playMove();
            }
          }
          
          if (newState.removingPiece && newState.currentPlayer === 2) {
            if (aiMove.removal !== undefined && aiMove.removal >= 0) {
              newState = removePiece(newState, aiMove.removal);
              soundManager.playMill();
              const coord = POS_COORDS[aiMove.to];
              createParticles(toSvgX(coord.x), toSvgY(coord.y), '#fbbf24', 30);
            } else {
              const removable = getRemovablePieces(newState.board, 1);
              if (removable.length > 0) {
                newState = removePiece(newState, removable[0]);
                soundManager.playMill();
                const coord = POS_COORDS[aiMove.to];
                createParticles(toSvgX(coord.x), toSvgY(coord.y), '#fbbf24', 30);
              } else {
                newState = { ...newState, removingPiece: false };
              }
            }
          }
          
          return newState;
        });
        
        setAiThinking(false);
        setAiThinkingText('');
      }, 300);
    }, 400);
    
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.winner, gameState.removingPiece, gameStarted, difficulty]);

  const handlePositionClick = useCallback((pos: number) => {
    if (!gameStarted) return;
    if (gameState.winner) return;
    if (gameState.currentPlayer !== 1) return;
    if (aiThinking) return;
    
    // Removing phase
    if (gameState.removingPiece) {
      const removable = getRemovablePieces(gameState.board, 2);
      if (removable.includes(pos)) {
        const newState = removePiece(gameState, pos);
        soundManager.playRemove();
        const coord = POS_COORDS[pos];
        createParticles(toSvgX(coord.x), toSvgY(coord.y), '#ef4444', 25);
        setGameState(newState);
      } else {
        soundManager.playInvalid();
      }
      return;
    }
    
    // Placing phase
    if (gameState.phase === 'placing') {
      const validPlacements = getValidPlacements(gameState.board);
      if (validPlacements.includes(pos)) {
        const newState = placePiece(gameState, pos);
        soundManager.playPlace();
        const coord = POS_COORDS[pos];
        createParticles(toSvgX(coord.x), toSvgY(coord.y), '#3b82f6', 15);
        
        if (newState.removingPiece) {
          soundManager.playMill();
          createParticles(toSvgX(coord.x), toSvgY(coord.y), '#fbbf24', 30);
        }
        
        setGameState(newState);
      } else {
        soundManager.playInvalid();
      }
      return;
    }
    
    // Moving phase
    if (gameState.phase === 'moving') {
      if (gameState.board[pos] === 1) {
        soundManager.playSelect();
        setGameState(prev => selectPiece(prev, pos));
        return;
      }
      
      if (gameState.selectedPiece !== null && gameState.board[pos] === 0) {
        const validTargets = getValidTargets(gameState.board, gameState.selectedPiece, 1);
        if (validTargets.includes(pos)) {
          const newState = movePiece(gameState, gameState.selectedPiece, pos);
          soundManager.playMove();
          const coord = POS_COORDS[pos];
          createParticles(toSvgX(coord.x), toSvgY(coord.y), '#3b82f6', 15);
          
          if (newState.removingPiece) {
            soundManager.playMill();
            createParticles(toSvgX(coord.x), toSvgY(coord.y), '#fbbf24', 30);
          }
          
          setGameState(newState);
        } else {
          soundManager.playInvalid();
        }
      }
    }
  }, [gameState, aiThinking, gameStarted, createParticles]);

  const getHighlightedPositions = (): Set<number> => {
    const highlighted = new Set<number>();
    
    if (gameState.currentPlayer !== 1 || aiThinking || gameState.winner) return highlighted;
    
    if (gameState.removingPiece) {
      getRemovablePieces(gameState.board, 2).forEach(p => highlighted.add(p));
    } else if (gameState.phase === 'placing') {
      getValidPlacements(gameState.board).forEach(p => highlighted.add(p));
    } else if (gameState.phase === 'moving' && gameState.selectedPiece !== null) {
      getValidTargets(gameState.board, gameState.selectedPiece, 1).forEach(p => highlighted.add(p));
    }
    
    return highlighted;
  };

  const highlighted = getHighlightedPositions();

  const playerPieceColor = playerColor === 'black' ? '#1e293b' : '#f8fafc';
  const aiPieceColor = playerColor === 'black' ? '#f8fafc' : '#1e293b';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 flex flex-col items-center py-6 px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* Particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
        {particles.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={p.color}
            opacity={p.life / 50}
          />
        ))}
      </svg>

      {/* Header */}
      <div className="text-center mb-6 relative z-10">
        <h1 className="text-5xl md:text-6xl font-bold text-amber-900 mb-2 drop-shadow-lg">
          🎲 モラバラバ
        </h1>
        <p className="text-amber-700 text-lg font-medium">Morabaraba - AI対戦ボードゲーム</p>
      </div>

      {!gameStarted ? (
        /* Start Screen */
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-md w-full relative z-10 border-2 border-amber-200 animate-slide-up">
          <h2 className="text-3xl font-bold text-amber-900 mb-6 text-center">ゲーム設定</h2>
          
          <div className="mb-6">
            <label className="block text-amber-800 font-medium mb-3 text-lg">あなたの駒の色</label>
            <div className="flex gap-6 justify-center">
              <button
                onClick={() => setPlayerColor('black')}
                className={`w-24 h-24 rounded-full border-4 transition-all transform hover:scale-110 shadow-lg ${
                  playerColor === 'black' 
                    ? 'border-amber-500 scale-110' 
                    : 'border-gray-300 opacity-60'
                }`}
                style={{ backgroundColor: '#1e293b' }}
              />
              <button
                onClick={() => setPlayerColor('white')}
                className={`w-24 h-24 rounded-full border-4 transition-all transform hover:scale-110 shadow-lg ${
                  playerColor === 'white' 
                    ? 'border-amber-500 scale-110' 
                    : 'border-gray-300 opacity-60'
                }`}
                style={{ backgroundColor: '#f8fafc' }}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-amber-800 font-medium mb-3 text-lg">難易度</label>
            <div className="flex gap-3 justify-center">
              {(['easy', 'normal', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                    difficulty === d
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl scale-105'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {d === 'easy' ? '🌱 簡単' : d === 'normal' ? '🌿 普通' : '🌳 難しい'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowTutorial(true)}
            className="w-full mb-4 text-amber-600 hover:text-amber-800 font-medium text-sm underline"
          >
            📖 ルールを見る
          </button>

          <button
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-4 px-8 rounded-xl shadow-xl transition-all transform hover:scale-105 text-xl"
          >
            🎮 ゲーム開始
          </button>
        </div>
      ) : (
        /* Game Screen */
        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start w-full max-w-7xl relative z-10">
          {/* Left Panel */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 w-full lg:w-80 order-2 lg:order-1 border-2 border-amber-200">
            <div className="space-y-4">
              {/* Status */}
              <div className="text-center">
                <div className={`inline-block px-5 py-3 rounded-full text-sm font-bold shadow-lg ${
                  gameState.winner 
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' 
                    : gameState.currentPlayer === 1 
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white'
                      : 'bg-gradient-to-r from-red-400 to-pink-500 text-white'
                }`}>
                  {gameState.winner 
                    ? `🏆 ${gameState.winner === 1 ? 'あなたの勝利！' : 'AIの勝利...'}`
                    : aiThinking 
                      ? `🤔 ${aiThinkingText}`
                      : gameState.message
                  }
                </div>
              </div>

              {/* Player Info */}
              <div className="space-y-3">
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  gameState.currentPlayer === 1 && !gameState.winner 
                    ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-lg' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-full border-3 border-gray-400 shadow-md" 
                      style={{ backgroundColor: playerPieceColor }} 
                    />
                    <div>
                      <div className="font-bold">あなた</div>
                      <div className="text-xs text-gray-600">プレイヤー</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <div className="text-gray-600 text-xs">配置残り</div>
                      <div className="font-bold text-2xl">{gameState.piecesToPlace[0]}</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <div className="text-gray-600 text-xs">盤上</div>
                      <div className="font-bold text-2xl">{gameState.piecesOnBoard[0]}</div>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  gameState.currentPlayer === 2 && !gameState.winner 
                    ? 'border-red-400 bg-gradient-to-r from-red-50 to-pink-50 shadow-lg' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-full border-3 border-gray-400 shadow-md" 
                      style={{ backgroundColor: aiPieceColor }} 
                    />
                    <div>
                      <div className="font-bold">AI</div>
                      <div className="text-xs text-gray-600">
                        {difficulty === 'easy' ? '🌱 簡単' : difficulty === 'normal' ? '🌿 普通' : '🌳 難しい'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <div className="text-gray-600 text-xs">配置残り</div>
                      <div className="font-bold text-2xl">{gameState.piecesToPlace[1]}</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2 text-center">
                      <div className="text-gray-600 text-xs">盤上</div>
                      <div className="font-bold text-2xl">{gameState.piecesOnBoard[1]}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase */}
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 text-center border border-amber-200">
                <div className="text-xs text-amber-700 font-medium mb-1">現在のフェーズ</div>
                <div className="text-xl font-bold text-amber-900">
                  {gameState.phase === 'placing' ? '📍 配置' :
                   gameState.removingPiece ? '🎯 駒を取る' :
                   isFlying(gameState.board, gameState.currentPlayer) ? '🦅 フライト' :
                   '🔄 移動'}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={resetGame}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-3 px-4 rounded-lg transition-all text-sm shadow-md"
                >
                  🔄 新しいゲーム
                </button>
                <button
                  onClick={() => setGameStarted(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all text-sm"
                >
                  ⚙️ 設定
                </button>
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-2xl p-6 order-1 lg:order-2 border-4 border-amber-300 flex-shrink-0 w-full max-w-[500px] mx-auto">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-full h-auto max-w-[500px]"
              role="img"
              aria-label="モラバラバゲーム盤面"
            >
              <defs>
                <pattern id="wood" patternUnits="userSpaceOnUse" width="100" height="100">
                  <rect width="100" height="100" fill="#d4a574" />
                  <path d="M0,20 Q25,15 50,20 T100,20" stroke="#c89968" strokeWidth="2" fill="none" opacity="0.3" />
                  <path d="M0,40 Q25,35 50,40 T100,40" stroke="#c89968" strokeWidth="2" fill="none" opacity="0.3" />
                  <path d="M0,60 Q25,55 50,60 T100,60" stroke="#c89968" strokeWidth="2" fill="none" opacity="0.3" />
                  <path d="M0,80 Q25,75 50,80 T100,80" stroke="#c89968" strokeWidth="2" fill="none" opacity="0.3" />
                </pattern>
                <filter id="shadow">
                  <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3" />
                </filter>
              </defs>
              
              <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} fill="url(#wood)" rx="15" />
              <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} fill="rgba(139, 69, 19, 0.1)" rx="15" />
              
              {BOARD_LINES.map(([from, to], idx) => (
                <line
                  key={idx}
                  x1={toSvgX(POS_COORDS[from].x)}
                  y1={toSvgY(POS_COORDS[from].y)}
                  x2={toSvgX(POS_COORDS[to].x)}
                  y2={toSvgY(POS_COORDS[to].y)}
                  stroke="#5d4037"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              ))}

              {POS_COORDS.map((coord, pos) => {
                const cx = toSvgX(coord.x);
                const cy = toSvgY(coord.y);
                const isHighlighted = highlighted.has(pos);
                const isSelected = gameState.selectedPiece === pos;
                const cellState = gameState.board[pos];
                
                return (
                  <g key={pos} onClick={() => handlePositionClick(pos)} className="cursor-pointer">
                    {isHighlighted && cellState === 0 && (
                      <>
                        <circle cx={cx} cy={cy} r={22} fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.8)" strokeWidth="3" className="animate-pulse" />
                        <circle cx={cx} cy={cy} r={12} fill="rgba(34, 197, 94, 0.6)" />
                      </>
                    )}
                    
                    {isHighlighted && cellState === 2 && (
                      <circle cx={cx} cy={cy} r={26} fill="none" stroke="rgba(239, 68, 68, 0.9)" strokeWidth="4" strokeDasharray="6,4" className="animate-pulse" />
                    )}

                    {isSelected && (
                      <circle cx={cx} cy={cy} r={26} fill="none" stroke="rgba(59, 130, 246, 1)" strokeWidth="4" className="animate-pulse" />
                    )}

                    {cellState === 0 && (
                      <circle cx={cx} cy={cy} r={10} fill="#5d4037" opacity={0.5} />
                    )}

                    {cellState === 1 && (
                      <g filter="url(#shadow)">
                        <circle cx={cx} cy={cy} r={20} fill={playerPieceColor} stroke={isSelected ? '#3b82f6' : '#1a1a1a'} strokeWidth={isSelected ? 4 : 2} />
                        <circle cx={cx - 5} cy={cy - 5} r={6} fill="rgba(255,255,255,0.4)" />
                      </g>
                    )}

                    {cellState === 2 && (
                      <g filter="url(#shadow)">
                        <circle cx={cx} cy={cy} r={20} fill={aiPieceColor} stroke={isHighlighted ? '#ef4444' : '#1a1a1a'} strokeWidth={isHighlighted ? 4 : 2} />
                        <circle cx={cx - 5} cy={cy - 5} r={6} fill="rgba(255,255,255,0.4)" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Panel */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-6 w-full lg:w-80 order-3 border-2 border-amber-200">
            <div className="space-y-4">
              <button
                onClick={toggleSound}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3 px-4 rounded-lg transition-all shadow-md"
              >
                {soundEnabled ? '🔊 サウンド ON' : '🔇 サウンド OFF'}
              </button>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-3 text-sm flex items-center gap-2">
                  <span>📊</span> 統計
                </h3>
                <div className="text-sm text-purple-800 space-y-2">
                  <div className="flex justify-between">
                    <span>あなたのミル:</span>
                    <span className="font-bold">{MILLS.filter(m => m.every(p => gameState.board[p] === 1)).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AIのミル:</span>
                    <span className="font-bold">{MILLS.filter(m => m.every(p => gameState.board[p] === 2)).length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                <h3 className="font-bold text-amber-900 mb-2 text-sm">💡 ヒント</h3>
                <div className="text-xs text-amber-800 space-y-1">
                  <p>• 緑：配置/移動可能</p>
                  <p>• 赤：取れる駒</p>
                  <p>• 青：選択中</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-amber-300 animate-bounce-in">
            <div className="text-7xl mb-4">
              {gameState.winner === 1 ? '🎉' : '😔'}
            </div>
            <h2 className="text-3xl font-bold text-amber-900 mb-3">
              {gameState.winner === 1 ? 'おめでとうございます！' : 'AIの勝利...'}
            </h2>
            <p className="text-amber-700 mb-6 text-lg">
              {gameState.winner === 1 
                ? 'あなたがモラバラバを制しました！' 
                : '今度は勝てるよう頑張ろう！'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetGame}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                🔄 もう一度
              </button>
              <button
                onClick={() => setGameStarted(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all"
              >
                ⚙️ 設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-amber-900">📖 ルール</h2>
              <button onClick={() => setShowTutorial(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
            </div>
            
            <div className="space-y-4 text-amber-800">
              <div>
                <h3 className="text-xl font-bold mb-2">1. ゲームの目的</h3>
                <p>相手の駒を2個以下にする、または相手が動けなくする</p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">2. 配置フェーズ</h3>
                <p>各プレイヤー12個の駒を交互に配置</p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">3. 移動フェーズ</h3>
                <p>駒を隣接する空いている点に移動</p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">4. フライトフェーズ</h3>
                <p>駒が3個になったらどこにでも移動可能</p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">5. ミル（3つ並べ）</h3>
                <p>3つ並べると相手の駒を1つ取れる</p>
              </div>
            </div>

            <button
              onClick={() => setShowTutorial(false)}
              className="w-full mt-6 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
