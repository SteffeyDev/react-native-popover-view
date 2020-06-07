'use strict';

import React, { Component, RefObject, ReactNode, ReactElement } from 'react';
import PropTypes from 'prop-types';
import SafeAreaView, { SafeAreaViewProps } from 'react-native-safe-area-view';
import {
  Platform,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  View,
  Modal,
  Keyboard,
  Easing,
  StyleProp,
  ViewStyle,
  StyleSheet,
  I18nManager,
  EasingFunction,
  LayoutChangeEvent
} from 'react-native';
import { Rect, Point, Size, getRectForRef, getArrowSize, getBorderRadius } from './Utility';
import { MULTIPLE_POPOVER_WARNING, Placement, Mode, DEFAULT_BORDER_RADIUS, FIX_SHIFT } from './Constants';
import { computeGeometry } from './Geometry';

const noop = () => {};

const isIOS = Platform.OS === 'ios';

const DEBUG = false;

interface PopoverProps {
  isVisible?: boolean;

  // config
  placement: Placement;
  animationConfig?: Partial<Animated.TimingAnimationConfig>;
  verticalOffset: number;
  safeAreaInsets?: SafeAreaViewProps["forceInset"];

  // style
  popoverStyle: StyleProp<ViewStyle>;
  arrowStyle: StyleProp<ViewStyle>;
  backgroundStyle: StyleProp<ViewStyle>;

  // lifecycle
  onOpenStart: () => void;
  onOpenComplete: () => void;
  onRequestClose: () => void;
  onCloseStart: () => void;
  onCloseComplete: () => void;

  debug?: boolean;
}

interface PublicPopoverProps extends PopoverProps {
  mode: Mode;
  displayArea?: Rect;
  from?: Rect | RefObject<View> | ((sourceRef: RefObject<View>, openPopover: () => void) => ReactNode) | ReactNode;
}

interface PublicPopoverState {
  isVisible: boolean;
}

export default class Popover extends Component<PublicPopoverProps, PublicPopoverState> {
  static propTypes = {
    // display
    isVisible: PropTypes.bool,

    // anchor
    from: PropTypes.oneOf([PropTypes.instanceOf(Rect), PropTypes.func, PropTypes.node]),

    // config
    displayArea: PropTypes.oneOf([PropTypes.instanceOf(Rect), PropTypes.exact({ x: PropTypes.number, y: PropTypes.number, width: PropTypes.number, height: PropTypes.number })]),
    placement: PropTypes.oneOf([Placement.LEFT, Placement.RIGHT, Placement.TOP, Placement.BOTTOM, Placement.AUTO, Placement.CENTER]),
    animationConfig: PropTypes.object,
    verticalOffset: PropTypes.number,
    safeAreaInsets: PropTypes.object,

    // style
    popoverStyle: PropTypes.object,
    arrowStyle: PropTypes.object,
    backgroundStyle: PropTypes.object,

    // lifecycle
    onOpenStart: PropTypes.func,
    onOpenComplete: PropTypes.func,
    onRequestClose: PropTypes.func,
    onCloseStart: PropTypes.func,
    onCloseComplete: PropTypes.func,

    debug: PropTypes.bool,
  }

  static defaultProps = {
    mode: Mode.RN_MODAL
  }

  state = {
    isVisible: false
  }

  private sourceRef: RefObject<View> = React.createRef();

  render() {
    const { mode, from, isVisible, onRequestClose, ...otherProps } = this.props;

    const actualIsVisible = isVisible === undefined ? this.state.isVisible : isVisible;

    let fromRect: Rect | undefined = undefined;
    let fromRef: RefObject<View> | undefined = undefined;
    let sourceElement: ReactElement<any> | undefined = undefined;

    if (from) {
      if (from instanceof Rect) {
        fromRect = from;
      } else if (from.hasOwnProperty('current')) {
        fromRef = from as RefObject<View>;
      } else if (typeof from === 'function') {
        const element = from(this.sourceRef, () => this.setState({ isVisible: true })); 
        if (React.isValidElement(element)) {
          sourceElement = element;
          fromRef = this.sourceRef;
        }
      } else if (React.isValidElement(from)) {
        sourceElement = React.cloneElement(from, { onPress: () => this.setState({ isVisible: true }) });
        fromRef = this.sourceRef;
      } else {
        console.warn('Popover: `from` prop is an invalid value. Pass a React element, Rect, RefObject, or function that returns a React element.');
      }
    }

    if (sourceElement) {
      sourceElement = React.cloneElement(sourceElement, { ref: this.sourceRef });
    }

    const modalProps = {
      ...otherProps,
      fromRect,
      fromRef,
      isVisible: actualIsVisible,
      onRequestClose: () => {
        onRequestClose();
        this.setState({ isVisible: false });
      }
    }

    if (mode === Mode.RN_MODAL) {
      return (
        <>
          {sourceElement}
          <RNModalPopover {...modalProps} />
        </>
      );
    } else {
      return (
        <>
          {sourceElement}
          <JSModalPopover showBackground={mode !== Mode.TOOLTIP} {...modalProps} />
        </>
      );
    }
  }
}

