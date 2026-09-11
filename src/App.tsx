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

interface GameHistory {
  state: GameState;
  action: string;
}

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<'black' | 'white'>('black');
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');
  const [millAnimation, setMillAnimation] = useState<number[] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setAiThinking(false);
    setGameStarted(true);
    setHistory([]);
    setLastAction('');
    setMillAnimation(null);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      soundManager.setEnabled(!prev);
      return !prev;
    });
  }, []);

  // Scroll history to bottom
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

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
            setHistory(h => [...h, { state: newState, action: 'AIが駒を取りました' }]);
            return newState;
          }
          return { ...prev, removingPiece: false, currentPlayer: 1, message: 'あなたの番です' };
        });
      }, 400);
      return () => clearTimeout(timer);
    }
    
    setAiThinking(true);
    
    const timer = setTimeout(() => {
      const aiMove: AIMove | null = getAIMove(gameState, difficulty);
      
      if (!aiMove) {
        setGameState(prev => ({
          ...prev,
          winner: 1,
          message: 'あなたの勝利！AIが動けません',
        }));
        setAiThinking(false);
        return;
      }
      
      setGameState(prev => {
        let newState = { ...prev };
        let actionText = '';
        
        if (newState.phase === 'placing') {
          newState = placePiece(newState, aiMove.to);
          actionText = `AIが駒を配置 (${aiMove.to})`;
        } else {
          if (aiMove.from !== undefined) {
            newState = selectPiece(newState, aiMove.from);
            newState = movePiece(newState, aiMove.from!, aiMove.to);
            actionText = `AIが駒を移動 (${aiMove.from}→${aiMove.to})`;
          }
        }
        
        // Check for mill formation
        if (newState.removingPiece && newState.currentPlayer === 2) {
          setMillAnimation([aiMove.to]);
          setTimeout(() => setMillAnimation(null), 1500);
          
          if (aiMove.removal !== undefined && aiMove.removal >= 0) {
            newState = removePiece(newState, aiMove.removal);
            actionText += ' + ミル成立！';
          } else {
            const removable = getRemovablePieces(newState.board, 1);
            if (removable.length > 0) {
              newState = removePiece(newState, removable[0]);
              actionText += ' + ミル成立！';
            } else {
              newState = { ...newState, removingPiece: false };
            }
          }
        }
        
        setHistory(h => [...h, { state: newState, action: actionText }]);
        setLastAction(actionText);
        
        return newState;
      });
      
      setAiThinking(false);
    }, 800);
    
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.winner, gameState.removingPiece, gameStarted, difficulty]);

  const handlePositionClick = useCallback((pos: number) => {
    if (!gameStarted) return;
    if (gameState.winner) return;
    if (gameState.currentPlayer !== 1) return;
    if (aiThinking) return;
    
    let actionText = '';
    
    // Removing phase
    if (gameState.removingPiece) {
      const removable = getRemovablePieces(gameState.board, 2);
      if (removable.includes(pos)) {
        const newState = removePiece(gameState, pos);
        soundManager.playRemove();
        setHistory(h => [...h, { state: newState, action: '駒を取りました' }]);
        setLastAction('駒を取りました');
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
        actionText = `駒を配置 (${pos})`;
        
        // Check for mill
        if (newState.removingPiece) {
          setMillAnimation([pos]);
          setTimeout(() => setMillAnimation(null), 1500);
          soundManager.playMill();
          actionText += ' + ミル成立！';
        }
        
        setHistory(h => [...h, { state: newState, action: actionText }]);
        setLastAction(actionText);
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
          actionText = `駒を移動 (${gameState.selectedPiece}→${pos})`;
          
          if (newState.removingPiece) {
            setMillAnimation([pos]);
            setTimeout(() => setMillAnimation(null), 1500);
            soundManager.playMill();
            actionText += ' + ミル成立！';
          }
          
          setHistory(h => [...h, { state: newState, action: actionText }]);
          setLastAction(actionText);
          setGameState(newState);
        } else {
          soundManager.playInvalid();
        }
      }
    }
  }, [gameState, aiThinking, gameStarted]);

  const handleUndo = useCallback(() => {
    if (history.length < 2) return; // Need at least 2 moves (player + AI)
    
    // Go back 2 steps (undo AI move and player move)
    const targetIndex = Math.max(0, history.length - 2);
    const targetState = history[targetIndex];
    
    setGameState(targetState.state);
    setHistory(h => h.slice(0, targetIndex));
    setLastAction('手を戻しました');
  }, [history]);

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
  
  const millPositions = new Set<number>();
  if (millAnimation) {
    millAnimation.forEach(p => millPositions.add(p));
  }

  const playerPieceColor = playerColor === 'black' ? '#2d2d44' : '#f5f5f5';
  const aiPieceColor = playerColor === 'black' ? '#f5f5f5' : '#2d2d44';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 flex flex-col items-center py-4 px-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Header */}
      <div className="text-center mb-4 relative z-10 flex items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-amber-900 mb-2 drop-shadow-lg">
            🎲 モラバラバ
          </h1>
          <p className="text-amber-700 text-sm md:text-base font-medium">Morabaraba - AI対戦ボードゲーム</p>
        </div>
        {gameStarted && (
          <button
            onClick={toggleSound}
            className="bg-white/80 hover:bg-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:scale-110 border-2 border-amber-200"
            title={soundEnabled ? 'サウンドをオフ' : 'サウンドをオン'}
          >
            <span className="text-2xl">{soundEnabled ? '🔊' : '🔇'}</span>
          </button>
        )}
      </div>

      {!gameStarted ? (
        /* Start Screen */
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative z-10 border-2 border-amber-200">
          <h2 className="text-3xl font-bold text-amber-900 mb-6">ゲーム設定</h2>
          
          <div className="mb-6">
            <label className="block text-amber-800 font-medium mb-3 text-lg">あなたの駒の色</label>
            <div className="flex gap-6 justify-center">
              <button
                onClick={() => setPlayerColor('black')}
                className={`w-20 h-20 rounded-full border-4 transition-all transform hover:scale-110 ${
                  playerColor === 'black' 
                    ? 'border-amber-500 shadow-xl scale-110' 
                    : 'border-gray-300 opacity-60'
                }`}
                style={{ backgroundColor: '#2d2d44' }}
              />
              <button
                onClick={() => setPlayerColor('white')}
                className={`w-20 h-20 rounded-full border-4 transition-all transform hover:scale-110 ${
                  playerColor === 'white' 
                    ? 'border-amber-500 shadow-xl scale-110' 
                    : 'border-gray-300 opacity-60'
                }`}
                style={{ backgroundColor: '#f5f5f5' }}
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
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg scale-105'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {d === 'easy' ? '🌱 簡単' : d === 'normal' ? '🌿 普通' : '🌳 難しい'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 mb-6 text-left text-sm text-amber-800 border border-amber-200">
            <h3 className="font-bold mb-3 text-lg flex items-center gap-2">
              <span>📖</span> ルール
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>各プレイヤー12個の駒を持ちます</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>配置フェーズ：</strong>交互に駒を空いている交点に配置</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>移動フェーズ：</strong>駒を隣接する空いている点に移動</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>フライトフェーズ：</strong>駒が3個になったらどこにでも移動可能</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>3つ並べると「ミル」成立 → 相手の駒を1つ取れる</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>相手の駒が2個以下、または動けなくなったら勝ち</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => setShowTutorial(true)}
            className="mb-4 text-amber-600 hover:text-amber-800 font-medium text-sm underline"
          >
            詳しい遊び方を見る
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
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start w-full max-w-7xl relative z-10">
          {/* Left Panel - Game Info */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-5 w-full lg:w-72 order-2 lg:order-1 border-2 border-amber-200">
            <div className="space-y-4">
              {/* Status */}
              <div className="text-center">
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold shadow-md ${
                  gameState.winner 
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' 
                    : gameState.currentPlayer === 1 
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white'
                      : 'bg-gradient-to-r from-red-400 to-pink-500 text-white'
                }`}>
                  {gameState.winner 
                    ? `🏆 ${gameState.winner === 1 ? 'あなたの勝利！' : 'AIの勝利...'}`
                    : aiThinking 
                      ? '🤔 AI思考中...'
                      : gameState.message
                  }
                </div>
              </div>

              {/* Player Info */}
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border-2 transition-all ${
                  gameState.currentPlayer === 1 && !gameState.winner 
                    ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-md' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-8 h-8 rounded-full border-3 border-gray-400 shadow-md" 
                      style={{ backgroundColor: playerPieceColor }} 
                    />
                    <div>
                      <div className="font-bold text-sm">あなた</div>
                      <div className="text-xs text-gray-600">プレイヤー</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-600">配置残り</div>
                      <div className="font-bold text-lg">{gameState.piecesToPlace[0]}</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-600">盤上</div>
                      <div className="font-bold text-lg">{gameState.piecesOnBoard[0]}</div>
                    </div>
                  </div>
                </div>
                
                <div className={`p-3 rounded-xl border-2 transition-all ${
                  gameState.currentPlayer === 2 && !gameState.winner 
                    ? 'border-red-400 bg-gradient-to-r from-red-50 to-pink-50 shadow-md' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-8 h-8 rounded-full border-3 border-gray-400 shadow-md" 
                      style={{ backgroundColor: aiPieceColor }} 
                    />
                    <div>
                      <div className="font-bold text-sm">AI</div>
                      <div className="text-xs text-gray-600">
                        {difficulty === 'easy' ? '🌱 簡単' : difficulty === 'normal' ? '🌿 普通' : '🌳 難しい'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-600">配置残り</div>
                      <div className="font-bold text-lg">{gameState.piecesToPlace[1]}</div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2">
                      <div className="text-gray-600">盤上</div>
                      <div className="font-bold text-lg">{gameState.piecesOnBoard[1]}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase indicator */}
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-3 text-center border border-amber-200">
                <div className="text-xs text-amber-700 font-medium mb-1">現在のフェーズ</div>
                <div className="text-lg font-bold text-amber-900">
                  {gameState.phase === 'placing' ? '📍 配置' :
                   gameState.removingPiece ? '🎯 駒を取る' :
                   isFlying(gameState.board, gameState.currentPlayer) ? '🦅 フライト' :
                   '🔄 移動'}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleUndo}
                  disabled={history.length < 2 || gameState.currentPlayer !== 1}
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-all text-sm shadow-md disabled:cursor-not-allowed"
                >
                  ↩️ 元に戻す
                </button>
                <button
                  onClick={resetGame}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-all text-sm shadow-md"
                >
                  🔄 新しいゲーム
                </button>
                <button
                  onClick={() => setGameStarted(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-all text-sm"
                >
                  ⚙️ 設定
                </button>
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-2xl p-4 md:p-6 order-1 lg:order-2 border-4 border-amber-300 flex-shrink-0 w-full max-w-[500px] mx-auto">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-full h-auto max-w-[500px]"
              role="img"
              aria-label="モラバラバゲーム盤面"
            >
              {/* Board background with wood texture */}
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
              
              {/* Board lines */}
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

              {/* Position markers and pieces */}
              {POS_COORDS.map((coord, pos) => {
                const cx = toSvgX(coord.x);
                const cy = toSvgY(coord.y);
                const isHighlighted = highlighted.has(pos);
                const isInMillHighlight = millPositions.has(pos);
                const isSelected = gameState.selectedPiece === pos;
                const cellState = gameState.board[pos];
                
                return (
                  <g key={pos} onClick={() => handlePositionClick(pos)} className="cursor-pointer">
                    {/* Highlight circle for valid moves */}
                    {isHighlighted && cellState === 0 && (
                      <>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={22}
                          fill="rgba(34, 197, 94, 0.2)"
                          stroke="rgba(34, 197, 94, 0.8)"
                          strokeWidth="3"
                          className="animate-pulse"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={12}
                          fill="rgba(34, 197, 94, 0.6)"
                        />
                      </>
                    )}
                    
                    {/* Removable highlight */}
                    {isHighlighted && cellState === 2 && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={26}
                        fill="none"
                        stroke="rgba(239, 68, 68, 0.9)"
                        strokeWidth="4"
                        strokeDasharray="6,4"
                        className="animate-pulse"
                      />
                    )}

                    {/* Mill highlight */}
                    {isInMillHighlight && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={28}
                        fill="rgba(234, 179, 8, 0.3)"
                        stroke="rgba(234, 179, 8, 1)"
                        strokeWidth="4"
                        className="animate-bounce-in"
                      />
                    )}

                    {/* Selected highlight */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={26}
                        fill="none"
                        stroke="rgba(59, 130, 246, 1)"
                        strokeWidth="4"
                        className="animate-pulse"
                      />
                    )}

                    {/* Empty position marker */}
                    {cellState === 0 && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill="#5d4037"
                        opacity={0.5}
                      />
                    )}

                    {/* Player 1 piece */}
                    {cellState === 1 && (
                      <g filter="url(#shadow)">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={20}
                          fill={playerPieceColor}
                          stroke={isSelected ? '#3b82f6' : '#1a1a1a'}
                          strokeWidth={isSelected ? 4 : 2}
                        />
                        <circle
                          cx={cx - 5}
                          cy={cy - 5}
                          r={6}
                          fill="rgba(255,255,255,0.4)"
                        />
                        <circle
                          cx={cx + 3}
                          cy={cy + 3}
                          r={3}
                          fill="rgba(0,0,0,0.2)"
                        />
                      </g>
                    )}

                    {/* Player 2 (AI) piece */}
                    {cellState === 2 && (
                      <g filter="url(#shadow)">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={20}
                          fill={aiPieceColor}
                          stroke={isHighlighted ? '#ef4444' : '#1a1a1a'}
                          strokeWidth={isHighlighted ? 4 : 2}
                        />
                        <circle
                          cx={cx - 5}
                          cy={cy - 5}
                          r={6}
                          fill="rgba(255,255,255,0.4)"
                        />
                        <circle
                          cx={cx + 3}
                          cy={cy + 3}
                          r={3}
                          fill="rgba(0,0,0,0.2)"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Panel - History & Tips */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-5 w-full lg:w-72 order-3 border-2 border-amber-200">
            <div className="space-y-4">
              {/* Last action */}
              {lastAction && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                  <div className="text-xs text-green-700 font-medium mb-1">最後の行動</div>
                  <div className="text-sm font-bold text-green-900">{lastAction}</div>
                </div>
              )}

              {/* Game History */}
              <div>
                <h3 className="font-bold text-amber-900 mb-2 text-sm flex items-center gap-2">
                  <span>📜</span> ゲーム履歴
                </h3>
                <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto border border-gray-200">
                  {history.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-4">まだ手がありません</div>
                  ) : (
                    <div className="space-y-1">
                      {history.slice(-10).map((h, idx) => (
                        <div key={idx} className="text-xs text-gray-700 flex items-start gap-2">
                          <span className="text-amber-600 font-bold">{history.length - 10 + idx + 1}.</span>
                          <span>{h.action}</span>
                        </div>
                      ))}
                      <div ref={historyEndRef} />
                    </div>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div>
                <h3 className="font-bold text-amber-900 mb-2 text-sm flex items-center gap-2">
                  <span>💡</span> ヒント
                </h3>
                <div className="text-xs text-amber-800 space-y-2 bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <p>• <span className="text-green-600 font-bold">緑</span>：配置/移動可能な場所</p>
                  <p>• <span className="text-red-600 font-bold">赤破線</span>：取れる相手の駒</p>
                  <p>• <span className="text-yellow-600 font-bold">黄色</span>：ミル成立エフェクト</p>
                  <p>• <span className="text-blue-600 font-bold">青</span>：選択中の駒</p>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2 text-sm flex items-center gap-2">
                  <span>📊</span> 統計
                </h3>
                <div className="text-xs text-purple-800 space-y-1">
                  <div className="flex justify-between">
                    <span>総手数:</span>
                    <span className="font-bold">{history.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>あなたのミル:</span>
                    <span className="font-bold">
                      {MILLS.filter(m => m.every(p => gameState.board[p] === 1)).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>AIのミル:</span>
                    <span className="font-bold">
                      {MILLS.filter(m => m.every(p => gameState.board[p] === 2)).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Winner sound effect */}
      {gameState.winner && (() => {
        if (gameState.winner === 1) soundManager.playWin();
        else soundManager.playLose();
        return null;
      })()}

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
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-6 border border-amber-200">
              <div className="text-sm text-amber-800 space-y-1">
                <div>総手数: <strong>{history.length}</strong></div>
                <div>あなたのミル: <strong>{MILLS.filter(m => m.every(p => gameState.board[p] === 1)).length}</strong></div>
                <div>AIのミル: <strong>{MILLS.filter(m => m.every(p => gameState.board[p] === 2)).length}</strong></div>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetGame}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                🔄 もう一度プレイ
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
              <h2 className="text-3xl font-bold text-amber-900">📖 詳しい遊び方</h2>
              <button
                onClick={() => setShowTutorial(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6 text-amber-800">
              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="bg-amber-200 rounded-full w-8 h-8 flex items-center justify-center">1</span>
                  ゲームの目的
                </h3>
                <p className="ml-10">相手の駒を2個以下にする、または相手が動けなくする</p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="bg-amber-200 rounded-full w-8 h-8 flex items-center justify-center">2</span>
                  配置フェーズ
                </h3>
                <p className="ml-10">
                  各プレイヤー12個の駒を持ち、交互に空いている交点に配置します。
                  緑のハイライトが配置可能な場所です。
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="bg-amber-200 rounded-full w-8 h-8 flex items-center justify-center">3</span>
                  移動フェーズ
                </h3>
                <p className="ml-10">
                  両プレイヤーが全ての駒を配置したら、移動フェーズに移行します。
                  駒をクリックして選択し、隣接する空いている点に移動させます。
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="bg-amber-200 rounded-full w-8 h-8 flex items-center justify-center">4</span>
                  フライトフェーズ
                </h3>
                <p className="ml-10">
                  自分の駒が3個だけになったら、フライトフェーズに入ります。
                  この状態では、どこでも空いている点に移動できます。
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="bg-amber-200 rounded-full w-8 h-8 flex items-center justify-center">5</span>
                  ミル（3つ並べ）
                </h3>
                <p className="ml-10 mb-2">
                  自分の駒を直線上に3つ並べると「ミル」が成立します。
                  ミルが成立すると、相手の駒を1つ取ることができます。
                </p>
                <div className="ml-10 bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-sm">
                    <strong>注意：</strong>ミルに含まれている駒は取れません。
                    ただし、相手の全ての駒がミルに含まれている場合は例外です。
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="bg-amber-200 rounded-full w-8 h-8 flex items-center justify-center">6</span>
                  戦略のコツ
                </h3>
                <ul className="ml-10 space-y-1 text-sm">
                  <li>• 中心付近の位置は価値が高い</li>
                  <li>• 複数のミルを同時に狙える配置が強い</li>
                  <li>• 相手の移動を制限する配置が効果的</li>
                  <li>• フライトフェーズに入ると一気に有利になる</li>
                </ul>
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
