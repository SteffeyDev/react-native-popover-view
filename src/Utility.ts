import { NativeModules, findNodeHandle, StyleProp, ViewStyle, StyleSheet } from 'react-native'
import { Placement, DEFAULT_ARROW_SIZE, DEFAULT_BORDER_RADIUS } from './Constants';

export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  static equals(a: Point, b: Point): boolean {
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
  }
}

export class Size {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  static equals(a: Size, b: Size): boolean {
    return (Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height));
  }
}

export class Rect {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  static equals(a: Rect, b: Rect): boolean {
    return (Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height));
  }

  static clone(rect: Rect) {
    return new Rect(rect.x, rect.y, rect.width, rect.height);
  }
}

export function getRectForRef(ref: any): Promise<Rect> {
  return new Promise((resolve, reject) => {
    if (ref.current) {
      NativeModules.UIManager.measure(findNodeHandle(ref.current), (_x: any, _y: any, width: number, height: number, x: number, y: number) => {
        resolve(new Rect(x, y, width, height));
      })
    } else {
      reject();
    }
  });
}

export async function waitForChange(getFirst: () => Promise<Rect>, getSecond: () => Promise<Rect>) {
  let count = 0; // Failsafe so that the interval doesn't run forever
  let first, second;
  do  {
    first = await getFirst();
    second = await getSecond();
    await new Promise(resolve => setTimeout(resolve, 100));
    count++
    if (count++ > 20) {
      throw new Error('waitForChange - Timed out waiting for change (waited 2 seconds)');
    }
  } while (Rect.equals(first, second))
}

export async function waitForNewRect(ref: any, initialRect: Rect): Promise<Rect> {
  await waitForChange(() => getRectForRef(ref), () => Promise.resolve(initialRect))
  return await getRectForRef(ref);
}

export function sizeChanged(a: Size | null, b: Size | null): boolean {
  if (!a || !b) return false;
  return (Math.round(a.width) !== Math.round(b.width) || Math.round(a.height) !== Math.round(b.height));
}

export function rectChanged(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false;
  return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y) || Math.round(a.width) !== Math.round(b.width) || Math.round(a.height) !== Math.round(b.height));
}

export function pointChanged(a: Point, b: Point): boolean {
  return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y));
}

export function getArrowSize(placement: Placement, arrowStyle: StyleProp<ViewStyle>) {
  let width = StyleSheet.flatten(arrowStyle).width;
  if (typeof width !== "number") width = DEFAULT_ARROW_SIZE.width;
  let height = StyleSheet.flatten(arrowStyle).height;
  if (typeof height !== "number") height = DEFAULT_ARROW_SIZE.height;
  switch(placement) {
    case Placement.LEFT:
    case Placement.RIGHT:
      return new Size(height, width);
    default:
      return new Size(width, height);
  }
}

export function getBorderRadius(popoverStyle: StyleProp<ViewStyle>): number {
  if (StyleSheet.flatten(popoverStyle).borderRadius === 0) return 0;
  return StyleSheet.flatten(popoverStyle).borderRadius || DEFAULT_BORDER_RADIUS;
}