interface ModalPopoverState {
  visible: boolean;
}

interface RNModalPopoverProps extends PopoverProps {
  statusBarTranslucent?: boolean
  fromRect?: Rect;
  fromRef?: RefObject<View>;
  displayArea?: Rect;
}

class RNModalPopover extends Component<RNModalPopoverProps, ModalPopoverState> {
  state = {
    visible: false
  }
  private static isShowingInModal: boolean = false;

  componentDidMount() {
    if (this.props.isVisible) {
      if (!RNModalPopover.isShowingInModal) this.setState({ visible: true });
      else console.warn(MULTIPLE_POPOVER_WARNING);
    }
  }

  componentDidUpdate(prevProps: RNModalPopoverProps) {
    if (this.props.isVisible && !prevProps.isVisible) {
      if (!RNModalPopover.isShowingInModal) this.setState({ visible: true });
      else console.warn(MULTIPLE_POPOVER_WARNING);
    }
  }

  render() {
    const { statusBarTranslucent, onOpenStart, onCloseStart, onCloseComplete, onRequestClose, ...otherProps } = this.props;
    const { visible } = this.state;

    return (
      <Modal
        transparent={true}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}
        hardwareAccelerated={true}
        visible={visible}
        statusBarTranslucent={statusBarTranslucent}
        onShow={() => {
          onOpenStart();
          RNModalPopover.isShowingInModal = true;
        }}
        onDismiss={() => { // Will only be called on iOS for some reason
          onCloseComplete();
        }}
        onRequestClose={onRequestClose}>
        <AdaptivePopover
          onRequestClose={onRequestClose}
          onCloseComplete={() => {
            this.setState({ visible: false });
            if (!isIOS) {
              onCloseComplete();
            }
          }}
          onCloseStart={() => {
            onCloseStart();
            RNModalPopover.isShowingInModal = false;
          }}
          getDisplayAreaOffset={async () => new Point(0, 0)}
          {...otherProps}
        />
      </Modal>
    );
  }
}

interface JSModalPopoverProps extends PopoverProps {
  showBackground: boolean;
  fromRect?: Rect;
  fromRef?: RefObject<View>;
  displayArea?: Rect;
}

class JSModalPopover extends Component<JSModalPopoverProps, ModalPopoverState> {
  state = {
    visible: false
  }
  private containerRef = React.createRef<View>();

  componentDidMount() {
    if (this.props.isVisible) this.setState({ visible: true });
  }

  componentDidUpdate(prevProps: JSModalPopoverProps) {
    if (this.props.isVisible && !prevProps.isVisible) this.setState({ visible: true });
  }

  render() {
    const { onCloseComplete, ...otherProps } = this.props;
    const { visible } = this.state;

    if (visible) {
      return (
        <View ref={this.containerRef}>
          <AdaptivePopover
            onCloseComplete={() => {
              onCloseComplete();
              this.setState({ visible: false });
            }}
            getDisplayAreaOffset={async () => {
              const rect = await getRectForRef(this.containerRef)
              return new Point(rect.x, rect.y + FIX_SHIFT);
            }}
            {...otherProps}
          />
        </View>
      );
    }

    return null;
  }
}

interface AdaptivePopoverState {
  fromRect: Rect | null;
  shiftedDisplayArea: Rect | null;
  defaultDisplayArea: Rect | null;
  displayAreaOffset: Point | null;
}

interface AdaptivePopoverProps extends PopoverProps {
  fromRect?: Rect;
  fromRef?: RefObject<View>;
  showBackground?: boolean;
  displayArea?: Rect;
  getDisplayAreaOffset: () => Promise<Point>;
}

class AdaptivePopover extends Component<AdaptivePopoverProps, AdaptivePopoverState> {
  state = {
    fromRect: null,
    shiftedDisplayArea: null,
    defaultDisplayArea: null,
    displayAreaOffset: null,
  }

  static defaultProps = {
    onOpenStart: noop,
    onOpenComplete: noop,
    onRequestClose: noop,
    onCloseStart: noop,
    onCloseComplete: noop,
    debug: false
  }


  getDisplayArea(): Rect {
    return this.state.shiftedDisplayArea || this.props.displayArea || this.state.defaultDisplayArea || new Rect(10, 10, Dimensions.get('window').width - 20, Dimensions.get('window').height - 20);
  }

