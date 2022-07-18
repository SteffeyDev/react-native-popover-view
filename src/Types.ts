import { Animated, StyleProp, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

// eslint-disable-next-line
export enum Placement {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
  AUTO = 'auto',
  FLOATING = 'floating',
  // deprecated
  CENTER = 'center'
}

// eslint-disable-next-line
export enum Mode {
  JS_MODAL = 'js-modal',
  RN_MODAL = 'rn-modal',
  TOOLTIP = 'tooltip'
}

export type Insets = {
  left?: number;
  right?: number;
  bottom?: number;
  top?: number;
}

export interface ModalPopoverState {
  visible: boolean;
}

export type PopoverProps = {
  children?: ReactNode;
  isVisible?: boolean;

  // config
  placement?: Placement | Array<Placement>;
  animationConfig?: Partial<Animated.TimingAnimationConfig>;
  offset?: number;
  verticalOffset?: number;
  displayArea?: Rect;
  displayAreaInsets?: Insets;

  // style
  popoverStyle?: StyleProp<ViewStyle>;
  popoverShift?: { x?: number, y?: number };
  backgroundStyle?: StyleProp<ViewStyle>;
  arrowShift?: number;
  arrowSize?: Size;

  // lifecycle
  onOpenStart?: () => void;
  onOpenComplete?: () => void;
  onRequestClose?: () => void;
  onCloseStart?: () => void;
  onCloseComplete?: () => void;
  onPositionChange?: () => void;

  debug?: boolean;
}

export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  equals(b: Point): boolean {
    return Math.round(this.x) === Math.round(b.x) && Math.round(this.y) === Math.round(b.y);
  }
}

export class Size {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  equals(b: Size): boolean {
    return Math.round(this.width) === Math.round(b.width) &&
      Math.round(this.height) === Math.round(b.height);
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

  equals(b: Rect): boolean {
    return (Math.round(this.x) === Math.round(b.x) &&
      Math.round(this.y) === Math.round(b.y) &&
      Math.round(this.width) === Math.round(b.width) &&
      Math.round(this.height) === Math.round(b.height));
  }

  static clone(rect: Rect): Rect {
    return new Rect(rect.x, rect.y, rect.width, rect.height);
  }
}
