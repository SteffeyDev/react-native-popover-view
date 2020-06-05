'use strict';

import React, { Component, ReactNode } from 'react';
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
import { Rect, Point, Size, waitForNewRect, waitForChange, getRectForRef } from './Utility';

const noop = () => {};

const DEFAULT_ARROW_SIZE = new Size(16, 8);
const DEFAULT_BORDER_RADIUS = 3;
const FIX_SHIFT = Dimensions.get('window').height * 2;

const isIOS = Platform.OS === 'ios';

const DEBUG = false;
const MULTIPLE_POPOVER_WARNING = "Popover Warning - Can't Show - Attempted to show a Popover while another one was already showing.  You can only show one Popover at a time, and must wait for one to close completely before showing a different one.  You can use the onCloseComplete prop to detect when a Popover has finished closing.  To show multiple Popovers simultaneously, all but one should have mode={Popover.MODE.JS_MODAL}.  Once you change the mode, you can show as many Popovers as you want, but you are responsible for keeping them above other views.";

export enum PLACEMENT_OPTIONS {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
  AUTO = 'auto',
  CENTER = 'center'
}

export enum POPOVER_MODE {
  JS_MODAL = 'js-modal',
  RN_MODAL = 'rn-modal',
  TOOLTIP = 'tooltip'
}

type ComputeGeometryType = {
  requestedContentSize: Size;
  displayArea: Rect;
  fromRect: Rect;
};

type GeometryType = {
  popoverOrigin: Point;
  anchorPoint: Point;
  placement: PLACEMENT_OPTIONS;
  forcedContentSize: Size | null;
  viewLargerThanDisplayArea: {
    width: boolean,
    height: boolean
  }
}

interface Props {
  // display
  isVisible?: boolean;
  mode: POPOVER_MODE;

  // anchor
  from?: Rect | ((displayArea: Rect) => Rect) | ReactNode;

  // config
  displayArea?: Rect;
  placement: PLACEMENT_OPTIONS;
  animationConfig?: Partial<Animated.TimingAnimationConfig>;
  verticalOffset: number;
  statusBarTranslucent?: boolean;
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

interface State {
  requestedContentSize: Size | null;
  forcedContentSize: Size | null;
  viewLargerThanDisplayArea: { width: boolean, height: boolean };
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
    scale: Animated.Value,
    translate: Animated.ValueXY,
    fade: Animated.Value,
    translateArrow: Animated.ValueXY
  }
}

export default class Popover extends Component<Props, State> {
  static propTypes = {
    // display
    isVisible: PropTypes.bool,
    mode: PropTypes.oneOf([POPOVER_MODE.JS_MODAL, POPOVER_MODE.RN_MODAL, POPOVER_MODE.TOOLTIP]),

    // anchor
    from: PropTypes.oneOf([
      PropTypes.func,
      PropTypes.element,
      PropTypes.instanceOf(Rect),
      PropTypes.shape({ current: PropTypes.any }),
      PropTypes.exact({ x: PropTypes.number, y: PropTypes.number, width: PropTypes.number, height: PropTypes.number })
    ]),

    // config
    displayArea: PropTypes.oneOf([PropTypes.instanceOf(Rect), PropTypes.exact({ x: PropTypes.number, y: PropTypes.number, width: PropTypes.number, height: PropTypes.number })]),
    placement: PropTypes.oneOf([PLACEMENT_OPTIONS.LEFT, PLACEMENT_OPTIONS.RIGHT, PLACEMENT_OPTIONS.TOP, PLACEMENT_OPTIONS.BOTTOM, PLACEMENT_OPTIONS.AUTO, PLACEMENT_OPTIONS.CENTER]),
    animationConfig: PropTypes.object,
    verticalOffset: PropTypes.number,
    statusBarTranslucent: PropTypes.bool,
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

    debug: PropTypes.bool
  }