  // This is used so that when the device is rotating or the viewport is expanding for any other reason,
  //  we can suspend updates due to content changes until we are finished calculating the new display
  //  area and rect for the new viewport size
  // This makes the recalc on rotation much faster
  private waitForResizeToFinish: boolean = false;

  private skipNextDefaultDisplayArea: boolean = false;
  private displayAreaStore: Rect | undefined;

  private keyboardDidShowListener: any;
  private keyboardDidHideListener: any;

  componentDidMount() {
    Dimensions.addEventListener('change', this.handleResizeEvent)
    if (this.props.fromRect)
      this.setState({ fromRect: this.props.fromRect });
    else if (this.props.fromRef) {
      this.calculateRectFromRef();
    }
  }

  componentWillUnmount() {
    Dimensions.removeEventListener('change', this.handleResizeEvent)
  }

  componentDidUpdate(prevProps: AdaptivePopoverProps) {

    // Make sure a value we care about has actually changed
    let importantProps = ["from", "displayArea"]
    if (!importantProps.reduce((acc, key) => acc || this.props[key] !== prevProps[key], false))
      return;

    if (this.props.fromRect && prevProps.fromRect && !Rect.equals(this.props.fromRect, prevProps.fromRect))
      this.setState({ fromRect: this.props.fromRect });
    else if (this.props.fromRef) {
      this.calculateRectFromRef();
    }

    if (this.props.isVisible && prevProps.isVisible) {
      const { displayArea }: Partial<AdaptivePopoverProps> = this.props;
      if (
        (this.props.displayArea && !prevProps.displayArea)
        || (displayArea && prevProps.displayArea && !Rect.equals(displayArea, prevProps.displayArea))
        || (this.displayAreaStore && !Rect.equals(this.getDisplayArea(), this.displayAreaStore))
      ) {
        this.displayAreaStore = this.getDisplayArea();
      }
    }
  }


  // First thing called when device rotates
  handleResizeEvent = (change: any) => {
    this.debug("handleResizeEvent - New Dimensions", change);
    if (this.props.isVisible) {
      this.waitForResizeToFinish = true;
    }
  }

  debug(line: string, obj?: any): void {
    if (DEBUG || this.props.debug)
      console.log(`[${(new Date()).toISOString()}] ${line}` + (obj ? ": " + JSON.stringify(obj) : ''));
  }

  async setDefaultDisplayArea(newDisplayArea: Rect) {
    const { defaultDisplayArea }: Partial<AdaptivePopoverState> = this.state;
    // When the popover is closing and the display area's onLayout event is called, the width/height values may be zero
    // which causes a bad display area for the first mount when the popover re-opens
    const isValidDisplayArea = newDisplayArea.width > 0 && newDisplayArea.height > 0;
    if ((!defaultDisplayArea || !Rect.equals(defaultDisplayArea, newDisplayArea)) && isValidDisplayArea) {
      this.debug("setDefaultDisplayArea - newDisplayArea", newDisplayArea);
      if (!this.skipNextDefaultDisplayArea) {
        const displayAreaOffset = await this.props.getDisplayAreaOffset();
        this.debug("setDefaultDisplayArea - displayAreaOffset", displayAreaOffset);
        await new Promise(resolve => this.setState({ defaultDisplayArea: newDisplayArea, displayAreaOffset }, resolve));

        // If we have a ref, then changing the display area may have resulted in the view moving, so need to poll and see if it moves
        if (this.props.fromRef) {
          await this.calculateRectFromRef();
        }

        this.waitForResizeToFinish = false;
        this.displayAreaStore = this.getDisplayArea();
      }
      if (this.skipNextDefaultDisplayArea) this.debug("setDefaultDisplayArea - Skipping first because isLandscape");
      this.skipNextDefaultDisplayArea = false;
    }
  }

  keyboardDidShow(e: any) {
    this.debug("keyboardDidShow - keyboard height: " + e.endCoordinates.height);
    this.shiftForKeyboard(e.endCoordinates.height);
  }

  keyboardDidHide() {
    this.debug("keyboardDidHide");
    this.setState({ shiftedDisplayArea: null });
  }

  shiftForKeyboard(keyboardHeight: number) {
    const displayArea = this.getDisplayArea();

    const absoluteVerticalCutoff = Dimensions.get('window').height - keyboardHeight - (isIOS ? 10 : 40);
    const combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);

