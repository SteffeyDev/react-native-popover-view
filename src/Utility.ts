import { RefObject, ComponentClass, Component } from 'react';
import { NativeModules, findNodeHandle, StyleProp, ViewStyle, StyleSheet, MeasureInWindowOnSuccessCallback } from 'react-native';
import { Placement, Point, Rect, Size } from './Types';
import { DEFAULT_ARROW_SIZE, DEFAULT_BORDER_RADIUS } from './Constants';

// eslint-disable-next-line
type RefType = RefObject<number | Component<any, any, any> | ComponentClass<any, any> | {
  measureInWindow(callback: MeasureInWindowOnSuccessCallback): void;
} | null>;

export function getRectForRef(ref: RefType): Promise<Rect> {
  return new Promise((resolve, reject) => {
    if (!ref.current) {
      reject(new Error('getRectForRef - current is not set'));
      return;
    }

    if (typeof ref.current === 'object' && 'measureInWindow' in ref.current) {
      ref.current.measureInWindow(
        (x: number, y: number, width: number, height: number) =>
          resolve(new Rect(x, y, width, height))
      );
    } else {
      NativeModules.UIManager.measure(
        findNodeHandle(ref.current),
        (_1: unknown, _2: unknown, width: number, height: number, x: number, y: number) =>
          resolve(new Rect(x, y, width, height))
      );
    }
  });
}

export async function waitForChange(
  getFirst: () => Promise<Rect>,
  getSecond: () => Promise<Rect>
): Promise<void> {
  // Failsafe so that the interval doesn't run forever
  let count = 0;
  let first, second;
  do {
    first = await getFirst();
    second = await getSecond();
    await new Promise(resolve => {
      setTimeout(resolve, 100);
    });
    count++;
    if (count++ > 20) {
      throw new Error('waitForChange - Timed out waiting for change (waited 2 seconds)');
    }
  } while (first.equals(second));
}

export async function waitForNewRect(ref: RefType, initialRect: Rect): Promise<Rect> {
  await waitForChange(() => getRectForRef(ref), () => Promise.resolve(initialRect));
  const rect = await getRectForRef(ref);
  return rect;
}

export function sizeChanged(a: Size | null, b: Size | null): boolean {
  if (!a || !b) return false;
  return Math.round(a.width) !== Math.round(b.width) ||
    Math.round(a.height) !== Math.round(b.height);
}

export function rectChanged(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false;
  return Math.round(a.x) !== Math.round(b.x) ||
    Math.round(a.y) !== Math.round(b.y) ||
    Math.round(a.width) !== Math.round(b.width) ||
    Math.round(a.height) !== Math.round(b.height);
}

export function pointChanged(a: Point, b: Point): boolean {
  return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y));
}

export function getArrowSize(
  placement: Placement,
  arrowStyle: StyleProp<ViewStyle>
): Size {
  let { width, height } = StyleSheet.flatten(arrowStyle);
  if (typeof width !== 'number') ({ width } = DEFAULT_ARROW_SIZE);
  if (typeof height !== 'number') ({ height } = DEFAULT_ARROW_SIZE);
  switch (placement) {
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

export function getChangedProps(
  props: Record<string, unknown>,
  prevProps: Record<string, unknown>,
  importantProps: string[]
): string[] {
  return importantProps.filter(key => {
    const curVal = props[key];
    const prevVal = prevProps[key];
    if (curVal instanceof Rect && prevVal instanceof Rect) {
      return !curVal.equals(prevVal);
    }
    return curVal !== prevVal;
  });
}
