// eslint-disable-next-line
export enum Placement {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
  AUTO = 'auto',
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