    this.setState({ shiftedDisplayArea: {
      x: displayArea.x,
      y: displayArea.y,
      width: displayArea.width,
      height: combinedY - displayArea.y
    }});
  }

  async calculateRectFromRef() {
    const { displayAreaOffset, fromRect }: Partial<AdaptivePopoverState> = this.state;
    const { fromRef }: Partial<AdaptivePopoverProps> = this.props;
    let initialRect = fromRect || new Rect(0, 0, 0, 0);

    let count = 0;
    while (!fromRef?.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (count++ > 20) return; // Timeout after 2 seconds
    }

    this.debug('calculateRect - calculating from Ref');
    const verticalOffset = this.props.verticalOffset + (displayAreaOffset ? -1 * displayAreaOffset!.y : 0);
    const horizontalOffset = displayAreaOffset ? -1 * displayAreaOffset!.x : 0;

    let rect: Rect;
    count = 0;
    do {
      rect = await getRectForRef(fromRef);
      if (count++ > 20) return; // Timeout after 2 seconds
    } while (Rect.equals(rect, initialRect))

    rect = new Rect(rect.x + horizontalOffset, rect.y + verticalOffset, rect.width, rect.height);
    this.debug('calculateRect - calculated Rect', rect);
    this.setState({ fromRect: rect });
  }

  render() {
    const { onOpenStart, onCloseStart, displayArea: _ignoreDisplayArea, fromRef, fromRect: _ignoreFromRect, ...otherProps } = this.props;
    const { fromRect } = this.state;

    // Don't render popover until we have an initial fromRect calculated for the view
    if (fromRef && !fromRect) return null;

    return (
      <BasePopover
        displayArea={this.getDisplayArea()}
        fromRect={fromRect}
        onOpenStart={() => {
          onOpenStart();
          this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow.bind(this));
          this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide.bind(this));
          this.displayAreaStore = this.getDisplayArea();
        }}
        onCloseStart={() => {
          onCloseStart();
          this.keyboardDidShowListener && this.keyboardDidShowListener.remove();
          this.keyboardDidHideListener && this.keyboardDidHideListener.remove();
          this.setState({ shiftedDisplayArea: null });
        }}
        skipMeasureContent={() => this.waitForResizeToFinish}
        safeAreaViewContents={(
          <TouchableWithoutFeedback
            style={{flex: 1}}
            onLayout={evt => this.setDefaultDisplayArea(
              new Rect(
                evt.nativeEvent.layout.x + 10,
                evt.nativeEvent.layout.y + 10,
                evt.nativeEvent.layout.width - 20,
                evt.nativeEvent.layout.height - 20)
              )
            }
          >
            <View style={{flex: 1}} />
          </TouchableWithoutFeedback>
        )}
        {...otherProps}
      />
    )

  }
}

interface BasePopoverProps extends PopoverProps {
  displayArea: Rect;
  showBackground?: boolean;
  fromRect: Rect | null;
  safeAreaViewContents: ReactNode;
  skipMeasureContent: () => boolean;
}

interface BasePopoverState {
  requestedContentSize: Size | null;
  forcedContentSize: Size | null;
  viewLargerThanDisplayArea: { width: boolean, height: boolean };
  anchorPoint: Point;
  popoverOrigin: Point;
  forcedHeight: number | null;
  placement: Placement;
  isAwaitingShow: boolean;
  showing: boolean;
  animatedValues: {
    scale: Animated.Value,
    translate: Animated.ValueXY,
    fade: Animated.Value,
    translateArrow: Animated.ValueXY
  }
}


class BasePopover extends Component<BasePopoverProps, BasePopoverState> {
  static defaultProps = {
    showBackground: true,
    placement: Placement.AUTO,
    verticalOffset: 0,
    popoverStyle: {},
    arrowStyle: {},
    backgroundStyle: {},
    onOpenStart: noop,
    onOpenComplete: noop,
    onRequestClose: noop,
    onCloseStart: noop,
    onCloseComplete: noop,
    debug: false
  }

  state = {
    requestedContentSize: null,
    forcedContentSize: null,
    viewLargerThanDisplayArea: {
      width: false,
      height: false
    },
    anchorPoint: new Point(0, 0),
    popoverOrigin: new Point(0, 0),
    forcedHeight: null,
    placement: Placement.AUTO,
    isAwaitingShow: true,
    visible: false, // Modal
    showing: false, // Popover itself
    fromRect: null,
    animatedValues: {
      scale: new Animated.Value(0),
      translate: new Animated.ValueXY(),
      fade: new Animated.Value(0),
      translateArrow: new Animated.ValueXY()
    }
  }

  private _isMounted: boolean = false;
  private animating: boolean = false;
  private animateOutAfterShow: boolean = false;

  private popoverRef = React.createRef<View>();

  private measureContentTimeout: any;
  private handleGeomChangeTimeout: any;

  debug(line: string, obj?: any): void {
    if (DEBUG || this.props.debug)
      console.log(`[${(new Date()).toISOString()}] ${line}` + (obj ? ": " + JSON.stringify(obj) : ''));
  }

