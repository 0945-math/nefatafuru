export const hapticManager = {
  light() { if ('vibrate' in navigator) navigator.vibrate(10); },
  medium() { if ('vibrate' in navigator) navigator.vibrate(20); },
  heavy() { if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]); },
  error() { if ('vibrate' in navigator) navigator.vibrate([50, 30, 50, 30, 50]); },
  success() { if ('vibrate' in navigator) navigator.vibrate([20, 100, 20, 100, 20]); },
};