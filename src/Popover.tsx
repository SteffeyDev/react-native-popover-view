import React, { Component, RefObject, ReactNode, ReactElement } from 'react';
import PropTypes from 'prop-types';
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
import { computeGeometry, Geometry } from './Geometry';
import { Insets, Placement, Mode } from './Types';
import { MULTIPLE_POPOVER_WARNING, DEFAULT_BORDER_RADIUS } from './Constants';

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

const DEBUG = false;

/*
 * FIX_SHIFT resolves an issue with useNativeDriver, where it would flash the 
 * popover on and off really quickly, and then animate in normally. Now, because 
 * of the shift, the flash happens off screen, and then it is shifted on screen 
 * just before beginning the actual animation. 
 */
const FIX_SHIFT = isWeb
  ? 0
  : Dimensions.get('window').height * 2;

interface PopoverProps {
  isVisible?: boolean;

  // config
  placement?: Placement;
  animationConfig?: Partial<Animated.TimingAnimationConfig>;
  verticalOffset?: number;
  displayArea?: Rect;
  displayAreaInsets?: Insets;

  // style
  popoverStyle?: StyleProp<ViewStyle>;
  arrowStyle?: StyleProp<ViewStyle>;
  backgroundStyle?: StyleProp<ViewStyle>;
  arrowShift?: number;

  // lifecycle
  onOpenStart?: () => void;
  onOpenComplete?: () => void;
  onRequestClose?: () => void;
  onCloseStart?: () => void;
  onCloseComplete?: () => void;

  debug?: boolean;
}

interface PublicPopoverProps extends PopoverProps {
  mode?: Mode;
  from?:
    | Rect
    | RefObject<View>
    | ((sourceRef: RefObject<View>, openPopover: () => void) => ReactNode)
    | ReactNode;
}

interface PublicPopoverState {
  isVisible: boolean;
}

// React Native Web does not export ViewPropTypes, so this is a workaround
const stylePropType =
  isWeb
    ? PropTypes.object
    // eslint-disable-next-line
    : require('react-native').ViewPropTypes.style

export default class Popover extends Component<PublicPopoverProps, PublicPopoverState> {
  static propTypes = {
    // display
    isVisible: PropTypes.bool,

    // anchor
    from: PropTypes.oneOfType([
      PropTypes.instanceOf(Rect),
      PropTypes.func,
      PropTypes.node,
      PropTypes.shape({ current: PropTypes.any })
    ]),

    // config
    displayArea: PropTypes.oneOfType([
      PropTypes.instanceOf(Rect),
      PropTypes.exact({
        x: PropTypes.number,
        y: PropTypes.number,
        width: PropTypes.number,
        height: PropTypes.number
      })
    ]),
    displayAreaInsets: PropTypes.shape({
      left: PropTypes.number,
      right: PropTypes.number,
      top: PropTypes.number,
      bottom: PropTypes.number
    }),
    placement: PropTypes.oneOf([
      Placement.LEFT,
      Placement.RIGHT,
      Placement.TOP,
      Placement.BOTTOM,
      Placement.AUTO,
      Placement.CENTER
    ]),
    animationConfig: PropTypes.object,
    verticalOffset: PropTypes.number,

    // style
    popoverStyle: stylePropType,
    arrowStyle: stylePropType,
    backgroundStyle: stylePropType,
    arrowShift: PropTypes.number,

    // lifecycle
    onOpenStart: PropTypes.func,
    onOpenComplete: PropTypes.func,
    onRequestClose: PropTypes.func,
    onCloseStart: PropTypes.func,
    onCloseComplete: PropTypes.func,

    debug: PropTypes.bool
  }

  static defaultProps: Partial<PublicPopoverProps> = {
    mode: Mode.RN_MODAL,
    placement: Placement.AUTO,
    verticalOffset: 0,
    popoverStyle: {},
    arrowStyle: {},
    backgroundStyle: {},
    debug: false
  }

  state = {
    isVisible: false
  }

  private sourceRef: RefObject<View> = React.createRef();

