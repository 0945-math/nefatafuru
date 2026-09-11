import { useState, useCallback, useEffect } from 'react';
import {
  GameState, createInitialState,
  POS_COORDS, MILLS,
  placePiece, removePiece, selectPiece, movePiece,
  getValidPlacements, getValidTargets, getRemovablePieces,
  isFlying,
} from './gameLogic';
import { getAIMove, AIMove } from './ai';

// Board lines (connections between positions)
const BOARD_LINES: [number, number][] = [
  // Outer square
  [0, 1], [1, 2], [2, 14], [14, 23], [23, 22], [22, 21], [21, 9], [9, 0],
  // Middle square
  [3, 4], [4, 5], [5, 13], [13, 20], [20, 19], [19, 18], [18, 10], [10, 3],
  // Inner square
  [6, 7], [7, 8], [8, 12], [12, 17], [17, 16], [16, 15], [15, 11], [11, 6],
  // Cross lines
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

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<'black' | 'white'>('black');

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setAiThinking(false);
    setGameStarted(true);
  }, []);

  // AI move execution
  useEffect(() => {
    if (!gameStarted) return;
    if (gameState.currentPlayer !== 2 || gameState.winner) return;
    if (gameState.removingPiece) {
      // Safety: if AI is supposed to remove but state is stuck, force skip
      const timer = setTimeout(() => {
        setGameState(prev => {
          if (!prev.removingPiece || prev.currentPlayer !== 2) return prev;
          // Find any removable piece
          const removable = getRemovablePieces(prev.board, 1);
          if (removable.length > 0) {
            return removePiece(prev, removable[0]);
          }
          // If no removable pieces, skip removal
          return { ...prev, removingPiece: false, currentPlayer: 1, message: 'プレイヤー1の番です' };
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    setAiThinking(true);
    
    const timer = setTimeout(() => {
      const aiMove: AIMove | null = getAIMove(gameState, difficulty);
      
      if (!aiMove) {
        // AI can't move - player wins
        setGameState(prev => ({
          ...prev,
          winner: 1,
          message: 'プレイヤー1の勝利！（AIが動けません）',
        }));
        setAiThinking(false);
        return;
      }
      
      setGameState(prev => {
        let newState = { ...prev };
        
        if (newState.phase === 'placing') {
          newState = placePiece(newState, aiMove.to);
        } else {
          if (aiMove.from !== undefined) {
            newState = selectPiece(newState, aiMove.from);
            newState = movePiece(newState, aiMove.from!, aiMove.to);
          }
        }
        
        // Handle AI removal
        if (newState.removingPiece && newState.currentPlayer === 2) {
          if (aiMove.removal !== undefined && aiMove.removal >= 0) {
            newState = removePiece(newState, aiMove.removal);
          } else {
            // Fallback: find any removable piece
            const removable = getRemovablePieces(newState.board, 1);
            if (removable.length > 0) {
              newState = removePiece(newState, removable[0]);
            } else {
              newState = { ...newState, removingPiece: false };
            }
          }
        }
        
        return newState;
      });
      
      setAiThinking(false);
    }, 600);
    
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
        setGameState(prev => removePiece(prev, pos));
      }
      return;
    }
    
    // Placing phase
    if (gameState.phase === 'placing') {
      const validPlacements = getValidPlacements(gameState.board);
      if (validPlacements.includes(pos)) {
        setGameState(prev => placePiece(prev, pos));
      }
      return;
    }
    
    // Moving phase
    if (gameState.phase === 'moving') {
      // If clicking own piece, select it
      if (gameState.board[pos] === 1) {
        setGameState(prev => selectPiece(prev, pos));
        return;
      }
      
      // If a piece is selected and clicking empty position
      if (gameState.selectedPiece !== null && gameState.board[pos] === 0) {
        const validTargets = getValidTargets(gameState.board, gameState.selectedPiece, 1);
        if (validTargets.includes(pos)) {
          setGameState(prev => movePiece(prev, gameState.selectedPiece!, pos));
        }
      }
    }
  }, [gameState, aiThinking, gameStarted]);

  // Calculate highlighted positions
  const getHighlightedPositions = (): Set<number> => {
    const highlighted = new Set<number>();
    
    if (gameState.currentPlayer !== 1 || aiThinking || gameState.winner) return highlighted;
    
    if (gameState.removingPiece) {
      const removable = getRemovablePieces(gameState.board, 2);
      removable.forEach(p => highlighted.add(p));
    } else if (gameState.phase === 'placing') {
      getValidPlacements(gameState.board).forEach(p => highlighted.add(p));
    } else if (gameState.phase === 'moving' && gameState.selectedPiece !== null) {
      getValidTargets(gameState.board, gameState.selectedPiece, 1).forEach(p => highlighted.add(p));
    }
    
    return highlighted;
  };

  const highlighted = getHighlightedPositions();
  
  // Mill positions for highlighting
  const millPositions = new Set<number>();
  if (gameState.lastMill) {
    gameState.lastMill.forEach(p => millPositions.add(p));
  }

  const playerPieceColor = playerColor === 'black' ? '#1a1a2e' : '#f0f0f0';
  const aiPieceColor = playerColor === 'black' ? '#f0f0f0' : '#1a1a2e';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col items-center py-4 px-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-1">
          🎲 モラバラバ
        </h1>
        <p className="text-amber-700 text-sm md:text-base">Morabaraba - AI対戦ボードゲーム</p>
      </div>

      {!gameStarted ? (
        /* Start Screen */
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-amber-900 mb-6">ゲーム設定</h2>
          
          <div className="mb-6">
            <label className="block text-amber-800 font-medium mb-2">あなたの駒の色</label>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setPlayerColor('black')}
                className={`w-16 h-16 rounded-full border-4 transition-all ${
                  playerColor === 'black' 
                    ? 'border-amber-500 shadow-lg scale-110' 
                    : 'border-gray-300'
                }`}
                style={{ backgroundColor: '#1a1a2e' }}
              />
              <button
                onClick={() => setPlayerColor('white')}
                className={`w-16 h-16 rounded-full border-4 transition-all ${
                  playerColor === 'white' 
                    ? 'border-amber-500 shadow-lg scale-110' 
                    : 'border-gray-300'
                }`}
                style={{ backgroundColor: '#f0f0f0' }}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-amber-800 font-medium mb-2">難易度</label>
            <div className="flex gap-3 justify-center">
              {(['easy', 'normal', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    difficulty === d
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {d === 'easy' ? '簡単' : d === 'normal' ? '普通' : '難しい'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
            <h3 className="font-bold mb-2">📖 ルール</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>各プレイヤー12個の駒を持ちます</li>
              <li><strong>配置フェーズ：</strong>交互に駒を空いている交点に配置</li>
              <li><strong>移動フェーズ：</strong>駒を隣接する空いている点に移動</li>
              <li><strong>フライトフェーズ：</strong>駒が3個になったらどこにでも移動可能</li>
              <li>3つ並べると「ミル」成立 → 相手の駒を1つ取れる</li>
              <li>相手の駒が2個以下、または動けなくなったら勝ち</li>
            </ul>
          </div>

          <button
            onClick={resetGame}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all hover:scale-105 text-lg"
          >
            ゲーム開始
          </button>
        </div>
      ) : (
        /* Game Screen */
        <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start w-full max-w-5xl">
          {/* Left Panel - Game Info */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 w-full lg:w-64 order-2 lg:order-1">
            <div className="space-y-3">
              {/* Status */}
              <div className="text-center">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  gameState.winner 
                    ? 'bg-green-100 text-green-800' 
                    : gameState.currentPlayer === 1 
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {gameState.winner 
                    ? `🏆 プレイヤー${gameState.winner}の勝利！`
                    : aiThinking 
                      ? '🤔 AI思考中...'
                      : gameState.message
                  }
                </div>
              </div>

              {/* Player Info */}
              <div className="space-y-2">
                <div className={`p-2 rounded-lg border-2 ${
                  gameState.currentPlayer === 1 && !gameState.winner ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-400" style={{ backgroundColor: playerPieceColor }} />
                    <span className="font-medium text-sm">あなた</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    残り配置: {gameState.piecesToPlace[0]} | 盤上: {gameState.piecesOnBoard[0]}
                  </div>
                </div>
                
                <div className={`p-2 rounded-lg border-2 ${
                  gameState.currentPlayer === 2 && !gameState.winner ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-400" style={{ backgroundColor: aiPieceColor }} />
                    <span className="font-medium text-sm">AI ({difficulty === 'easy' ? '簡単' : difficulty === 'normal' ? '普通' : '難しい'})</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    残り配置: {gameState.piecesToPlace[1]} | 盤上: {gameState.piecesOnBoard[1]}
                  </div>
                </div>
              </div>

              {/* Phase indicator */}
              <div className="text-center text-sm">
                <span className="text-amber-700 font-medium">
                  フェーズ: {
                    gameState.phase === 'placing' ? '📍 配置' :
                    gameState.removingPiece ? '🎯 駒を取る' :
                    isFlying(gameState.board, gameState.currentPlayer) ? '🦅 フライト' :
                    '🔄 移動'
                  }
                </span>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={resetGame}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-all text-sm"
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 order-1 lg:order-2">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-[340px] h-[340px] md:w-[450px] md:h-[450px] lg:w-[500px] lg:h-[500px]"
            >
              {/* Board background */}
              <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} fill="#f5e6c8" rx="10" />
              
              {/* Board lines */}
              {BOARD_LINES.map(([from, to], idx) => (
                <line
                  key={idx}
                  x1={toSvgX(POS_COORDS[from].x)}
                  y1={toSvgY(POS_COORDS[from].y)}
                  x2={toSvgX(POS_COORDS[to].x)}
                  y2={toSvgY(POS_COORDS[to].y)}
                  stroke="#8B4513"
                  strokeWidth="3"
                  strokeLinecap="round"
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
                    {/* Highlight circle */}
                    {isHighlighted && cellState === 0 && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={20}
                        fill="rgba(34, 197, 94, 0.3)"
                        stroke="rgba(34, 197, 94, 0.8)"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                    )}
                    
                    {/* Removable highlight */}
                    {isHighlighted && cellState === 2 && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={24}
                        fill="none"
                        stroke="rgba(239, 68, 68, 0.8)"
                        strokeWidth="3"
                        strokeDasharray="5,3"
                        className="animate-pulse"
                      />
                    )}

                    {/* Mill highlight */}
                    {isInMillHighlight && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={24}
                        fill="none"
                        stroke="rgba(234, 179, 8, 0.8)"
                        strokeWidth="3"
                      />
                    )}

                    {/* Selected highlight */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={24}
                        fill="none"
                        stroke="rgba(59, 130, 246, 0.9)"
                        strokeWidth="3"
                      />
                    )}

                    {/* Empty position marker */}
                    {cellState === 0 && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill="#8B4513"
                        opacity={0.4}
                      />
                    )}

                    {/* Player 1 piece */}
                    {cellState === 1 && (
                      <>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={18}
                          fill={playerPieceColor}
                          stroke={isSelected ? '#3b82f6' : '#333'}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        <circle
                          cx={cx - 4}
                          cy={cy - 4}
                          r={5}
                          fill="rgba(255,255,255,0.3)"
                        />
                      </>
                    )}

                    {/* Player 2 (AI) piece */}
                    {cellState === 2 && (
                      <>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={18}
                          fill={aiPieceColor}
                          stroke={isHighlighted ? '#ef4444' : '#333'}
                          strokeWidth={isHighlighted ? 3 : 2}
                        />
                        <circle
                          cx={cx - 4}
                          cy={cy - 4}
                          r={5}
                          fill="rgba(255,255,255,0.3)"
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Panel - Help */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 w-full lg:w-64 order-3">
            <h3 className="font-bold text-amber-900 mb-2 text-sm">💡 ヒント</h3>
            <div className="text-xs text-amber-800 space-y-2">
              <p>• 緑のハイライト：配置/移動可能な場所</p>
              <p>• 赤の破線：取れる相手の駒</p>
              <p>• 黄色の輪：ミルを構成する駒</p>
              <p>• 青い輪：選択中の駒</p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-amber-200">
              <h3 className="font-bold text-amber-900 mb-2 text-sm">📊 ゲーム統計</h3>
              <div className="text-xs text-amber-700 space-y-1">
                <p>あなたの駒: {gameState.piecesOnBoard[0]}個 (配置残り: {gameState.piecesToPlace[0]})</p>
                <p>AIの駒: {gameState.piecesOnBoard[1]}個 (配置残り: {gameState.piecesToPlace[1]})</p>
                <p>合計ミル数: {MILLS.filter(m => m.every(p => gameState.board[p] === 1)).length + MILLS.filter(m => m.every(p => gameState.board[p] === 2)).length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-5xl mb-4">
              {gameState.winner === 1 ? '🎉' : '😔'}
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">
              {gameState.winner === 1 ? 'おめでとうございます！' : 'AIの勝利...'}
            </h2>
            <p className="text-amber-700 mb-6">
              {gameState.winner === 1 
                ? 'あなたがモラバラバを制しました！' 
                : '今度は勝てるよう頑張ろう！'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetGame}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded-lg transition-all"
              >
                もう一度プレイ
              </button>
              <button
                onClick={() => setGameStarted(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-6 rounded-lg transition-all"
              >
                設定に戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
