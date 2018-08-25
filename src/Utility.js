import { Platform, Animated, NativeModules, findNodeHandle, Dimensions } from 'react-native'

export function Point(x, y) {
    this.x = x;
    this.y = y;
}

export function Size(width, height) {
    this.width = width;
    this.height = height;
}

export function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

export function isIOS() {
  return Platform.OS === 'ios';
}

export function isTablet() {
  return Dimensions.get('window').height / Dimensions.get('window').width < 1.6;
}

export function isRect(rect) {
  return rect && (rect.x || rect.x === 0) && (rect.y || rect.y === 0) && (rect.width || rect.width === 0) && (rect.height || rect.height === 0);
}

export function isPoint(point) {
  return point && (point.x || point.x === 0) && point.x !== NaN && (point.y || point.y === 0) && point.y !== NaN;
}

export function runAfterChange(getFirst, second, func) {
  let interval = setInterval(() => {
    getFirst(first => {
      if (first !== second) {
        clearInterval(interval);
        func();
      }
    }, 100)
  });
  setTimeout(() => clearInterval(interval), 2000); // Failsafe so that the interval doesn't run forever
}

export function waitForNewRect(ref, initialRect, onFinish, verticalOffset) {
  runAfterChange(callback => {
    NativeModules.UIManager.measure(findNodeHandle(ref), (x0, y0, width, height, x, y) => {
      callback(new Rect(x, y + verticalOffset, width, height));
    })
  }, initialRect, () => {
    NativeModules.UIManager.measure(findNodeHandle(ref), (x0, y0, width, height, x, y) => {
      onFinish(new Rect(x, y + verticalOffset, width, height))
    })
  });
}

export function rectChanged(a, b) {
  if (!isRect(a) || !isRect(b)) return false;
  return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y) || Math.round(a.width) !== Math.round(b.width) || Math.round(a.height) !== Math.round(b.height));
}

export function pointChanged(a, b) {
  if (!isPoint(a) || !isPoint(b)) return false;
  return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y));
}