  render(): ReactElement {
    const { mode, from, isVisible, onRequestClose, ...otherProps } = this.props;

    const actualIsVisible = isVisible === undefined
      ? this.state.isVisible
      : isVisible;

    let fromRect: Rect | undefined;
    let fromRef: RefObject<View> | undefined;
    let sourceElement: ReactElement | undefined;

    if (from) {
      if (from instanceof Rect) {
        fromRect = from;
      } else if ({}.hasOwnProperty.call(from, 'current')) {
        fromRef = from as RefObject<View>;
      } else if (typeof from === 'function') {
        const element = from(this.sourceRef, () => this.setState({ isVisible: true }));
        if (React.isValidElement(element)) {
          sourceElement = element;
          fromRef = this.sourceRef;
        }
      } else if (React.isValidElement(from)) {
        if (isVisible === undefined) {
          sourceElement = React.cloneElement(
            from,
            { onPress: () => this.setState({ isVisible: true }) }
          );
        } else {
          sourceElement = from;
        }
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
        if (onRequestClose) onRequestClose();
        this.setState({ isVisible: false });
      }
    };

    if (mode === Mode.RN_MODAL) {
      return (
        <>
          {sourceElement}
          <RNModalPopover {...modalProps} />
        </>
      );
    }

    return (
      <>
        {sourceElement}
        <JSModalPopover showBackground={mode !== Mode.TOOLTIP} {...modalProps} />
      </>
    );
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

  private static isShowingInModal = false;

  componentDidMount() {
    if (this.props.isVisible) {
      if (RNModalPopover.isShowingInModal) console.warn(MULTIPLE_POPOVER_WARNING);
      else this.setState({ visible: true });
    }
  }

  componentDidUpdate(prevProps: RNModalPopoverProps, prevState: ModalPopoverState) {
    if (this.props.isVisible && !prevProps.isVisible) {
      if (RNModalPopover.isShowingInModal) console.warn(MULTIPLE_POPOVER_WARNING);
      else this.setState({ visible: true });
    }

    if (!this.state.visible && prevState.visible && this.props.onCloseComplete) {
      /*
       * Don't run this callback until after update, so that <Modal> is no longer active
       * Need to wait 50ms to make sure <Modal> is completely gone, in case
       * we want to show another popover immediately after
       */
      setTimeout(this.props.onCloseComplete, 50);
    }
  }

  render() {
    const {
      statusBarTranslucent,
      onCloseStart,
      onRequestClose
    } = this.props;
    const { visible } = this.state;

    return (
      <Modal
        transparent={true}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}
        hardwareAccelerated={true}
        visible={visible}
        statusBarTranslucent={statusBarTranslucent}
        onShow={() => {
          RNModalPopover.isShowingInModal = true;
        }}
        // Handles android back button
        onRequestClose={onRequestClose}>
        <AdaptivePopover
          {...this.props}
          onCloseStart={() => {
            RNModalPopover.isShowingInModal = false;
            if (onCloseStart) onCloseStart();
          }}
          onCloseComplete={() => this.setState({ visible: false })}
          getDisplayAreaOffset={() => Promise.resolve(new Point(0, 0))}
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
    const { onCloseComplete } = this.props;
    const { visible } = this.state;

    if (visible) {
      return (
        <View
          pointerEvents="box-none"
          style={styles.container}
          ref={this.containerRef}>
          <AdaptivePopover
            {...this.props}
            onCloseComplete={() => {
              if (onCloseComplete) onCloseComplete();
              this.setState({ visible: false });
            }}
            getDisplayAreaOffset={async () => {
              const rect = await getRectForRef(this.containerRef);
              return new Point(rect.x, rect.y);
            }}
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
    displayAreaOffset: null
  }

  getUnshiftedDisplayArea(): Rect {
    return this.props.displayArea ||
      this.state.defaultDisplayArea ||
      new Rect(0, 0, Dimensions.get('window').width, Dimensions.get('window').height);
  }

  // Apply insets and shifts if needed
  getDisplayArea(): Rect {
    const { displayAreaInsets } = this.props;
    const displayArea = this.state.shiftedDisplayArea || this.getUnshiftedDisplayArea();
    if (displayAreaInsets) {
      return new Rect(
        displayArea.x + (displayAreaInsets.left ?? 0),
        displayArea.x + (displayAreaInsets.top ?? 0),
        displayArea.width - (displayAreaInsets.left ?? 0) - (displayAreaInsets.right ?? 0),
        displayArea.height - (displayAreaInsets.top ?? 0) - (displayAreaInsets.bottom ?? 0)
      );
    }
    return displayArea;
  }

  /*
   * This is used so that when the device is rotating
   * or the viewport is expanding for any other reason,
   * we can suspend updates due to content changes until
   * we are finished calculating the new display
   * area and rect for the new viewport size.
   * This makes the recalc on rotation much faster.
   */
  private waitForResizeToFinish = false;

  private skipNextDefaultDisplayArea = false;
  private displayAreaStore: Rect | undefined;
  private _isMounted = false;

  componentDidMount() {
    this.handleResizeEvent = this.handleResizeEvent.bind(this);
    this.keyboardDidHide = this.keyboardDidHide.bind(this);
    this.keyboardDidShow = this.keyboardDidShow.bind(this);

    Dimensions.addEventListener('change', this.handleResizeEvent);
    if (this.props.fromRect) this.setState({ fromRect: this.props.fromRect });
    else if (this.props.fromRef) this.calculateRectFromRef();
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
    Dimensions.removeEventListener('change', this.handleResizeEvent);
    Keyboard.removeListener('keyboardDidShow', this.keyboardDidShow);
    Keyboard.removeListener('keyboardDidHide', this.keyboardDidHide);
  }

  componentDidUpdate(prevProps: AdaptivePopoverProps) {
    // Make sure a value we care about has actually changed
    const importantProps = ['from', 'displayArea'];
    if (!importantProps.reduce((acc, key) => acc || this.props[key] !== prevProps[key], false))
      return;

    if (
      this.props.fromRect &&
      prevProps.fromRect &&
      !Rect.equals(this.props.fromRect, prevProps.fromRect)
    ) {
      this.debug('componentDidUpdate - fromRect changed', this.props.fromRect);
      this.setState({ fromRect: this.props.fromRect });
    } else if (this.props.fromRef) {
      this.debug('componentDidUpdate - fromRef changed');
      this.calculateRectFromRef();
    }

    if (this.props.isVisible && prevProps.isVisible) {
      const { displayArea }: Partial<AdaptivePopoverProps> = this.props;
      if (
        (this.props.displayArea && !prevProps.displayArea) ||
        (
          displayArea &&
          prevProps.displayArea &&
          !Rect.equals(displayArea, prevProps.displayArea)
        ) ||
        (
          this.displayAreaStore &&
          !Rect.equals(this.getDisplayArea(), this.displayAreaStore)
        )
      ) {
        this.debug('componentDidUpdate - displayArea changed', this.getDisplayArea());
        this.displayAreaStore = this.getDisplayArea();
      }
    }
  }


  // First thing called when device rotates
  handleResizeEvent(change: unknown) {
    this.debug('handleResizeEvent - New Dimensions', change);
    if (this.props.isVisible) {
      this.waitForResizeToFinish = true;
    }
  }

  debug(line: string, obj?: unknown): void {
    if (DEBUG || this.props.debug)
      console.log(`[${(new Date()).toISOString()}] ${line}${obj ? `: ${JSON.stringify(obj)}` : ''}`);
  }

  async setDefaultDisplayArea(newDisplayArea: Rect) {
    if (!this._isMounted) return;

    const { defaultDisplayArea }: Partial<AdaptivePopoverState> = this.state;

    /*
     * When the popover is closing and the display area's onLayout event is called,
     * the width/height values may be zero which causes a bad display area for the
     * first mount when the popover re-opens
     */
    const isValidDisplayArea = newDisplayArea.width > 0 && newDisplayArea.height > 0;
    if (
      (!defaultDisplayArea || !Rect.equals(defaultDisplayArea, newDisplayArea)) &&
      isValidDisplayArea
    ) {
      this.debug('setDefaultDisplayArea - newDisplayArea', newDisplayArea);
      if (!this.skipNextDefaultDisplayArea) {
        const displayAreaOffset = await this.props.getDisplayAreaOffset();
        this.debug('setDefaultDisplayArea - displayAreaOffset', displayAreaOffset);
        await new Promise(resolve => {
          this.setState(
            { defaultDisplayArea: newDisplayArea, displayAreaOffset },
            () => resolve(null)
          );
        });

        /*
         * If we have a ref, then changing the display area may have resulted in the view moving,
         * so need to poll and see if it moves
         */
        if (this.props.fromRef) {
          await this.calculateRectFromRef();
        }

        this.waitForResizeToFinish = false;
        this.displayAreaStore = this.getDisplayArea();
      }
      if (this.skipNextDefaultDisplayArea)
        this.debug('setDefaultDisplayArea - Skipping first because isLandscape');
      this.skipNextDefaultDisplayArea = false;
    }
  }

  // Custom type here, as KeyboardEvent type does not contain endCoordinates
  keyboardDidShow(e: { endCoordinates: { height: number } }) {
    this.debug(`keyboardDidShow - keyboard height: ${e.endCoordinates.height}`);
    this.shiftForKeyboard(e.endCoordinates.height);
  }

  keyboardDidHide() {
    this.debug('keyboardDidHide');
    if (this._isMounted) this.setState({ shiftedDisplayArea: null });
  }

  shiftForKeyboard(keyboardHeight: number) {
    const displayArea = this.getUnshiftedDisplayArea();

    const absoluteVerticalCutoff =
      Dimensions.get('window').height - keyboardHeight - (isIOS ? 10 : 40);
    const combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);

    this.setState({
      shiftedDisplayArea: {
        x: displayArea.x,
        y: displayArea.y,
        width: displayArea.width,
        height: combinedY - displayArea.y
      }
    });
  }

  async calculateRectFromRef() {
    const { fromRef }: Partial<AdaptivePopoverProps> = this.props;
    const initialRect = this.state.fromRect || new Rect(0, 0, 0, 0);
    const displayAreaOffset = this.state.displayAreaOffset ?? { x: 0, y: 0 };

    this.debug('calculateRectFromRef - waiting for ref');
    let count = 0;
    while (!fromRef?.current) {
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });
      // Timeout after 2 seconds
      if (count++ > 20) return;
    }

    const verticalOffset = (this.props.verticalOffset ?? 0) - displayAreaOffset.y;
    const horizontalOffset = -displayAreaOffset.x;

    this.debug('calculateRectFromRef - waiting for ref to move');
    let rect: Rect;
    count = 0;
    do {
      rect = await getRectForRef(fromRef);
      rect = new Rect(rect.x + horizontalOffset, rect.y + verticalOffset, rect.width, rect.height);
      // Timeout after 2 seconds
      if (count++ > 20) return;
    } while (Rect.equals(rect, initialRect));

    this.debug('calculateRectFromRef - calculated Rect', rect);
    if (this._isMounted) this.setState({ fromRect: rect });
  }