  componentDidMount() {

    // Show popover if isVisible is initially true
    if (this.props.isVisible) {
      this.setState({ isAwaitingShow: true });
    }

    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;

    if (this.state.showing) {
      this.animateOut();
    } else {
      setTimeout(this.props.onCloseStart);
      setTimeout(this.props.onCloseComplete);
    }
  }

  measureContent(requestedContentSize: Size): void {
    if (!requestedContentSize.width) console.warn("Popover Warning - Can't Show - The Popover content has a width of 0, so there is nothing to present.");
    if (!requestedContentSize.height) console.warn("Popover Warning - Can't Show - The Popover content has a height of 0, so there is nothing to present.");
    if (this.props.skipMeasureContent()) {
      this.debug("measureContent - Skippting, waiting for resize to finish");
      return;
    }
    if (!this.state.showing && !this.state.isAwaitingShow) {
      this.debug("measureContent - Skipping because not showing");
      return;
    }

    const lastRequestedContentSize: Rect | null = this.state.requestedContentSize;

    if (requestedContentSize.width && requestedContentSize.height) {
      if (this.state.isAwaitingShow) {
        this.debug("measureContent - Showing Popover - requestedContentSize", requestedContentSize);
        let geom = this.computeGeometry({ requestedContentSize });
        this.debug("measureContent - Showing Popover - geom", geom);

        // If the view initially overflowed the display area, wait one more render cycle to test-render it within the display area to get
        //  final calculations for popoverOrigin before show
        if (geom.viewLargerThanDisplayArea.width || geom.viewLargerThanDisplayArea.height) {
          this.debug("measureContent - Delaying showing popover because viewLargerThanDisplayArea");
          this.setState({ ...geom, requestedContentSize });
        } else {

          setTimeout(this.props.onOpenStart);

          this.debug("measureContent - Showing Popover - Animating In");
          this.setState({ ...geom, requestedContentSize, isAwaitingShow: false }, () => this.animateIn());
        }
      } else if (lastRequestedContentSize !== null && (requestedContentSize.width !== lastRequestedContentSize!.width || requestedContentSize.height !== lastRequestedContentSize!.height)) {

        // In the case of an animation within the popover that affects the popover size, this function will be called frequently throughout the duration
        //   of the animation.  This will continuously schedule and then cancel the timeout until the last time this is called when the animation is complete.
        // If this method is only called once, we are only introducing a 50ms lag into the process, so shouldn't be noticeable
        clearTimeout(this.measureContentTimeout);
        this.measureContentTimeout = setTimeout(() => {
          this.debug("measureContent - new requestedContentSize: " + JSON.stringify(requestedContentSize) + " (used to be " + JSON.stringify(this.state.requestedContentSize) + ")");
          this.handleGeomChange(requestedContentSize);
        }, 50);
      }
    }
  }

  computeGeometry({ requestedContentSize }: { requestedContentSize: Size }) {
    const { placement: previousPlacement } = this.state;
    const { arrowStyle, popoverStyle, fromRect, displayArea, placement } = this.props;

    this.debug("computeGeometry - displayArea", displayArea);
    this.debug("computeGeometry - fromRect", fromRect);
    this.debug("computeGeometry - placement", placement.toString());

    return computeGeometry({
      requestedContentSize,
      placement,
      fromRect,
      displayArea,
      arrowStyle,
      popoverStyle,
      debug: this.debug.bind(this),
      previousPlacement
    });
  }

  getPolarity () {
    return I18nManager.isRTL ? -1 : 1;
  }

  getArrowDynamicStyle() {
    const { placement } = this.state;
    const { arrowStyle, popoverStyle } = this.props;
    const {  width, height } = this.getCalculatedArrowDims();

    const backgroundColor = StyleSheet.flatten(arrowStyle).backgroundColor || StyleSheet.flatten(popoverStyle).backgroundColor || styles.popoverContent.backgroundColor;
    let colors = {};
    switch (placement) {
      case Placement.TOP:
        colors = { borderTopColor: backgroundColor };
        break;
      case Placement.BOTTOM:
        colors = { borderBottomColor: backgroundColor };
        break;
      case Placement.LEFT:
        colors = { borderLeftColor: backgroundColor };
        break;
      case Placement.RIGHT:
        colors = { borderRightColor: backgroundColor };
        break;
      default:
    }

    // Create the arrow from a rectangle with the appropriate borderXWidth set
    // A rotation is then applied dependending on the placement
    // Also make it slightly bigger
    // to fix a visual artifact when the popover is animated with a scale
    return {
      width: width,
      height: height,
      borderTopWidth: height / 2,
      borderRightWidth: width / 2,
      borderBottomWidth: height / 2,
      borderLeftWidth: width / 2,
      ...colors
    }
  }

