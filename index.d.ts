declare module 'react-native-popover-view' {
  import { Component, ComponentType, Ref } from "react";
  import { Animated, StyleProp, TouchableOpacity, View, ViewStyle } from "react-native";

  export class Rect {
    constructor(x: number, y: number, width: number, height: number);
  }

  export class Size extends Rect {
    constructor(width: number, height: number);
  }

  interface PopoverViewProps {
    isVisible: boolean;
    mode?: 'rn-modal' | 'js-modal' | 'tooltip';
    fromView?: Component<any> | null;
    fromRect?: Rect;
    fromDynamicRect?: (displayAreaWidth: number, displayAreaHeight) => Rect;
    displayArea?: Rect;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
    animationConfig?: Animated.TimingAnimationConfig;
    verticalOffset?: number;
    popoverStyle?: StyleProp<ViewStyle>;
    arrowStyle?: StyleProp<ViewStyle>;
    backgroundStyle?: StyleProp<ViewStyle>;
    onOpenStart?: () => void;
    onOpenComplete?: () => void;
    onRequestClose?: () => void;
    onCloseStart?: () => void;
    onCloseComplete?: () => void;
    debug?: boolean;
  }
  export default class Popover extends Component<PopoverViewProps> {}
}