  render() {
    const { onOpenStart, onCloseStart, fromRef, ...otherProps } = this.props;
    const { fromRect } = this.state;

    // Don't render popover until we have an initial fromRect calculated for the view
    if (fromRef && !fromRect) return null;

    return (
      <BasePopover
        {...otherProps}
        displayArea={this.getDisplayArea()}
        fromRect={fromRect}
        onOpenStart={() => {
          if (onOpenStart) onOpenStart();
          this.debug('Setting up keyboard listeners');
          Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
          Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);
          this.displayAreaStore = this.getDisplayArea();
        }}
        onCloseStart={() => {
          if (onCloseStart) onCloseStart();
          this.debug('Tearing down keyboard listeners');
          Keyboard.removeListener('keyboardDidShow', this.keyboardDidShow);
          Keyboard.removeListener('keyboardDidHide', this.keyboardDidHide);
          if (this._isMounted) this.setState({ shiftedDisplayArea: null });
        }}
        skipMeasureContent={() => this.waitForResizeToFinish}
        onDisplayAreaChanged={rect => this.setDefaultDisplayArea(rect)}
      />
    );

  }
}

interface BasePopoverProps extends Omit<PopoverProps, 'displayAreaInsets'> {
  displayArea: Rect;
  showBackground?: boolean;
  fromRect: Rect | null;
  onDisplayAreaChanged: (rect: Rect) => void;
  skipMeasureContent: () => boolean;
}