  static defaultProps = {
    mode: POPOVER_MODE.RN_MODAL,
    placement: PLACEMENT_OPTIONS.AUTO,
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
    shiftedDisplayArea: null,
    defaultDisplayArea: null,
    displayAreaOffset: null,
    placement: PLACEMENT_OPTIONS.AUTO,
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

  private static isShowingInModal: boolean = false;
  private skipNextDefaultDisplayArea: boolean = false;
  private waitForResizeToFinish: boolean = false;
  private displayAreaStore: Rect | undefined;
  private _isMounted: boolean = false;
  private updateCount: number = 0;
  private animating: boolean = false;
  private animateOutAfterShow: boolean = false;

  private containerRef = React.createRef<View>();
  private popoverRef = React.createRef<View>();

  private measureContentTimeout: any;
  private keyboardDidShowListener: any;
  private keyboardDidHideListener: any;

  debug(line: string, obj?: any): void {
    if (DEBUG || this.props.debug)
      console.log(line + (obj ? ": " + JSON.stringify(obj) : ''));
  }

  async getDisplayAreaOffset(): Promise<Point> {
    // If we aren't showing in RN Modal, we have no guarantee that we have the whole screen, so need to adapt to that
    if (this.props.mode !== POPOVER_MODE.RN_MODAL) {
      const rect = await getRectForRef(this.containerRef)
      return new Point(rect.x, rect.y + FIX_SHIFT);
    } else {
      return new Point(0, 0);
    }
  }

  setDefaultDisplayArea(newDisplayArea: Rect) {
    const { fromRect, defaultDisplayArea }: Partial<State> = this.state;
    // When the popover is closing and the display area's onLayout event is called, the width/height values may be zero
    // which causes a bad display area for the first mount when the popover re-opens
    const isValidDisplayArea = newDisplayArea.width > 0 && newDisplayArea.height > 0;
    if ((!defaultDisplayArea || !Rect.equals(defaultDisplayArea, newDisplayArea)) && isValidDisplayArea) {
      this.debug("setDefaultDisplayArea - newDisplayArea", newDisplayArea);
      if (!this.skipNextDefaultDisplayArea) {
        this.getDisplayAreaOffset().then(displayAreaOffset => {
          this.debug("setDefaultDisplayArea - displayAreaOffset", displayAreaOffset);
          this.setState({ defaultDisplayArea: newDisplayArea, displayAreaOffset }, () => {
            this.calculateRect().then(newFromRect => {
              this.debug("setDefaultDisplayArea (inside calculateRect callback) - fromRect", newFromRect);
              this.debug("setDefaultDisplayArea (inside calculateRect callback) - getDisplayArea()", this.getDisplayArea());
              this.debug("setDefaultDisplayArea (inside calculateRect callback) - displayAreaStore", this.displayAreaStore);

              if (
                (
                  (!fromRect && !!newFromRect) ||
                  (!!fromRect && !newFromRect) ||
                  (newFromRect && fromRect && !Rect.equals(newFromRect, fromRect!))
                ) ||
                (!this.displayAreaStore || !Rect.equals(this.getDisplayArea(), this.displayAreaStore))
              ) {
                this.displayAreaStore = this.getDisplayArea();
                if (this.state.visible && !this.state.isAwaitingShow) {
                  this.debug("setDefaultDisplayArea (inside calculateRect callback) - Triggering state update");
                  this.setState({ fromRect: newFromRect }, () => {
                    this.handleGeomChange();
                    this.waitForResizeToFinish = false;
                  });
                }
              }
            });
          });
        });
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

    // On android, the keyboard update causes a default display area change, so no need to manually trigger
    this.setState({shiftedDisplayArea: null}, () => isIOS && this.handleGeomChange());
  }

  shiftForKeyboard(keyboardHeight: number) {
    const displayArea = this.getDisplayArea();

    const absoluteVerticalCutoff = Dimensions.get('window').height - keyboardHeight - (isIOS ? 10 : 40);
    const combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);

    this.setState({shiftedDisplayArea: {
      x: displayArea.x,
      y: displayArea.y,
      width: displayArea.width,
      height: combinedY - displayArea.y
    }}, () => this.handleGeomChange());
  }

  componentDidMount() {

    // This is used so that when the device is rotating or the viewport is expanding for any other reason,
    //  we can suspend updates due to content changes until we are finished calculating the new display
    //  area and rect for the new viewport size
    // This makes the recalc on rotation much faster
    this.waitForResizeToFinish = false;

    // Show popover if isVisible is initially true
    if (this.props.isVisible) {
      if (!Popover.isShowingInModal) {
        const { from } = this.props;
        setTimeout(() => this.calculateRect().then(fromRect => (fromRect || !(from && from.hasOwnProperty('current'))) && this.setState({fromRect, isAwaitingShow: true, visible: true})), 0);
        if (this.props.mode === POPOVER_MODE.RN_MODAL) Popover.isShowingInModal = true;
      } else {
        console.warn(MULTIPLE_POPOVER_WARNING);
      }
    }

    Dimensions.addEventListener('change', this.handleResizeEvent)

    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;

    if (this.state.visible) {
      this.animateOut();
    } else {
      setTimeout(this.props.onCloseStart);
      setTimeout(this.props.onCloseComplete);
    }

    Dimensions.removeEventListener('change', this.handleResizeEvent)
  }

  // First thing called when device rotates
  handleResizeEvent = (change: any) => {
    this.debug("handleResizeEvent - New Dimensions", change);
    if (this.props.isVisible) {
      this.waitForResizeToFinish = true;
    }
  }

  measureContent(requestedContentSize: Size): void {
    if (!requestedContentSize.width) console.warn("Popover Warning - Can't Show - The Popover content has a width of 0, so there is nothing to present.");
    if (!requestedContentSize.height) console.warn("Popover Warning - Can't Show - The Popover content has a height of 0, so there is nothing to present.");
    if (this.waitForResizeToFinish) this.debug("measureContent - Waiting for resize to finish");

    const lastRequestedContentSize: Rect | null = this.state.requestedContentSize;

    if (requestedContentSize.width && requestedContentSize.height && !this.waitForResizeToFinish) {
      if (this.state.isAwaitingShow) {
        const { from } = this.props;
        if ((from && from.hasOwnProperty('current') && !this.state.fromRect) || !this.getDisplayArea()) {
          this.debug("measureContent - Waiting " + (this.getDisplayArea() ? "for Rect" : "for Display Area") + " - requestedContentSize", requestedContentSize);
          setTimeout(() => this.measureContent(requestedContentSize), 100);
        } else {
          this.debug("measureContent - Showing Popover - requestedContentSize", requestedContentSize);
          let geom = this.computeGeometry({ requestedContentSize });
          this.debug("measureContent - Showing Popover - geom", geom);

          // If the view initially overflowed the display area, wait one more render cycle to test-render it within the display area to get
          //  final calculations for popoverOrigin before show
          if (geom.viewLargerThanDisplayArea.width || geom.viewLargerThanDisplayArea.height) {
            this.debug("measureContent - Delaying showing popover because viewLargerThanDisplayArea");
            this.setState({ ...geom, requestedContentSize });
          } else {

            // If showing in a modal, the onOpenStart callback will be called from the modal onShow callback
            if (this.props.mode !== POPOVER_MODE.RN_MODAL)
              setTimeout(this.props.onOpenStart);

            this.debug("measureContent - Showing Popover - Animating In");
            this.setState({ ...geom, requestedContentSize, isAwaitingShow: false }, () => this.animateIn());
          }
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

  computeGeometry({ requestedContentSize, placement, fromRect, displayArea }: { requestedContentSize: Size, placement?: PLACEMENT_OPTIONS, fromRect?: Rect, displayArea?: Rect }) {
    placement = placement || this.props.placement;
    if (!fromRect) {
      const currentFromRect = this.state.fromRect;
      if (this.props.from instanceof Rect)
        fromRect = this.props.from;
      else if (currentFromRect != null)
        fromRect = currentFromRect;
    }
    displayArea = displayArea || { ...this.getDisplayArea() };

    this.debug("computeGeometry - displayArea", displayArea);
    this.debug("computeGeometry - fromRect", fromRect);
    this.debug("computeGeometry - placement", placement.toString());

    let newGeom = null;

    if (fromRect && fromRect instanceof Rect) {
      //check to see if fromRect is outside of displayArea, and adjust if it is
      if (fromRect.x > displayArea.x + displayArea.width) fromRect.x = displayArea.x + displayArea.width;
      if (fromRect.y > displayArea.y + displayArea.height) fromRect.y = displayArea.y + displayArea.height;
      if (fromRect.x < 0) fromRect.x = -1 * fromRect.width;
      if (fromRect.y < 0) fromRect.y = -1 * fromRect.height;

      var options = {
        displayArea,
        fromRect,
        requestedContentSize
      }

      switch (placement) {
        case PLACEMENT_OPTIONS.TOP:
          newGeom = this.computeTopGeometry(options);
          break;
        case PLACEMENT_OPTIONS.BOTTOM:
          newGeom = this.computeBottomGeometry(options);
          break;
        case PLACEMENT_OPTIONS.LEFT:
          newGeom = this.computeLeftGeometry(options);
          break;
        case PLACEMENT_OPTIONS.RIGHT:
          newGeom = this.computeRightGeometry(options);
          break;
        case PLACEMENT_OPTIONS.CENTER:
          newGeom = null;
          break;
        default:
          newGeom = this.computeAutoGeometry(options);
          this.debug("computeGeometry - chosen auto geometry", newGeom);
      }

      // If the popover will be restricted and the view that the popover is showing from is sufficiently large, try to show the popover inside the view
      if (newGeom && (newGeom.viewLargerThanDisplayArea.width || newGeom.viewLargerThanDisplayArea.height)) {
        let fromRectHeightVisible = fromRect.y < displayArea.y
          ? fromRect.height - (displayArea.y - fromRect.y)
          : displayArea.y + displayArea.height - fromRect.y;
        if (fromRect.width > requestedContentSize.width && fromRectHeightVisible > requestedContentSize.height) {
          let preferedX = Math.max(fromRect.x + 10, fromRect.x + (fromRect.width - requestedContentSize.width)/2);
          let preferedY = Math.max(fromRect.y + 10, fromRect.y + (fromRect.height - requestedContentSize.height)/2);

          let constrainedX = Math.max(preferedX, displayArea.x);
          if (constrainedX + requestedContentSize.width > displayArea.x + displayArea.width)
            constrainedX = displayArea.x + displayArea.width - requestedContentSize.width;

          let constrainedY = Math.max(preferedY, displayArea.y);
          if (constrainedY + requestedContentSize.height > displayArea.y + displayArea.height)
            constrainedY = displayArea.y + displayArea.height - requestedContentSize.height;

          let forcedContentSize = {
            width: Math.min(fromRect.width - 20, displayArea.width),
            height: Math.min(fromRect.height - 20, displayArea.height)
          }

          this.debug("computeGeometry - showing inside anchor");
          newGeom = {
            popoverOrigin: new Point(constrainedX, constrainedY),
            anchorPoint: new Point(fromRect.x + (fromRect.width/2), fromRect.y + (fromRect.height/2)),
            placement: PLACEMENT_OPTIONS.CENTER,
            forcedContentSize,
            viewLargerThanDisplayArea: {
              width: requestedContentSize.width > forcedContentSize.width,
              height: requestedContentSize.height > forcedContentSize.height
            }
          }
        }
        else if (placement === PLACEMENT_OPTIONS.AUTO) {
          // If we can't fit inside or outside the fromRect, show the popover centered on the screen,
          //  but only do this if they haven't asked for a specifc placement type
          newGeom = null;
        }
      }
    }

    
    if (!newGeom) {
      const minY = displayArea.y;
      const minX = displayArea.x;
      const preferedY = (displayArea.height - requestedContentSize.height)/2 + displayArea.y;
      const preferedX = (displayArea.width - requestedContentSize.width)/2 + displayArea.x;

      this.debug("computeGeometry - showing centered on screen");
      newGeom = {
        popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
        anchorPoint: new Point(displayArea.width/2 + displayArea.x, displayArea.height/2 + displayArea.y),
        placement: PLACEMENT_OPTIONS.CENTER,
        forcedContentSize: {
          width: displayArea.width,
          height: displayArea.height
        },
        viewLargerThanDisplayArea: {
          width: preferedX < minX - 1,
          height: preferedY < minY - 1
        }
      }
    }

    return newGeom;
  }

  computeTopGeometry({displayArea, fromRect, requestedContentSize}: ComputeGeometryType): GeometryType {
    let minY = displayArea.y;
    const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.TOP);
    let preferedY = fromRect.y - requestedContentSize.height - arrowSize.height;

    let forcedContentSize = {
      height: (fromRect.y - arrowSize.height - displayArea.y),
      width: displayArea.width
    }

    let viewLargerThanDisplayArea = {
      height: preferedY < minY - 1,
      width: requestedContentSize.width > displayArea.width + 1
    }

    let viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width;

    let maxX = displayArea.x + displayArea.width - viewWidth;
    let minX = displayArea.x;
    let preferedX = fromRect.x + (fromRect.width - viewWidth) / 2;

    var popoverOrigin = new Point(
      Math.min(maxX, Math.max(minX, preferedX)),
      Math.max(minY, preferedY)
    );

    var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y);

    // Make sure the arrow isn't cut off
    anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + this.getBorderRadius());
    anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - this.getBorderRadius());

    return {
      popoverOrigin,
      anchorPoint,
      placement: PLACEMENT_OPTIONS.TOP,
      forcedContentSize,
      viewLargerThanDisplayArea
    }
  }

  computeBottomGeometry({displayArea, fromRect, requestedContentSize}: ComputeGeometryType): GeometryType {
    const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.BOTTOM);
    let preferedY = fromRect.y + fromRect.height + arrowSize.height;

    let forcedContentSize = {
      height: displayArea.y + displayArea.height - preferedY,
      width: displayArea.width
    }

    let viewLargerThanDisplayArea = {
      height: preferedY + requestedContentSize.height > displayArea.y + displayArea.height + 1,
      width: requestedContentSize.width > displayArea.width + 1
    }

    let viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width;

    let maxX = displayArea.x + displayArea.width - viewWidth;
    let minX = displayArea.x;
    let preferedX = fromRect.x + (fromRect.width - viewWidth) / 2;

    var popoverOrigin = new Point(
      Math.min(maxX, Math.max(minX, preferedX)),
      preferedY
    );

    var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y + fromRect.height);

    // Make sure the arrow isn't cut off
    anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + this.getBorderRadius());
    anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - this.getBorderRadius());

    return {
      popoverOrigin,
      anchorPoint,
      placement: PLACEMENT_OPTIONS.BOTTOM,
      forcedContentSize,
      viewLargerThanDisplayArea
    }
  }

  getPolarity () {
    return I18nManager.isRTL ? -1 : 1;
  }

  computeLeftGeometry({displayArea, fromRect, requestedContentSize}: ComputeGeometryType): GeometryType {
    const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.LEFT);

    let forcedContentSize = {
      height: displayArea.height,
      width: fromRect.x - displayArea.x - arrowSize.width
    }

    let viewLargerThanDisplayArea = {
      height: requestedContentSize.height > displayArea.height + 1,
      width: requestedContentSize.width > fromRect.x - displayArea.x - arrowSize.width + 1
    }

    let viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width;
    let viewHeight = viewLargerThanDisplayArea.height ? forcedContentSize.height : requestedContentSize.height;

    let preferedX = fromRect.x - viewWidth - arrowSize.width;

    let preferedY = fromRect.y + (fromRect.height - viewHeight) / 2;
    let minY = displayArea.y;
    let maxY = (displayArea.height - viewHeight) + displayArea.y;

    var popoverOrigin = new Point(
      preferedX,
      Math.min(Math.max(minY, preferedY), maxY)
    );

    var anchorPoint = new Point(fromRect.x, fromRect.y + fromRect.height / 2.0);

    // Make sure the arrow isn't cut off
    anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + this.getBorderRadius());
    anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - this.getBorderRadius());

    return {
      popoverOrigin,
      anchorPoint,
      placement: PLACEMENT_OPTIONS.LEFT,
      forcedContentSize,
      viewLargerThanDisplayArea
    }
  }

  computeRightGeometry({displayArea, fromRect, requestedContentSize}: ComputeGeometryType): GeometryType {
    const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.RIGHT);
    let horizontalSpace = displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width;

    let forcedContentSize = {
      height: displayArea.height,
      width: horizontalSpace
    }

    let viewLargerThanDisplayArea = {
      height: requestedContentSize.height > displayArea.height + 1,
      width: requestedContentSize.width > horizontalSpace + 1
    }

    let viewHeight = viewLargerThanDisplayArea.height ? forcedContentSize.height : requestedContentSize.height;

    let preferedX = fromRect.x + fromRect.width + arrowSize.width;

    let preferedY = fromRect.y + (fromRect.height - viewHeight) / 2;
    let minY = displayArea.y;
    let maxY = (displayArea.height - viewHeight) + displayArea.y;

    var popoverOrigin = new Point(
      preferedX,
      Math.min(Math.max(minY, preferedY), maxY)
    );

    var anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + fromRect.height / 2.0);

    // Make sure the arrow isn't cut off
    anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + this.getBorderRadius());
    anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - this.getBorderRadius());

    return {
      popoverOrigin,
      anchorPoint,
      placement: PLACEMENT_OPTIONS.RIGHT,
      forcedContentSize,
      viewLargerThanDisplayArea
    }
  }

  computeAutoGeometry({displayArea, requestedContentSize, fromRect}: ComputeGeometryType): GeometryType {

    // Keep same placement if possible (left/right)
    if (this.state.placement === PLACEMENT_OPTIONS.LEFT || this.state.placement === PLACEMENT_OPTIONS.RIGHT) {
      const geom = this.state.placement === PLACEMENT_OPTIONS.LEFT
        ? this.computeLeftGeometry({requestedContentSize, fromRect, displayArea})
        : this.computeRightGeometry({requestedContentSize, fromRect, displayArea})
      this.debug("computeAutoGeometry - Left/right tryping to keep same, geometry", geom);
      if (!geom.viewLargerThanDisplayArea.width) return geom;
    }

    // Keep same placement if possible (top/bottom)
    if (this.state.placement === PLACEMENT_OPTIONS.TOP || this.state.placement === PLACEMENT_OPTIONS.BOTTOM) {
      const geom = this.state.placement === PLACEMENT_OPTIONS.TOP
        ? this.computeTopGeometry({requestedContentSize, fromRect, displayArea})
        : this.computeBottomGeometry({requestedContentSize, fromRect, displayArea})
      this.debug("computeAutoGeometry - Top/bottom tryping to keep same, geometry", geom);
      if (!geom.viewLargerThanDisplayArea.height) return geom;
    }

    // Otherwise, find the place that can fit it best (try left/right but default to top/bottom as that will typically have more space
    const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.LEFT);

    // If it fits on left, choose left
    if (fromRect.x - displayArea.x - arrowSize.width >= requestedContentSize.width) { // We could fit it on the left side
      this.debug("computeAutoGeometry - could fit on left side");
      return this.computeLeftGeometry({requestedContentSize, fromRect, displayArea});
    }

    // If it fits on right, choose right
    if (displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width >= requestedContentSize.width) { // We could fit it on the right side
      this.debug("computeAutoGeometry - could fit on right side");
      return this.computeRightGeometry({requestedContentSize, fromRect, displayArea});
    }

    // We could fit it on the top or bottom, need to figure out which is better
    let topSpace = fromRect.y - displayArea.y;
    let bottomSpace = displayArea.y + displayArea.height - (fromRect.y + fromRect.height);
    this.debug("computeAutoGeometry - Top/bottom picking best, top space", topSpace);
    return (topSpace - 50) > bottomSpace ? this.computeTopGeometry({requestedContentSize, fromRect, displayArea}) : this.computeBottomGeometry({requestedContentSize, fromRect, displayArea});
  }

  getArrowSize(placement: PLACEMENT_OPTIONS) {
    let width = StyleSheet.flatten(this.props.arrowStyle).width;
    if (typeof width !== "number") width = DEFAULT_ARROW_SIZE.width;
    let height = StyleSheet.flatten(this.props.arrowStyle).height;
    if (typeof height !== "number") height = DEFAULT_ARROW_SIZE.height;
    switch(placement) {
      case PLACEMENT_OPTIONS.LEFT:
      case PLACEMENT_OPTIONS.RIGHT:
        return new Size(height, width);
      default:
        return new Size(width, height);
    }
  }

  getArrowDynamicStyle() {
    const { placement } = this.state;
    const { arrowStyle, popoverStyle } = this.props;
    const {  width, height } = this.getCalculatedArrowDims();

    const backgroundColor = StyleSheet.flatten(arrowStyle).backgroundColor || StyleSheet.flatten(popoverStyle).backgroundColor || styles.popoverContent.backgroundColor;
    let colors = {};
    switch (placement) {
      case PLACEMENT_OPTIONS.TOP:
        colors = { borderTopColor: backgroundColor };
        break;
      case PLACEMENT_OPTIONS.BOTTOM:
        colors = { borderBottomColor: backgroundColor };
        break;
      case PLACEMENT_OPTIONS.LEFT:
        colors = { borderLeftColor: backgroundColor };
        break;
      case PLACEMENT_OPTIONS.RIGHT:
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
    const arrowSize = this.getArrowSize(placement);
    arrowSize.width += 2
    arrowSize.height = arrowSize.height * 2 + 2;
    return arrowSize;
  }

  getBorderRadius(): number {
    if (StyleSheet.flatten(this.props.popoverStyle).borderRadius === 0) return 0;
    return StyleSheet.flatten(this.props.popoverStyle).borderRadius || DEFAULT_BORDER_RADIUS;
  }

  getArrowTranslateLocation(translatePoint: Point | null = null): Point {
    const { anchorPoint, placement, forcedContentSize, viewLargerThanDisplayArea, requestedContentSize }: Partial<State> = this.state;
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

    // Ensuring that the arrow does not go outside the bounds of the content box during a move
    if (translatePoint) {
      if (placement === PLACEMENT_OPTIONS.LEFT || placement === PLACEMENT_OPTIONS.RIGHT) {
        if (translatePoint.y > (arrowY - this.getBorderRadius()))
          arrowY = translatePoint.y + this.getBorderRadius()
        else if (viewHeight && translatePoint.y + viewHeight < arrowY + arrowHeight)
          arrowY = translatePoint.y + viewHeight - arrowHeight - this.getBorderRadius()
      } else if (placement === PLACEMENT_OPTIONS.TOP || placement === PLACEMENT_OPTIONS.BOTTOM) {
        if (translatePoint.x > arrowX - this.getBorderRadius())
          arrowX = translatePoint.x + this.getBorderRadius()
        else if (viewWidth && translatePoint.x + viewWidth < arrowX + arrowWidth)
          arrowX = translatePoint.x + viewWidth - arrowWidth - this.getBorderRadius()
      }
    }
    return new Point(arrowX, (FIX_SHIFT*2) /* Temp fix for useNativeDriver issue */ + arrowY);
  }

  getTranslateOrigin() {
    const {forcedContentSize, viewLargerThanDisplayArea, requestedContentSize, popoverOrigin, anchorPoint}: Partial<State> = this.state;

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

  getDisplayArea(): Rect {
    return this.state.shiftedDisplayArea || this.props.displayArea || this.state.defaultDisplayArea || new Rect(10, 10, Dimensions.get('window').width - 20, Dimensions.get('window').height - 20);
  }

  componentDidUpdate(prevProps: Props) {

    // Make sure a value we care about has actually changed
    let importantProps = ["isVisible", "fromRect", "displayArea", "verticalOffset", "placement"]
    if (!importantProps.reduce((acc, key) => acc || this.props[key] !== prevProps[key], false))
      return;

    if (this.props.isVisible !== prevProps.isVisible) {
      if (this.props.isVisible) {
        this.debug("componentDidUpdate - isVisible changed, now true");
        // We want to start the show animation only when contentSize is known
        // so that we can have some logic depending on the geometry
        if (!Popover.isShowingInModal) {
          this.debug("componentDidUpdate - setting visible and awaiting calculations");
          this.calculateRect().then(fromRect => this.setState({ fromRect, isAwaitingShow: true, visible: true }));
          if (this.props.mode === POPOVER_MODE.RN_MODAL) Popover.isShowingInModal = true;
        } else {
          console.warn(MULTIPLE_POPOVER_WARNING);
        }
      } else {
        this.debug("componentDidUpdate - isVisible changed, now false");
        if (this.state.visible) {
          if (this.state.showing)
            this.animateOut();
          else
            this.animateOutAfterShow = true;
          this.debug("componentDidUpdate - Hiding popover");
        } else {
          setTimeout(this.props.onCloseStart);
          setTimeout(this.props.onCloseComplete);
          this.debug("componentDidUpdate - Popover never shown");
        }
      }
    } else if (this.props.isVisible && prevProps.isVisible) {
      this.calculateRect().then(newFromRect => {
        const { fromRect }: Partial<State> = this.state;
        const { displayArea }: Partial<Props> = this.props;
        if ((fromRect && newFromRect && !Rect.equals(newFromRect, fromRect))
            || (this.props.displayArea && !prevProps.displayArea)
            || (displayArea && prevProps.displayArea && !Rect.equals(displayArea, prevProps.displayArea))
            || (this.displayAreaStore && !Rect.equals(this.getDisplayArea(), this.displayAreaStore))) {
          this.displayAreaStore = this.getDisplayArea();
          this.setState({ fromRect: newFromRect }, () => this.handleGeomChange());
        }
      })
    }
  }

  async calculateRect(): Promise<Rect | null> {
    const { displayAreaOffset }: Partial<State> = this.state;
    const { from } = this.props;
    let initialRect = this.state.fromRect || new Rect(0, 0, 0, 0);
    let displayArea = this.props.displayArea || this.getDisplayArea();

    if (!from) return null;

    if (this.props.from instanceof Rect) {
      return this.props.from;
    }

    if (from instanceof Function) {
      await waitForChange(() => Promise.resolve(from(displayArea)), () => Promise.resolve(initialRect))
      return from(displayArea);
    }

    if (from.hasOwnProperty('curent')) {
      const verticalOffset = this.props.verticalOffset + (displayAreaOffset ? -1 * displayAreaOffset!.y : 0);
      const horizontalOffset = displayAreaOffset ? -1 * displayAreaOffset!.x : 0;
      const rect = await waitForNewRect(this.props.from, initialRect)
      return new Rect(rect.x + horizontalOffset, rect.y + verticalOffset, rect.width, rect.height);
    }

    console.error('Popover "from" prop not a supported type');
    return null;
  }

  handleGeomChange(requestedContentSize?: Size) {
    const { forcedContentSize, popoverOrigin, animatedValues, requestedContentSize: lastRequestedContentSize }: Partial<State> = this.state;
    if (!requestedContentSize) {
      if (lastRequestedContentSize) requestedContentSize = lastRequestedContentSize;
      else return;
    }

    this.debug("handleGeomChange - requestedContentSize: ", requestedContentSize);

    // handleGeomChange may be called more than one times before the first has a chance to finish,
    //  so we use updateCount to make sure that we only trigger an animation on the last one
    if (!this.updateCount || this.updateCount < 0) this.updateCount = 0;
    this.updateCount++;

    let geom = this.computeGeometry({ requestedContentSize });

    if (
      !Point.equals(geom.popoverOrigin, popoverOrigin) ||
      (!geom.forcedContentSize && forcedContentSize) ||
      (!forcedContentSize && geom.forcedContentSize) ||
      (geom.forcedContentSize && forcedContentSize && !Size.equals(geom.forcedContentSize, forcedContentSize))
    ) {
      this.setState({ ...geom, requestedContentSize}, () => {
        if (this.updateCount <= 1) {
          this.updateCount--;
          let moveTo = new Point(geom.popoverOrigin.x, geom.popoverOrigin.y);
          this.debug("handleGeomChange - Triggering popover move to", moveTo);
          this.animateTo({
            values: animatedValues,
            fade: 1,
            scale: 1,
            translatePoint: moveTo,
            easing: Easing.inOut(Easing.quad)
          });
        }
      });
    }
  }

  animateOut() {
    setTimeout(this.props.onCloseStart);
    this.keyboardDidShowListener && this.keyboardDidShowListener.remove();
    this.keyboardDidHideListener && this.keyboardDidHideListener.remove();

    // Animation callback may or may not get called if animation is cut short, so calling this a bit early for safety
    if (this.props.mode === POPOVER_MODE.RN_MODAL) Popover.isShowingInModal = false;

    this.setState({shiftedDisplayArea: null, showing: false});

    this.animateTo({
      values: this.state.animatedValues,
      fade: 0,
      scale: 0,
      translatePoint: this.getTranslateOrigin(),
      callback: () => {
        const onCloseComplete = () => {
          // If showing in an RN modal, the onCloseComplete callback will be called from the Modal onDismiss callback (on iOS only)
          if (this.props.mode !== POPOVER_MODE.RN_MODAL || !isIOS)
            this.props.onCloseComplete()
        }

        if (this._isMounted) this.setState({ visible: false, forcedContentSize: null }, onCloseComplete)
        else onCloseComplete();
      },
      easing: Easing.inOut(Easing.quad)
    });
  }

  animateIn() {
    var values = this.state.animatedValues;

    this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow.bind(this));
    this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide.bind(this));
    this.displayAreaStore = this.getDisplayArea();

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
          this.setState({showing: true});
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

    let contentView = (
      <View pointerEvents="box-none" style={[styles.container, {left: 0}]} ref={this.containerRef}>
        <SafeAreaView pointerEvents="none" forceInset={this.props.safeAreaInsets} style={{position: 'absolute', top: FIX_SHIFT, left: 0, right: 0, bottom: 0}}>
          <TouchableWithoutFeedback style={{flex: 1}} onLayout={
            evt => this.setDefaultDisplayArea(
              new Rect(
                evt.nativeEvent.layout.x + 10,
                evt.nativeEvent.layout.y + 10,
                evt.nativeEvent.layout.width - 20,
                evt.nativeEvent.layout.height - 20)
              )
          }>
            <View style={{flex: 1}} />
          </TouchableWithoutFeedback>
        </SafeAreaView>

        <Animated.View pointerEvents="box-none" style={containerStyle}>
          {this.props.mode !== POPOVER_MODE.TOOLTIP && (
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

            {!isAwaitingShow && this.state.placement !== PLACEMENT_OPTIONS.CENTER &&
              <Animated.View style={arrowViewStyle}>
                <Animated.View style={arrowInnerStyle} />
              </Animated.View>
            }
          </View>
        </Animated.View>
      </View>
    );

    if (this.props.mode === POPOVER_MODE.RN_MODAL) {
      return (
        <Modal
          transparent={true}
          supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}
          hardwareAccelerated={true}
          visible={this.state.visible}
          statusBarTranslucent={this.props.statusBarTranslucent}
          onShow={this.props.onOpenStart}
          onDismiss={this.props.onCloseComplete}
          onRequestClose={this.props.onRequestClose}>
          {contentView}
        </Modal>
      );
    } else if (this.state.visible) {
      return contentView;
    } else {
      return null;
    }
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