  getCalculatedArrowDims(): Size {
    const { placement } = this.state;
    const arrowSize = getArrowSize(placement, this.props.arrowStyle);
    switch(placement) {
      case Placement.LEFT:
      case Placement.RIGHT:
        arrowSize.height += 2
        arrowSize.width = arrowSize.width * 2 + 2;
        break;
      default:
        arrowSize.width += 2
        arrowSize.height = arrowSize.height * 2 + 2;
    }
    return arrowSize;
  }

  getArrowTranslateLocation(translatePoint: Point | null = null): Point {
    const { anchorPoint, placement, forcedContentSize, viewLargerThanDisplayArea, requestedContentSize }: Partial<BasePopoverState> = this.state;
    const { width: arrowWidth, height: arrowHeight } = this.getCalculatedArrowDims();

    let viewWidth = 0;
    if (viewLargerThanDisplayArea.width && forcedContentSize !== null && forcedContentSize!.width)
      viewWidth = forcedContentSize!.width;
    else if (requestedContentSize !== null && requestedContentSize!.width)
      viewWidth = requestedContentSize!.width;

    let viewHeight = 0;
    if (viewLargerThanDisplayArea.height && forcedContentSize !== null && forcedContentSize!.height)
      viewHeight = forcedContentSize!.height;
    else if (requestedContentSize !== null && requestedContentSize!.height)
      viewHeight = requestedContentSize!.height;

    let arrowX = anchorPoint.x - arrowWidth / 2;
    let arrowY = anchorPoint.y - arrowHeight / 2;

    const borderRadius = getBorderRadius(this.props.popoverStyle);

    // Ensuring that the arrow does not go outside the bounds of the content box during a move
    if (translatePoint) {
      if (placement === Placement.LEFT || placement === Placement.RIGHT) {
        if (translatePoint.y > (arrowY - borderRadius))
          arrowY = translatePoint.y + borderRadius
        else if (viewHeight && translatePoint.y + viewHeight < arrowY + arrowHeight)
          arrowY = translatePoint.y + viewHeight - arrowHeight - borderRadius
      } else if (placement === Placement.TOP || placement === Placement.BOTTOM) {
        if (translatePoint.x > arrowX - borderRadius)
          arrowX = translatePoint.x + borderRadius
        else if (viewWidth && translatePoint.x + viewWidth < arrowX + arrowWidth)
          arrowX = translatePoint.x + viewWidth - arrowWidth - borderRadius
      }
    }
    return new Point(arrowX, (FIX_SHIFT*2) /* Temp fix for useNativeDriver issue */ + arrowY);
  }

  getTranslateOrigin() {
    const {forcedContentSize, viewLargerThanDisplayArea, requestedContentSize, popoverOrigin, anchorPoint}: Partial<BasePopoverState> = this.state;

    let viewWidth = 0;
    if (viewLargerThanDisplayArea.width && forcedContentSize !== null && forcedContentSize!.width)
      viewWidth = forcedContentSize!.width;
    else if (requestedContentSize !== null && requestedContentSize!.width)
      viewWidth = requestedContentSize!.width;

    let viewHeight = 0;
    if (viewLargerThanDisplayArea.height && forcedContentSize !== null && forcedContentSize!.height)
      viewHeight = forcedContentSize!.height;
    else if (requestedContentSize !== null && requestedContentSize!.height)
      viewHeight = requestedContentSize!.height;


    const popoverCenter = new Point(popoverOrigin.x + (viewWidth / 2), popoverOrigin.y + (viewHeight / 2));
    const shiftHorizantal = anchorPoint.x - popoverCenter.x;
    const shiftVertical = anchorPoint.y - popoverCenter.y;

    this.debug("getTranslateOrigin - popoverOrigin", popoverOrigin);
    this.debug("getTranslateOrigin - popoverSize", {width: viewWidth, height: viewWidth});
    this.debug("getTranslateOrigin - anchorPoint", anchorPoint);
    this.debug("getTranslateOrigin - shift", {hoizontal: shiftHorizantal, vertical: shiftVertical});

    return new Point(popoverOrigin.x + shiftHorizantal, popoverOrigin.y + shiftVertical);
  }