interface BasePopoverState {
  requestedContentSize: Size | null;
  activeGeom: Geometry | undefined,
  nextGeom: Geometry | undefined,
  showing: boolean;
  animatedValues: {
    scale: Animated.Value,
    translate: Animated.ValueXY,
    fade: Animated.Value,
    translateArrow: Animated.ValueXY
  }
}


class BasePopover extends Component<BasePopoverProps, BasePopoverState> {
  state: BasePopoverState = {
    requestedContentSize: null,
    activeGeom: undefined,
    nextGeom: undefined,
    showing: false,
    animatedValues: {
      scale: new Animated.Value(0),
      translate: new Animated.ValueXY(),
      fade: new Animated.Value(0),
      translateArrow: new Animated.ValueXY()
    }
  }

  private _isMounted = false;
  private animating = false;
  private animateOutAfterShow = false;

  private popoverRef = React.createRef<View>();
  private arrowRef = React.createRef<View>();

  private handleChangeTimeout?: ReturnType<typeof setTimeout>;

  debug(line: string, obj?: unknown): void {
    if (DEBUG || this.props.debug)
      console.log(`[${(new Date()).toISOString()}] ${line}${obj ? `: ${JSON.stringify(obj)}` : ''}`);
  }

  componentDidMount() {
    this._isMounted = true;
  }

