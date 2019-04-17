import { NativeModules, findNodeHandle, Dimensions } from 'react-native'

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

export function isTablet() {
  return Dimensions.get('window').height / Dimensions.get('window').width < 1.6;
}

export function isRect(rect) {
  return rect && (rect.x || rect.x === 0) && (rect.y || rect.y === 0) && (rect.width || rect.width === 0) && (rect.height || rect.height === 0);
}

export function isPoint(point) {
  return point && (point.x || point.x === 0) && !isNaN(point.x) && (point.y || point.y === 0) && !isNaN(point.y);
}

export function getRectForRef(ref, callback) {
  NativeModules.UIManager.measure(findNodeHandle(ref), (x0, y0, width, height, x, y) => {
    callback(new Rect(x, y, width, height));
  })
}

export function runAfterChange(getFirst, second, func) {
  let count = 0; // Failsafe so that the interval doesn't run forever
  let checkFunc = () => 
    getFirst(first => {
      if (first !== second) {
        func();
      } else if (count < 20) {
        count++;
        setTimeout(checkFunc, 100);
      }
    });

  checkFunc();
}

export function waitForNewRect(ref, initialRect, onFinish) {
  runAfterChange(callback => {
    getRectForRef(ref, callback);
  }, initialRect, () => {
    getRectForRef(ref, onFinish);
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