  componentDidUpdate(prevProps: BasePopoverProps) {
    const { fromRect } = this.props;

    // Make sure a value we care about has actually changed
    let importantProps = ["isVisible", "fromRect", "displayArea", "verticalOffset", "placement"]
    if (!importantProps.reduce((acc, key) => acc || this.props[key] !== prevProps[key], false))
      return;

    if (this.props.isVisible !== prevProps.isVisible) {
      if (this.props.isVisible) {
        this.debug("componentDidUpdate - isVisible changed, now true");
        // We want to start the show animation only when contentSize is known
        // so that we can have some logic depending on the geometry
        this.debug("componentDidUpdate - setting visible and awaiting calculations");
        this.setState({ isAwaitingShow: true });
      } else {
        this.debug("componentDidUpdate - isVisible changed, now false");
        if (this.state.showing) this.animateOut();
        else this.animateOutAfterShow = true;
        this.debug("componentDidUpdate - Hiding popover");
      }
    } else if (this.props.isVisible && prevProps.isVisible) {
      const { displayArea }: Partial<BasePopoverProps> = this.props;
      if (
          (fromRect && prevProps.fromRect && !Rect.equals(prevProps.fromRect, fromRect))
          || (this.props.displayArea && !prevProps.displayArea)
          || (displayArea && prevProps.displayArea && !Rect.equals(displayArea, prevProps.displayArea))
        ) {
        this.handleGeomChange();
      }
    }
  }

  handleGeomChange(inRequestedContentSize?: Size) {
    const { forcedContentSize, popoverOrigin, animatedValues, requestedContentSize: lastRequestedContentSize }: Partial<BasePopoverState> = this.state;

    if (!inRequestedContentSize && !lastRequestedContentSize) return;
    let requestedContentSize: Size = inRequestedContentSize || lastRequestedContentSize!;

    this.debug("handleGeomChange - requestedContentSize", requestedContentSize);

    if (this.handleGeomChangeTimeout) clearTimeout(this.handleGeomChangeTimeout);
    this.handleGeomChangeTimeout = setTimeout(() => {
      let geom = this.computeGeometry({ requestedContentSize });

      if (
        !Point.equals(geom.popoverOrigin, popoverOrigin) ||
        (!geom.forcedContentSize && forcedContentSize) ||
        (!forcedContentSize && geom.forcedContentSize) ||
        (geom.forcedContentSize && forcedContentSize && !Size.equals(geom.forcedContentSize, forcedContentSize))
      ) {
        this.setState({ ...geom, requestedContentSize}, () => {
          let moveTo = new Point(geom.popoverOrigin.x, geom.popoverOrigin.y);
          this.debug("handleGeomChange - Triggering popover move to", moveTo);
          this.animateTo({
            values: animatedValues,
            fade: 1,
            scale: 1,
            translatePoint: moveTo,
            easing: Easing.inOut(Easing.quad)
          });
        });
      } else {
        this.debug("handleGeomChange - No change");
      }
    }, 200);

  }

  animateOut() {
    setTimeout(this.props.onCloseStart);

    this.setState({ showing: false });

    this.animateTo({
      values: this.state.animatedValues,
      fade: 0,
      scale: 0,
      translatePoint: this.getTranslateOrigin(),
      callback: () => {
        if (this._isMounted) this.setState({ forcedContentSize: null }, this.props.onCloseComplete)
        else this.props.onCloseComplete();
      },
      easing: Easing.inOut(Easing.quad)
    });
  }

  animateIn() {
    var values = this.state.animatedValues;

    // Should grow from anchor point
    let translateStart = this.getTranslateOrigin()
    translateStart.y += (FIX_SHIFT*2) // Temp fix for useNativeDriver issue
    values.translate.setValue(translateStart);
    const translatePoint = new Point(this.state.popoverOrigin.x, this.state.popoverOrigin.y);
    values.translateArrow.setValue(this.getArrowTranslateLocation(translatePoint));

    this.animateTo({
      values,
      fade: 1,
      scale: 1,
      translatePoint,
      easing: Easing.out(Easing.elastic(1)),
      callback: () => {
        if (this._isMounted) {
          this.setState({ showing: true });
          if (this.popoverRef)
            setTimeout(() => getRectForRef(this.popoverRef).then((rect: Rect) => this.debug("animateIn - onOpenComplete - Calculated Popover Rect", rect)));
        }
        setTimeout(this.props.onOpenComplete);
        if (this.animateOutAfterShow || !this._isMounted) {
          this.animateOut();
          this.animateOutAfterShow = false;
        }
      }
    })
  }

  animateTo(
    args:
    {
      fade: number;
      scale: number;
      translatePoint: Point;
      callback?: () => void;
      easing: EasingFunction;
      values: {
        scale: Animated.Value,
        translate: Animated.ValueXY,
        fade: Animated.Value,
        translateArrow: Animated.ValueXY
      }
    }
  ) {
    const { fade, translatePoint, scale, callback, easing, values } = args;
    const commonConfig = {
      duration: 300,
      easing,
      useNativeDriver: true,
      ...this.props.animationConfig
    };

    if (this.animating) {
      setTimeout(() => this.animateTo(args), 100);
      return;
    }

    const newArrowLocation = this.getArrowTranslateLocation(translatePoint);

    translatePoint.y = translatePoint.y + (FIX_SHIFT*2) // Temp fix for useNativeDriver issue

    if (!fade && fade !== 0) { console.log("Popover: Fade value is null"); return; }
    if (!translatePoint) { console.log("Popover: Translate Point value is null"); return; }
    if (!scale && scale !== 0) { console.log("Popover: Scale value is null"); return; }
    this.animating = true;
    Animated.parallel([
      Animated.timing(values.fade, {
        ...commonConfig,
        toValue: fade
      }),
      Animated.timing(values.translate, {
        ...commonConfig,
        toValue: translatePoint
      }),
      Animated.timing(values.scale, {
        ...commonConfig,
        toValue: scale
      }),
      Animated.timing(values.translateArrow, {
        ...commonConfig,
        toValue: newArrowLocation
      })
    ]).start(() => {
      this.animating = false;
      if (callback) callback();
    });
  }

