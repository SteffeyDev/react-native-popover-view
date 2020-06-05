import { Component, ReactNode } from 'react';
import PropTypes from 'prop-types';
import { SafeAreaViewProps } from 'react-native-safe-area-view';
import { Animated, StyleProp, ViewStyle, EasingFunction } from 'react-native';
import { Rect, Point, Size } from './Utility';
export declare enum PLACEMENT_OPTIONS {
    TOP = "top",
    RIGHT = "right",
    BOTTOM = "bottom",
    LEFT = "left",
    AUTO = "auto",
    CENTER = "center"
}
export declare enum POPOVER_MODE {
    JS_MODAL = "js-modal",
    RN_MODAL = "rn-modal",
    TOOLTIP = "tooltip"
}
declare type ComputeGeometryType = {
    requestedContentSize: Size;
    displayArea: Rect;
    fromRect: Rect;
};
declare type GeometryType = {
    popoverOrigin: Point;
    anchorPoint: Point;
    placement: PLACEMENT_OPTIONS;
    forcedContentSize: Size | null;
    viewLargerThanDisplayArea: {
        width: boolean;
        height: boolean;
    };
};
interface Props {
    isVisible?: boolean;
    mode: POPOVER_MODE;
    from?: Rect | ((displayArea: Rect) => Rect) | ReactNode;
    displayArea?: Rect;
    placement: PLACEMENT_OPTIONS;
    animationConfig?: Partial<Animated.TimingAnimationConfig>;
    verticalOffset: number;
    statusBarTranslucent?: boolean;
    safeAreaInsets?: SafeAreaViewProps["forceInset"];
    popoverStyle: StyleProp<ViewStyle>;
    arrowStyle: StyleProp<ViewStyle>;
    backgroundStyle: StyleProp<ViewStyle>;
    onOpenStart: () => void;
    onOpenComplete: () => void;
    onRequestClose: () => void;
    onCloseStart: () => void;
    onCloseComplete: () => void;
    debug?: boolean;
}
interface State {
    requestedContentSize: Size | null;
    forcedContentSize: Size | null;
    viewLargerThanDisplayArea: {
        width: boolean;
        height: boolean;
    };
    anchorPoint: Point;
    popoverOrigin: Point;
    forcedHeight: number | null;
    shiftedDisplayArea: Rect | null;
    defaultDisplayArea: Rect | null;
    displayAreaOffset: Point | null;
    placement: PLACEMENT_OPTIONS;
    isAwaitingShow: boolean;
    visible: boolean;
    showing: boolean;
    fromRect: Rect | null;
    animatedValues: {
        scale: Animated.Value;
        translate: Animated.ValueXY;
        fade: Animated.Value;
        translateArrow: Animated.ValueXY;
    };
}
export default class Popover extends Component<Props, State> {
    static propTypes: {
        isVisible: PropTypes.Requireable<boolean>;
        mode: PropTypes.Requireable<POPOVER_MODE>;
        from: PropTypes.Requireable<PropTypes.Requireable<(...args: any[]) => any> | PropTypes.Requireable<PropTypes.ReactElementLike> | PropTypes.Requireable<PropTypes.InferProps<{
            current: PropTypes.Requireable<any>;
        }>> | PropTypes.Requireable<Required<PropTypes.InferProps<{
            x: PropTypes.Requireable<number>;
            y: PropTypes.Requireable<number>;
            width: PropTypes.Requireable<number>;
            height: PropTypes.Requireable<number>;
        }>>>>;
        displayArea: PropTypes.Requireable<PropTypes.Requireable<Required<PropTypes.InferProps<{
            x: PropTypes.Requireable<number>;
            y: PropTypes.Requireable<number>;
            width: PropTypes.Requireable<number>;
            height: PropTypes.Requireable<number>;
        }>>>>;
        placement: PropTypes.Requireable<PLACEMENT_OPTIONS>;
        animationConfig: PropTypes.Requireable<object>;
        verticalOffset: PropTypes.Requireable<number>;
        statusBarTranslucent: PropTypes.Requireable<boolean>;
        safeAreaInsets: PropTypes.Requireable<object>;
        popoverStyle: PropTypes.Requireable<object>;
        arrowStyle: PropTypes.Requireable<object>;
        backgroundStyle: PropTypes.Requireable<object>;
        onOpenStart: PropTypes.Requireable<(...args: any[]) => any>;
        onOpenComplete: PropTypes.Requireable<(...args: any[]) => any>;
        onRequestClose: PropTypes.Requireable<(...args: any[]) => any>;
        onCloseStart: PropTypes.Requireable<(...args: any[]) => any>;
        onCloseComplete: PropTypes.Requireable<(...args: any[]) => any>;
        debug: PropTypes.Requireable<boolean>;
    };
    static defaultProps: {
        mode: POPOVER_MODE;
        placement: PLACEMENT_OPTIONS;
        verticalOffset: number;
        popoverStyle: {};
        arrowStyle: {};
        backgroundStyle: {};
        onOpenStart: () => void;
        onOpenComplete: () => void;
        onRequestClose: () => void;
        onCloseStart: () => void;
        onCloseComplete: () => void;
        debug: boolean;
    };
    state: {
        requestedContentSize: null;
        forcedContentSize: null;
        viewLargerThanDisplayArea: {
            width: boolean;
            height: boolean;
        };
        anchorPoint: Point;
        popoverOrigin: Point;
        forcedHeight: null;
        shiftedDisplayArea: null;
        defaultDisplayArea: null;
        displayAreaOffset: null;
        placement: PLACEMENT_OPTIONS;
        isAwaitingShow: boolean;
        visible: boolean;
        showing: boolean;
        fromRect: null;
        animatedValues: {
            scale: Animated.Value;
            translate: Animated.ValueXY;
            fade: Animated.Value;
            translateArrow: Animated.ValueXY;
        };
    };
    private static isShowingInModal;
    private skipNextDefaultDisplayArea;
    private waitForResizeToFinish;
    private displayAreaStore;
    private _isMounted;
    private updateCount;
    private animating;
    private animateOutAfterShow;
    private containerRef;
    private popoverRef;
    private measureContentTimeout;
    private keyboardDidShowListener;
    private keyboardDidHideListener;
    debug(line: string, obj?: any): void;
    getDisplayAreaOffset(): Promise<Point>;
    setDefaultDisplayArea(newDisplayArea: Rect): void;
    keyboardDidShow(e: any): void;
    keyboardDidHide(): void;
    shiftForKeyboard(keyboardHeight: number): void;
    componentDidMount(): void;
    componentWillUnmount(): void;
    handleResizeEvent: (change: any) => void;
    measureContent(requestedContentSize: Size): void;
    computeGeometry({ requestedContentSize, placement, fromRect, displayArea }: {
        requestedContentSize: Size;
        placement?: PLACEMENT_OPTIONS;
        fromRect?: Rect;
        displayArea?: Rect;
    }): GeometryType;
    computeTopGeometry({ displayArea, fromRect, requestedContentSize }: ComputeGeometryType): GeometryType;
    computeBottomGeometry({ displayArea, fromRect, requestedContentSize }: ComputeGeometryType): GeometryType;
    getPolarity(): 1 | -1;
    computeLeftGeometry({ displayArea, fromRect, requestedContentSize }: ComputeGeometryType): GeometryType;
    computeRightGeometry({ displayArea, fromRect, requestedContentSize }: ComputeGeometryType): GeometryType;
    computeAutoGeometry({ displayArea, requestedContentSize, fromRect }: ComputeGeometryType): GeometryType;
    getArrowSize(placement: PLACEMENT_OPTIONS): Size;
    getArrowDynamicStyle(): {
        width: number;
        height: number;
        borderTopWidth: number;
        borderRightWidth: number;
        borderBottomWidth: number;
        borderLeftWidth: number;
    };
    getCalculatedArrowDims(): Size;
    getBorderRadius(): number;
    getArrowTranslateLocation(translatePoint?: Point | null): Point;
    getTranslateOrigin(): Point;
    getDisplayArea(): Rect;
    componentDidUpdate(prevProps: Props): void;
    calculateRect(): Promise<Rect | null>;
    handleGeomChange(requestedContentSize?: Size): void;
    animateOut(): void;
    animateIn(): void;
    animateTo(args: {
        fade: number;
        scale: number;
        translatePoint: Point;
        callback?: () => void;
        easing: EasingFunction;
        values: {
            scale: Animated.Value;
            translate: Animated.ValueXY;
            fade: Animated.Value;
            translateArrow: Animated.ValueXY;
        };
    }): void;
    render(): JSX.Element | null;
}
export {};
