// ハプティックフィードバック（振動）マネージャー
export const hapticManager = {
  // 軽い振動（タップ）
  light() {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  // 中程度の振動（選択）
  medium() {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },

  // 強い振動（成功）
  heavy() {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 50, 30]);
    }
  },

  // 連続振動（エラー）
  error() {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50, 30, 50]);
    }
  },

  // 成功パターン
  success() {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 100, 20, 100, 20]);
    }
  },
};