  render() {
    var { animatedValues, forcedContentSize, isAwaitingShow } = this.state;
    const { popoverStyle } = this.props;
    const { width: arrowWidth, height: arrowHeight } = this.getCalculatedArrowDims();

    let arrowScale = animatedValues.scale.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    })

    var arrowViewStyle = {
      position: 'absolute',
      top: 0,
      ...(I18nManager.isRTL ? { right: 0 } : { left: 0 }),
      width: arrowWidth,
      height: arrowHeight,
      transform: [
        {translateX: animatedValues.translateArrow.x},
        {translateY: animatedValues.translateArrow.y},
        {scale: arrowScale},
      ]
    };

    let arrowInnerStyle = [
      styles.arrow,
      this.getArrowDynamicStyle()
    ];

    // Temp fix for useNativeDriver issue
    let backgroundShift = animatedValues.fade.interpolate({
      inputRange: [0, 0.0001, 1],
      outputRange: [0, FIX_SHIFT, FIX_SHIFT]
    })

    let backgroundStyle = {
      ...styles.background,
      transform: [
        {translateY: backgroundShift}
      ],
      ...StyleSheet.flatten(this.props.backgroundStyle)
    };

    let containerStyle = {
      ...styles.container,
      opacity: animatedValues.fade
    };

    let popoverViewStyle = {
      maxWidth: (forcedContentSize || { width: null }).width,
      maxHeight: (forcedContentSize || { height: null }).height,
      position: 'absolute',
      ...styles.dropShadow,
      ...styles.popoverContent,
      ...StyleSheet.flatten(popoverStyle),
      transform: [
        {translateX: animatedValues.translate.x},
        {translateY: animatedValues.translate.y},
        {scale: animatedValues.scale},
        {perspective: 1000}
      ]
    };

    return (
      <View pointerEvents="box-none" style={[styles.container, {left: 0}]}>
        <SafeAreaView pointerEvents="none" forceInset={this.props.safeAreaInsets} style={{position: 'absolute', top: FIX_SHIFT, left: 0, right: 0, bottom: 0}}>
          {this.props.safeAreaViewContents}
        </SafeAreaView>

        <Animated.View pointerEvents="box-none" style={containerStyle}>
          {this.props.showBackground && (
            <TouchableWithoutFeedback onPress={this.props.onRequestClose}>
              <Animated.View style={backgroundStyle} />
            </TouchableWithoutFeedback>
          )}

          <View pointerEvents="box-none" style={{top: 0, left: 0}}>
            
            <Animated.View style={popoverViewStyle} ref={this.popoverRef} onLayout={(evt: LayoutChangeEvent) => {
              const layout = { ...evt.nativeEvent.layout };
              setTimeout(() => this.measureContent(layout), 10);
            }}>
              {this.props.children}
            </Animated.View>

            {!isAwaitingShow && this.state.placement !== Placement.CENTER &&
              <Animated.View style={arrowViewStyle}>
                <Animated.View style={arrowInnerStyle} />
              </Animated.View>
            }
          </View>
        </Animated.View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    top: -1 * FIX_SHIFT,
    bottom: 0,
    left: 0,
    right: 0,
    position: 'absolute',
    backgroundColor: 'transparent'
  },
  background: {
    top: 0,
    bottom: FIX_SHIFT,
    left: 0,
    right: 0,
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  contentContainer: {
    flexDirection: 'column',
  },
  popoverContainer: {
    position: 'absolute',
    zIndex: 1000
  },
  popoverContent: {
    backgroundColor: 'white',
    borderBottomColor: '#333438',
    borderRadius: DEFAULT_BORDER_RADIUS,
    overflow: 'hidden'
  },
  selectContainer: {
    backgroundColor: '#f2f2f2',
    position: 'absolute'
  },
  dropShadow: {
    shadowColor: 'black',
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 2,
    shadowOpacity: 0.8
  },
  arrow: {
    position: 'absolute',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent'
  }
});

