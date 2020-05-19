declare module "react-native-popover-view" {
  import {
    Animated,
    StyleProp,
    TouchableOpacity,
    View,
    ViewStyle
  } from "react-native";
  import { Component, ComponentType, Ref } from "react";
  import { SafeAreaViewProps } from "react-native-safe-area-view";

  export class Rect {
    constructor(x: number, y: number, width: number, height: number);
  }

  export class Size extends Rect {
    constructor(width: number, height: number);
  }

  interface PopoverViewProps {
    isVisible: boolean;
    mode?: "rn-modal" | "js-modal" | "tooltip";
    fromView?: Component<any> | null;
    fromRect?: Rect;
    fromDynamicRect?: (
      displayAreaWidth: number,
      displayAreaHeight: number
    ) => Rect;
    displayArea?: Rect;
    placement?: "top" | "bottom" | "left" | "right" | "auto";
    animationConfig?: Partial<Animated.TimingAnimationConfig>;
    verticalOffset?: number;
    statusBarTranslucent?: boolean;
    safeAreaInsets?: SafeAreaViewProps["forceInset"];
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