  componentDidUpdate(prevProps: BasePopoverProps) {
    // Make sure a value we care about has actually changed
    const importantProps = ['isVisible', 'fromRect', 'displayArea', 'verticalOffset', 'placement'];
    if (!importantProps.reduce((acc, key) => acc || this.props[key] !== prevProps[key], false))
      return;

    if (this.props.isVisible !== prevProps.isVisible) {
      this.debug(`componentDidUpdate - isVisible changed, now ${this.props.isVisible}`);
      if (!this.props.isVisible) {
        if (this.state.showing) this.animateOut();
        else this.animateOutAfterShow = true;
        this.debug('componentDidUpdate - Hiding popover');
      }
    } else if (this.props.isVisible && prevProps.isVisible) {
      this.handleChange();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;

    if (this.state.showing) {
      this.animateOut();
    }
  }

  measureContent(requestedContentSize: Size): void {
    if (!requestedContentSize.width)
      console.warn(`Popover Warning - Can't Show - The Popover content has a width of 0, so there is nothing to present.`);
    if (!requestedContentSize.height) console.warn(`Popover Warning - Can't Show - The Popover content has a height of 0, so there is nothing to present.`);
    if (this.props.skipMeasureContent()) {
      this.debug(`measureContent - Skippting, waiting for resize to finish`);
      return;
    }

    if (requestedContentSize.width && requestedContentSize.height) {
      this.debug(`measureContent - new requestedContentSize: ${JSON.stringify(requestedContentSize)} (used to be ${JSON.stringify(this.state.requestedContentSize)})`);
      this.setState({ requestedContentSize }, () => this.handleChange());
    }
  }

  /*
   * Many factors may cause the geometry to change.
   * This function collects all of them, waiting for 200ms after the last change,
   * then takes action, either bringing up the popover or moving it to its new location
   */
  handleChange() {
    if (this.handleChangeTimeout) clearTimeout(this.handleChangeTimeout);

    /*
     * This function will be called again once we have a requested content size,
     * so safe to ignore for now
     */
    if (!this.state.requestedContentSize) {
      this.debug('handleChange - no requestedContentSize, exiting...');
      return;
    }

    this.debug('handleChange - waiting 100ms to accumulate all changes');
    this.handleChangeTimeout = setTimeout(() => {
      const {
        activeGeom,
        animatedValues,
        requestedContentSize
      }: Partial<BasePopoverState> = this.state;
      const {
        arrowStyle,
        popoverStyle,
        fromRect,
        displayArea,
        placement,
        onOpenStart,
        arrowShift
      } = this.props;

      if (requestedContentSize) {
        this.debug('handleChange - requestedContentSize', requestedContentSize);

        this.debug('handleChange - displayArea', displayArea);
        this.debug('handleChange - fromRect', fromRect);
        if (placement) this.debug('handleChange - placement', placement.toString());

        const geom = computeGeometry({
          requestedContentSize,
          placement,
          fromRect,
          displayArea,
          arrowStyle,
          popoverStyle,
          arrowShift,
          debug: this.debug.bind(this),
          previousPlacement: this.getGeom().placement
        });

        this.setState({ nextGeom: geom, requestedContentSize }, () => {
          if (geom.viewLargerThanDisplayArea.width || geom.viewLargerThanDisplayArea.height) {
            /*
             * If the view initially overflowed the display area,
             * wait one more render cycle to test-render it within
             * the display area to get final calculations for popoverOrigin before show
             */
            this.debug('handleChange - delaying showing popover because viewLargerThanDisplayArea');
          } else if (!activeGeom) {
            this.debug('handleChange - animating in');
            if (onOpenStart) setTimeout(onOpenStart);
            this.animateIn();
          } else if (activeGeom && !Geometry.equals(activeGeom, geom)) {
            const moveTo = new Point(geom.popoverOrigin.x, geom.popoverOrigin.y);
            this.debug('handleChange - Triggering popover move to', moveTo);
            this.animateTo({
              values: animatedValues,
              fade: 1,
              scale: 1,
              translatePoint: moveTo,
              easing: Easing.inOut(Easing.quad),
              geom
            });
          } else {
            this.debug('handleChange - no change');
          }
        });
      }
    }, 100);
  }

  static getPolarity(): -1 | 1 {
    return I18nManager.isRTL ? -1 : 1;
  }

  getGeom(): Geometry {
    const { activeGeom, nextGeom }: Partial<BasePopoverState> = this.state;
    if (activeGeom) return activeGeom;
    if (nextGeom) return nextGeom;
    return new Geometry({
      popoverOrigin: new Point(0, 0),
      anchorPoint: new Point(0, 0),
      placement: Placement.AUTO,
      forcedContentSize: null,
      viewLargerThanDisplayArea: {
        width: false,
        height: false
      }
    });
  }

  getArrowDynamicStyle(geom?: Geometry) {
    const { placement } = geom || this.getGeom();
    const { arrowStyle, popoverStyle } = this.props;
    const { width, height } = this.getCalculatedArrowDims(geom);

    const backgroundColor = StyleSheet.flatten(arrowStyle).backgroundColor ||
      StyleSheet.flatten(popoverStyle).backgroundColor ||
      styles.popoverContent.backgroundColor;

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

    /*
     * Create the arrow from a rectangle with the appropriate borderXWidth set
     * A rotation is then applied dependending on the placement
     * Also make it slightly bigger
     * to fix a visual artifact when the popover is animated with a scale
     */
    return {
      width,
      height,
      borderTopWidth: height / 2,
      borderRightWidth: width / 2,
      borderBottomWidth: height / 2,
      borderLeftWidth: width / 2,
      ...colors
    };
  }

  getCalculatedArrowDims(geom?: Geometry): Size {
    const { placement } = geom || this.getGeom();
    const arrowSize = getArrowSize(placement, this.props.arrowStyle);
    switch (placement) {
      case Placement.LEFT:
      case Placement.RIGHT:
        arrowSize.height += 2;
        arrowSize.width = (arrowSize.width * 2) + 2;
        break;
      default:
        arrowSize.width += 2;
        arrowSize.height = (arrowSize.height * 2) + 2;
    }
    return arrowSize;
  }

  getArrowTranslateLocation(translatePoint: Point | null = null, geom: Geometry): Point {
    const { requestedContentSize } = this.state;
    const { anchorPoint, placement, forcedContentSize, viewLargerThanDisplayArea } = geom;
    const { width: arrowWidth, height: arrowHeight } = this.getCalculatedArrowDims(geom);

    let viewWidth = 0;
    if (viewLargerThanDisplayArea.width && forcedContentSize?.width)
      viewWidth = forcedContentSize.width;
    else if (requestedContentSize?.width)
      viewWidth = requestedContentSize.width;

    let viewHeight = 0;
    if (viewLargerThanDisplayArea.height && forcedContentSize?.height)
      viewHeight = forcedContentSize.height;
    else if (requestedContentSize?.height)
      viewHeight = requestedContentSize.height;

    let arrowX = anchorPoint.x - (arrowWidth / 2);
    let arrowY = anchorPoint.y - (arrowHeight / 2);

    const borderRadius = getBorderRadius(this.props.popoverStyle);

    // Ensuring that the arrow does not go outside the bounds of the content box during a move
    if (translatePoint) {
      if (placement === Placement.LEFT || placement === Placement.RIGHT) {
        if (translatePoint.y > (arrowY - borderRadius))
          arrowY = translatePoint.y + borderRadius;
        else if (viewHeight && translatePoint.y + viewHeight < arrowY + arrowHeight)
          arrowY = translatePoint.y + viewHeight - arrowHeight - borderRadius;
      } else if (placement === Placement.TOP || placement === Placement.BOTTOM) {
        if (translatePoint.x > arrowX - borderRadius)
          arrowX = translatePoint.x + borderRadius;
        else if (viewWidth && translatePoint.x + viewWidth < arrowX + arrowWidth)
          arrowX = translatePoint.x + viewWidth - arrowWidth - borderRadius;
      }
    }
    // eslint-disable-next-line
    return new Point(arrowX, FIX_SHIFT /* Temp fix for useNativeDriver issue */ + arrowY);
  }

  getTranslateOrigin() {
    const { requestedContentSize } = this.state;
    const {
      forcedContentSize,
      viewLargerThanDisplayArea,
      popoverOrigin,
      anchorPoint
    } = this.getGeom();

    let viewWidth = 0;
    if (viewLargerThanDisplayArea.width && forcedContentSize?.width)
      viewWidth = forcedContentSize.width;
    else if (requestedContentSize?.width)
      viewWidth = requestedContentSize.width;

    let viewHeight = 0;
    if (viewLargerThanDisplayArea.height && forcedContentSize?.height)
      viewHeight = forcedContentSize.height;
    else if (requestedContentSize?.height)
      viewHeight = requestedContentSize.height;


    const popoverCenter =
      new Point(popoverOrigin.x + (viewWidth / 2), popoverOrigin.y + (viewHeight / 2));
    const shiftHorizontal = anchorPoint.x - popoverCenter.x;
    const shiftVertical = anchorPoint.y - popoverCenter.y;

    this.debug('getTranslateOrigin - popoverOrigin', popoverOrigin);
    this.debug('getTranslateOrigin - popoverSize', { width: viewWidth, height: viewHeight });
    this.debug('getTranslateOrigin - anchorPoint', anchorPoint);
    this.debug('getTranslateOrigin - shift', { hoizontal: shiftHorizontal, vertical: shiftVertical });

    return new Point(popoverOrigin.x + shiftHorizontal, popoverOrigin.y + shiftVertical);
  }

  animateOut() {
    if (this.props.onCloseStart) setTimeout(this.props.onCloseStart);

    if (this._isMounted) this.setState({ showing: false });

    this.animateTo({
      values: this.state.animatedValues,
      fade: 0,
      scale: 0,
      translatePoint: this.getTranslateOrigin(),
      callback: () => setTimeout(this.props.onCloseComplete),
      easing: Easing.inOut(Easing.quad),
      geom: this.getGeom()
    });
  }

  animateIn() {
    const { nextGeom } = this.state;
    if (nextGeom !== undefined && nextGeom instanceof Geometry) {
      const values = this.state.animatedValues;

      // Should grow from anchor point
      const translateStart = this.getTranslateOrigin();
      // eslint-disable-next-line
      translateStart.y += FIX_SHIFT // Temp fix for useNativeDriver issue
      values.translate.setValue(translateStart);
      const translatePoint = new Point(nextGeom.popoverOrigin.x, nextGeom.popoverOrigin.y);
      values.translateArrow.setValue(this.getArrowTranslateLocation(translatePoint, nextGeom));

      this.animateTo({
        values,
        fade: 1,
        scale: 1,
        translatePoint,
        easing: Easing.out(Easing.back(1)),
        geom: nextGeom,
        callback: () => {
          if (this._isMounted) {
            this.setState({ showing: true });
            if (this.props.debug || DEBUG) {
              setTimeout(() =>
                this.popoverRef.current &&
                getRectForRef(this.popoverRef).then((rect: Rect) => this.debug('animateIn - onOpenComplete - Calculated Popover Rect', rect))
              );
              setTimeout(() =>
                this.arrowRef.current &&
                getRectForRef(this.arrowRef).then((rect: Rect) => this.debug('animateIn - onOpenComplete - Calculated Arrow Rect', rect))
              );
            }
          }
          if (this.props.onOpenComplete) setTimeout(this.props.onOpenComplete);
          if (this.animateOutAfterShow || !this._isMounted) {
            this.animateOut();
            this.animateOutAfterShow = false;
          }
        }
      });
    }
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
      },
      geom: Geometry
    }
  ) {
    const { fade, translatePoint, scale, callback, easing, values, geom } = args;
    const commonConfig = {
      duration: 300,
      easing,
      useNativeDriver: !isWeb,
      ...this.props.animationConfig
    };

    if (this.animating) {
      setTimeout(() => this.animateTo(args), 100);
      return;
    }

    const newArrowLocation = this.getArrowTranslateLocation(translatePoint, geom);

    // eslint-disable-next-line
    translatePoint.y = translatePoint.y + FIX_SHIFT // Temp fix for useNativeDriver issue

    if (!fade && fade !== 0) {
      console.log('Popover: Fade value is null');
      return;
    }
    if (!translatePoint) {
      console.log('Popover: Translate Point value is null');
      return;
    }
    if (!scale && scale !== 0) {
      console.log('Popover: Scale value is null');
      return;
    }
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
      if (this._isMounted) this.setState({ activeGeom: this.state.nextGeom });
      if (callback) callback();
    });
  }

  render() {
    const geom = this.getGeom();

    const { animatedValues, nextGeom }: Partial<BasePopoverState> = this.state;
    const { popoverStyle } = this.props;
    const { width: arrowWidth, height: arrowHeight } = this.getCalculatedArrowDims();

    const arrowScale = animatedValues.scale.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp'
    });

    const arrowViewStyle = {
      // eslint-disable-next-line
      position: 'absolute' as "absolute",
      top: 0,
      ...(I18nManager.isRTL ? { right: 0 } : { left: 0 }),
      width: arrowWidth,
      height: arrowHeight,
      transform: [
        { translateX: animatedValues.translateArrow.x },
        { translateY: animatedValues.translateArrow.y },
        { scale: arrowScale }
      ]
    };

    const arrowInnerStyle = [
      styles.arrow,
      this.getArrowDynamicStyle()
    ];

    // Temp fix for useNativeDriver issue
    const backgroundShift = animatedValues.fade.interpolate({
      inputRange: [0, 0.0001, 1],
      outputRange: [0, FIX_SHIFT, FIX_SHIFT]
    });

    const backgroundStyle = {
      ...styles.background,
      transform: [{ translateY: backgroundShift }],
      ...StyleSheet.flatten(this.props.backgroundStyle)
    };

    const containerStyle = {
      ...styles.container,
      opacity: animatedValues.fade
    };

    const popoverViewStyle = {
      ...styles.dropShadow,
      ...styles.popoverContent,
      ...StyleSheet.flatten(popoverStyle),
      transform: [
        { translateX: animatedValues.translate.x },
        { translateY: animatedValues.translate.y },
        { scale: animatedValues.scale },
        { perspective: 1000 }
      ]
    };

    /*
     * We want to always use next here, because the we need this to re-render
     * before we can animate to the correct spot for the active.
     */
    if (nextGeom) {
      popoverViewStyle.maxWidth =
        ((nextGeom as Geometry).forcedContentSize || { width: null }).width || undefined;
      popoverViewStyle.maxHeight =
        ((nextGeom as Geometry).forcedContentSize || { height: null }).height || undefined;
    }

    return (
      <View pointerEvents="box-none" style={[styles.container, { top: -1 * FIX_SHIFT }]}>
        <View
          pointerEvents="box-none"
          style={[styles.container, { top: FIX_SHIFT, flex: 1 }]}
          onLayout={evt => this.props.onDisplayAreaChanged(new Rect(
            evt.nativeEvent.layout.x,
            evt.nativeEvent.layout.y - FIX_SHIFT,
            evt.nativeEvent.layout.width,
            evt.nativeEvent.layout.height
          ))}
        />
        <Animated.View pointerEvents="box-none" style={containerStyle}>
          {this.props.showBackground !== false && (
            <TouchableWithoutFeedback onPress={this.props.onRequestClose}>
              <Animated.View style={backgroundStyle} />
            </TouchableWithoutFeedback>
          )}

          <View pointerEvents="box-none" style={{ top: 0, left: 0 }}>
            <Animated.View
              style={popoverViewStyle}
              ref={this.popoverRef}
              onLayout={(evt: LayoutChangeEvent) => {
                const layout = { ...evt.nativeEvent.layout };
                setTimeout(() => this._isMounted && this.measureContent(layout), 10);
              }}>
              {this.props.children}
            </Animated.View>

            {geom.placement !== Placement.CENTER &&
              <Animated.View style={arrowViewStyle} ref={this.arrowRef}>
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
    top: 0,
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
    flexDirection: 'column'
  },
  popoverContainer: {
    position: 'absolute',
    zIndex: 1000
  },
  popoverContent: {
    position: 'absolute',
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
    shadowOffset: {
      width: 0,
      height: 2
    },
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

