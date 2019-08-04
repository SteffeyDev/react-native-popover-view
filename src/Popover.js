'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import SafeAreaView from 'react-native-safe-area-view';
import { Platform, Dimensions, Animated, TouchableWithoutFeedback, View, Modal, Keyboard, Easing, I18nManager } from 'react-native';
import { Rect, Point, Size, isRect, isPoint, rectChanged, pointChanged, waitForNewRect, runAfterChange, getRectForRef } from './Utility';

const noop = () => {};

const DEFAULT_ARROW_SIZE = new Size(16, 8);
const DEFAULT_BORDER_RADIUS = 3;
const FIX_SHIFT = Dimensions.get('window').height * 2;

const isIOS = Platform.OS === 'ios';

const DEBUG = false;
const MULTIPLE_POPOVER_WARNING = "Popover Warning - Can't Show - Attempted to show a Popover while another one was already showing.  You can only show one Popover at a time, and must wait for one to close completely before showing a different one.  You can use the onCloseComplete prop to detect when a Popover has finished closing.  To show multiple Popovers simultaneously, all but one should have mode={Popover.MODE.JS_MODAL}.  Once you change the mode, you can show as many Popovers as you want, but you are responsible for keeping them above other views."

const PLACEMENT_OPTIONS = Object.freeze({
  TOP: 'top',
  RIGHT: 'right',
  BOTTOM: 'bottom',
  LEFT: 'left',
  AUTO: 'auto'
});

const POPOVER_MODE = Object.freeze({
  JS_MODAL: 'js-modal',
  RN_MODAL: 'rn-modal',
  TOOLTIP: 'tooltip'
});

class Popover extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      requestedContentSize: {},
      forcedContentSize: {},
      viewLargerThanDisplayArea: {
        width: false,
        height: false
      },
      anchorPoint: new Point(0, 0),
      popoverOrigin: {},
      forcedHeight: null,
      shiftedDisplayArea: null,
      defaultDisplayArea: null,
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
    };

    this.measureContent = this.measureContent.bind(this);
    this.animateIn = this.animateIn.bind(this);
  }

  debug(line, obj) {
    if (DEBUG || this.props.debug)
      console.log(line + (obj ? ": " + JSON.stringify(obj) : ''));
  }

  getDisplayAreaOffset(displayArea, callback) {
    // If we aren't shoowing in RN Modal, we have no guarantee that we have the whole screen, so need to adapt to that
    if (this.props.mode !== POPOVER_MODE.RN_MODAL) {
      getRectForRef(this.containerRef, rect => callback(new Point(rect.x, rect.y + FIX_SHIFT)));
    } else {
      callback(new Point(0, 0));
    }
  }

  setDefaultDisplayArea(evt) {
    let newDisplayArea = new Rect(evt.nativeEvent.layout.x + 10, evt.nativeEvent.layout.y + 10, evt.nativeEvent.layout.width - 20, evt.nativeEvent.layout.height - 20);
    if (!this.state.defaultDisplayArea || rectChanged(this.state.defaultDisplayArea, newDisplayArea)) {
      this.debug("setDefaultDisplayArea - newDisplayArea", newDisplayArea);
      if (!this.skipNextDefaultDisplayArea) {
        this.getDisplayAreaOffset(newDisplayArea, displayAreaOffset => {
          this.debug("setDefaultDisplayArea - displayAreaOffset", displayAreaOffset);
          this.setState({ defaultDisplayArea: newDisplayArea, displayAreaOffset }, () => {
            this.calculateRect(fromRect => {
              this.debug("setDefaultDisplayArea (inside calculateRect callback) - fromRect", fromRect);
              this.debug("setDefaultDisplayArea (inside calculateRect callback) - getDisplayArea()", this.getDisplayArea());
              this.debug("setDefaultDisplayArea (inside calculateRect callback) - displayAreaStore", this.displayAreaStore);
              if (rectChanged(fromRect, this.state.fromRect)
                || rectChanged(this.getDisplayArea(), this.displayAreaStore)) {
                this.displayAreaStore = this.getDisplayArea();
                this.debug("setDefaultDisplayArea (inside calculateRect callback) - Triggering state update");
                this.setState({ fromRect }, () => {
                  this.handleGeomChange();
                  this.waitForResizeToFinish = false;
                });
              }
            });
          });
        });
      }
      if (this.skipNextDefaultDisplayArea) this.debug("setDefaultDisplayArea - Skipping first because isLandscape");
      this.skipNextDefaultDisplayArea = false;
    }
  }

  keyboardDidShow(e) {
    this.debug("keyboardDidShow - keyboard height: " + e.endCoordinates.height);
    this.shiftForKeyboard(e.endCoordinates.height);
  }

  keyboardDidHide() {
    this.debug("keyboardDidHide");

    // On android, the keyboard update causes a default display area change, so no need to manually trigger
    this.setState({shiftedDisplayArea: null}, () => isIOS && this.handleGeomChange());
  }

  shiftForKeyboard(keyboardHeight) {
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
        setTimeout(() => this.calculateRect(fromRect => (fromRect || !this.props.fromView) && this.setState({fromRect, isAwaitingShow: true, visible: true})), 0);
        if (this.props.mode === POPOVER_MODE.RN_MODAL) Popover.isShowingInModal = true;
      } else {
        console.warn(MULTIPLE_POPOVER_WARNING);
      }
    }

    Dimensions.addEventListener('change', this.handleResizeEvent)
  }

  componentWillUnmount() {
    if (this.state.visible) {
      this.animateOut();
    } else {
      setTimeout(this.props.onCloseStart);
      setTimeout(this.props.onCloseComplete);
    }

    Dimensions.removeEventListener('change', this.handleResizeEvent)
  }

  // First thing called when device rotates
  handleResizeEvent = change => {
    this.debug("handleResizeEvent - New Dimensions", change);
    if (this.props.isVisible) {
      this.waitForResizeToFinish = true;
    }
  }

  measureContent(requestedContentSize) {
    if (!requestedContentSize.width) console.warn("Popover Warning - Can't Show - The Popover content has a width of 0, so there is nothing to present.");
    if (!requestedContentSize.height) console.warn("Popover Warning - Can't Show - The Popover content has a height of 0, so there is nothing to present.");
    if (this.waitForResizeToFinish) this.debug("measureContent - Waiting for resize to finish");

    if (requestedContentSize.width && requestedContentSize.height && !this.waitForResizeToFinish) {
      if (this.state.isAwaitingShow) {
        if ((this.props.fromView && !this.state.fromRect) || !this.getDisplayArea()) {
          this.debug("measureContent - Waiting " + (this.getDisplayArea() ? "for Rect" : "for Display Area") + " - requestedContentSize", requestedContentSize);
          setTimeout(() => this.measureContent(requestedContentSize), 100);
        } else {
          this.debug("measureContent - Showing Popover - requestedContentSize", requestedContentSize);
          let geom = this.computeGeometry({requestedContentSize});
          this.debug("measureContent - Showing Popover - geom", geom);

          // If the view initially overflowed the display area, wait one more render cycle to test-render it within the display area to get
          //  final calculations for popoverOrigin before show
          if (geom.viewLargerThanDisplayArea.width || geom.viewLargerThanDisplayArea.height) {
            this.debug("measureContent - Delaying showing popover because viewLargerThanDisplayArea");
            this.setState(Object.assign(geom, {requestedContentSize}));
          } else {
            this.debug("measureContent - Showing Popover - Animating In");

            // If showing in a modal, the onOpenStart callback will be called from the modal onShow callback
            if (this.props.mode !== POPOVER_MODE.RN_MODAL)
              setTimeout(this.props.onOpenStart);

            this.setState(Object.assign(geom, {requestedContentSize, isAwaitingShow: false}), this.animateIn);
          }
        }
      } else if (requestedContentSize.width !== this.state.requestedContentSize.width || requestedContentSize.height !== this.state.requestedContentSize.height) {

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

  computeGeometry({requestedContentSize, placement, fromRect, displayArea}) {
    placement = placement || this.props.placement;
    fromRect = fromRect || Object.assign({}, this.props.fromRect || this.state.fromRect);
    displayArea = displayArea || Object.assign({}, this.getDisplayArea());

    this.debug("computeGeometry - displayArea", displayArea);
    this.debug("computeGeometry - fromRect", fromRect);

    let newGeom = null;

    if (fromRect && isRect(fromRect)) {
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
        default:
          newGeom = this.computeAutoGeometry(options);
      }

      // If the popover will be restricted and the view that the popover is showing from is sufficiently large, try to show the popover inside the view
      if (newGeom.viewLargerThanDisplayArea.width || newGeom.viewLargerThanDisplayArea.height) {
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

          newGeom = {
            popoverOrigin: new Point(constrainedX, constrainedY),
            anchorPoint: new Point(fromRect.x + (fromRect.width/2), fromRect.y + (fromRect.height/2)),
            forcedContentSize,
            viewLargerThanDisplayArea: {
              width: requestedContentSize.width > forcedContentSize.width,
              height: requestedContentSize.height > forcedContentSize.height
            },
            showArrow: false
          }
        } else {
          // If we can't fit inside or outside the fromRect, show the popover centered on the screen
          newGeom = null;
        }
      }
    }

    
    if (!newGeom) {
      const minY = displayArea.y;
      const minX = displayArea.x;
      const preferedY = (displayArea.height - requestedContentSize.height)/2 + displayArea.y;
      const preferedX = (displayArea.width - requestedContentSize.width)/2 + displayArea.x;

      newGeom = {
        popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
        anchorPoint: new Point(displayArea.width/2 + displayArea.x, displayArea.height/2 + displayArea.y),
        forcedContentSize: {
          width: displayArea.width,
          height: displayArea.height
        },
        viewLargerThanDisplayArea: {
          width: preferedX < minX - 1,
          height: preferedY < minY - 1
        },
        showArrow: false
      }
    }

    return newGeom;
  }

  computeTopGeometry({displayArea, fromRect, requestedContentSize}) {
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
      viewLargerThanDisplayArea,
      showArrow: true
    }
  }

  computeBottomGeometry({displayArea, fromRect, requestedContentSize}) {
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
      viewLargerThanDisplayArea,
      showArrow: true
    }
  }

  getPolarity () {
    return I18nManager.isRTL ? -1 : 1;
  }

  computeLeftGeometry({displayArea, fromRect, requestedContentSize}) {
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
      viewLargerThanDisplayArea,
      showArrow: true
    }
  }

  computeRightGeometry({displayArea, fromRect, requestedContentSize}) {
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
      viewLargerThanDisplayArea,
      showArrow: true
    }
  }

  computeAutoGeometry({displayArea, requestedContentSize, fromRect}) {
    let arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.LEFT);
    let possiblePlacements = [];
    if (fromRect.x - displayArea.x - arrowSize.width >= requestedContentSize.width) { // We could fit it on the left side
      possiblePlacements.push(PLACEMENT_OPTIONS.LEFT)
      return this.computeGeometry({requestedContentSize, placement: PLACEMENT_OPTIONS.LEFT, fromRect, displayArea});
    }
    if (displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width >= requestedContentSize.width) // We could fit it on the right side
      possiblePlacements.push(PLACEMENT_OPTIONS.RIGHT)

    arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.TOP);

    this.debug("computeAutoGeometry - possiblePlacements", possiblePlacements);

    // Keep same placement if possible
    if (possiblePlacements.length === 2 && this.state.placement !== PLACEMENT_OPTIONS.AUTO && possiblePlacements.indexOf(this.state.placement) !== -1) {
      let geom = this.computeGeometry({requestedContentSize, placement: this.state.placement, fromRect, displayArea});
      if (!geom.viewLargerThanDisplayArea.width) return geom;
    }
    if (possiblePlacements.length === 1) {
      let geom = this.computeGeometry({requestedContentSize, placement: possiblePlacements[0], fromRect, displayArea});
      if (!geom.viewLargerThanDisplayArea.width) return geom;
    }

    if (this.state.placement === PLACEMENT_OPTIONS.TOP || this.state.placement === PLACEMENT_OPTIONS.BOTTOM)
      return this.computeGeometry({requestedContentSize, placement: this.state.placement, fromRect, displayArea});

    // We could fit it on the top or bottom, need to figure out which is better
    else {
      let topSpace = fromRect.y - displayArea.y;
      let bottomSpace = displayArea.y + displayArea.height - (fromRect.y + fromRect.height);
      return (topSpace - 50) > bottomSpace ? this.computeGeometry({requestedContentSize, placement: PLACEMENT_OPTIONS.TOP, fromRect, displayArea}) : this.computeGeometry({requestedContentSize, placement: PLACEMENT_OPTIONS.BOTTOM, fromRect, displayArea});
    }
  }

  getArrowSize(placement) {
    var size = new Size(this.props.arrowStyle.width || DEFAULT_ARROW_SIZE.width, this.props.arrowStyle.height || DEFAULT_ARROW_SIZE.height);
    switch(placement) {
      case PLACEMENT_OPTIONS.LEFT:
      case PLACEMENT_OPTIONS.RIGHT:
        return new Size(size.height, size.width);
      default:
        return size;
    }
  }

  getArrowRotation(placement) {
    switch (placement) {
      case PLACEMENT_OPTIONS.BOTTOM:
        return '180deg';
      case PLACEMENT_OPTIONS.LEFT:
        return (this.getPolarity() * -90) + 'deg';
      case PLACEMENT_OPTIONS.RIGHT:
        return this.getPolarity() * 90 + 'deg';
      default:
        return '0deg';
    }
  }

  getArrowDynamicStyle() {
    const { arrowWidth: width, arrowHeight: height } = this.getCalculatedArrowDims();

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
    }
  }

  getCalculatedArrowDims() {
    const { arrowStyle } = this.props;
    const arrowWidth = (arrowStyle.width || DEFAULT_ARROW_SIZE.width) + 2;
    const arrowHeight = (arrowStyle.height || DEFAULT_ARROW_SIZE.height) * 2 + 2;
    return {arrowWidth, arrowHeight};
  }

  getBorderRadius() {
    if (this.props.popoverStyle.borderRadius === 0) return 0;
    return this.props.popoverStyle.borderRadius || DEFAULT_BORDER_RADIUS;
  }

  getArrowTranslateLocation(translatePoint = null) {
    const { anchorPoint, placement, forcedContentSize, viewLargerThanDisplayArea, requestedContentSize } = this.state;
    const { arrowWidth, arrowHeight } = this.getCalculatedArrowDims();
    const viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width || 0;
    const viewHeight = viewLargerThanDisplayArea.height ? forcedContentSize.height : requestedContentSize.height || 0;

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
    const {forcedContentSize, viewLargerThanDisplayArea, requestedContentSize, popoverOrigin, anchorPoint} = this.state;

    const popoverWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width || 0;
    const popoverHeight = viewLargerThanDisplayArea.height ? forcedContentSize.height : requestedContentSize.height || 0;
    const popoverCenter = new Point(popoverOrigin.x + (popoverWidth / 2), popoverOrigin.y + (popoverHeight / 2));
    const shiftHorizantal = anchorPoint.x - popoverCenter.x;
    const shiftVertical = anchorPoint.y - popoverCenter.y;

    this.debug("getTranslateOrigin - popoverOrigin", popoverOrigin);
    this.debug("getTranslateOrigin - popoverSize", {width: popoverWidth, height: popoverHeight});
    this.debug("getTranslateOrigin - anchorPoint", anchorPoint);
    this.debug("getTranslateOrigin - shift", {hoizontal: shiftHorizantal, vertical: shiftVertical});

    return new Point(popoverOrigin.x + shiftHorizantal, popoverOrigin.y + shiftVertical);
  }

  getDisplayArea() {
    return this.state.shiftedDisplayArea || this.props.displayArea || this.state.defaultDisplayArea;
  }

  componentDidUpdate(prevProps) {

    // Make sure a value we care about has actually changed
    let importantProps = ["isVisible", "fromRect", "displayArea", "verticalOffset", "placement"]
    if (!importantProps.reduce((acc, key) => acc || this.props[key] !== prevProps[key], false))
      return;

    let willBeVisible = this.props.isVisible;

    if (willBeVisible !== prevProps.isVisible) {
      if (willBeVisible) {
        // We want to start the show animation only when contentSize is known
        // so that we can have some logic depending on the geometry
        if (!Popover.isShowingInModal) {
          this.calculateRect(fromRect => this.setState({ fromRect, isAwaitingShow: true, visible: true }));
          if (this.props.mode === POPOVER_MODE.RN_MODAL) Popover.isShowingInModal = true;
        } else {
          console.warn(MULTIPLE_POPOVER_WARNING);
        }
        this.debug("componentWillReceiveProps - Awaiting popover show");
      } else {
        if (this.state.visible) {
          if (this.state.showing)
            this.animateOut();
          else
            this.animateOutAfterShow = true;
          this.debug("componentWillReceiveProps - Hiding popover");
        } else {
          setTimeout(this.props.onCloseStart);
          setTimeout(this.props.onCloseComplete);
          this.debug("componentWillReceiveProps - Popover never shown");
        }
      }
    } else if (willBeVisible) {
      this.calculateRect(fromRect => {
        if (rectChanged(fromRect, this.state.fromRect)
            || (this.props.displayArea && !prevProps.displayArea)
            || rectChanged(this.props.displayArea, prevProps.displayArea)
            || rectChanged(this.getDisplayArea(), this.displayAreaStore)) {
          this.displayAreaStore = this.getDisplayArea();
          this.setState({ fromRect }, () => this.handleGeomChange());
        }
      })
    }
  }

  calculateRect(callback) {
    let initialRect = this.state.fromRect || new Rect(0, 0, 0, 0);
    let displayArea = this.props.displayArea || this.getDisplayArea();
    if (this.props.fromDynamicRect)
      runAfterChange(callback_ => callback_(this.props.fromDynamicRect(displayArea.width, displayArea.height)), initialRect, () => {
        callback({fromRect: this.props.fromDynamicRect(displayArea.width, displayArea.height)});
      });
    else if (this.props.fromView) {
      const verticalOffset = this.props.verticalOffset + (this.state.displayAreaOffset ? -1 * this.state.displayAreaOffset.y : 0);
      const horizontalOffset = this.state.displayAreaOffset ? -1 * this.state.displayAreaOffset.x : 0;
      waitForNewRect(this.props.fromView, initialRect, rect => {
        callback(new Rect(rect.x + horizontalOffset, rect.y + verticalOffset, rect.width, rect.height));
      });
    } else {
      callback(this.props.fromRect);
    }
  }

  handleGeomChange(requestedContentSize) {
    const { forcedContentSize, popoverOrigin, animatedValues } = this.state;
    requestedContentSize = requestedContentSize || Object.assign({}, this.state.requestedContentSize);

    this.debug("handleGeomChange - requestedContentSize: ", requestedContentSize);

    // handleGeomChange may be called more than one times before the first has a chance to finish,
    //  so we use updateCount to make sure that we only trigger an animation on the last one
    if (!this.updatesCount || this.updatesCount < 0) this.updateCount = 0;
    this.updateCount++;

    let geom = this.computeGeometry({requestedContentSize});

    if (pointChanged(geom.popoverOrigin, popoverOrigin) || rectChanged(geom.forcedContentSize, forcedContentSize)) {
      this.setState(Object.assign(geom, {requestedContentSize}), () => {
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
      callback: () => this.setState({visible: false, forcedContentSize: {}}, () => {

        // If showing in an RN modal, the onCloseComplete callback will be called from the Modal onDismiss callback (on iOS only)
        if (this.props.mode !== POPOVER_MODE.RN_MODAL || !isIOS)
          this.props.onCloseComplete()
      }),
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
      easing: Easing.out(Easing.back()),
      callback: () => {
        this.setState({showing: true});
        setTimeout(this.props.onOpenComplete);
        setTimeout(() => getRectForRef(this.popoverRef, (rect) => this.debug("animateIn - onOpenComplete - Calculated Popover Rect", rect)));
        if (this.animateOutAfterShow) {
          this.animateOut();
          this.animateOutAfterShow = false;
        }
      }
    })
  }

  animateTo({fade, translatePoint, scale, callback, easing, values}) {
    const commonConfig = Object.assign({
      duration: 300,
      easing,
      useNativeDriver: true
    }, this.props.animationConfig);

    if (this.animating) {
      setTimeout(() => this.animateTo.apply(this, arguments), 100);
      return;
    }

    const newArrowLocation = this.getArrowTranslateLocation(translatePoint);

    translatePoint.y = translatePoint.y + (FIX_SHIFT*2) // Temp fix for useNativeDriver issue

    if (!fade && fade !== 0) { console.log("Popover: Fade value is null"); return; }
    if (!isPoint(translatePoint)) { console.log("Popover: Translate Point value is null"); return; }
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
    var { placement, animatedValues, forcedContentSize } = this.state;
    const { popoverStyle, arrowStyle } = this.props;
    const { arrowWidth, arrowHeight } = this.getCalculatedArrowDims();

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
      this.getArrowDynamicStyle(),
      {
        borderTopColor: arrowStyle.backgroundColor || popoverStyle.backgroundColor || styles.popoverContent.backgroundColor,
        transform: [
          {rotate: this.getArrowRotation(placement)}
        ]
      }
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
      ...this.props.backgroundStyle
    };

    let containerStyle = {
      ...styles.container,
      opacity: animatedValues.fade
    };

    let popoverViewStyle = Object.assign({
      maxWidth: forcedContentSize.width,
      maxHeight: forcedContentSize.height,
      position: 'absolute',
    }, styles.dropShadow, styles.popoverContent, popoverStyle, {
      transform: [
        {translateX: animatedValues.translate.x},
        {translateY: animatedValues.translate.y},
        {scale: animatedValues.scale},
        {perspective: 1000}
      ],
    });

    let contentView = (
      <View pointerEvents="box-none" style={[styles.container, {left: 0}]} ref={ref => this.containerRef = ref}>
        <SafeAreaView pointerEvents="none" style={{position: 'absolute', top: FIX_SHIFT, left: 0, right: 0, bottom: 0}}>
          <TouchableWithoutFeedback style={{flex: 1}} onLayout={evt => this.setDefaultDisplayArea(evt)}><View style={{flex: 1}} /></TouchableWithoutFeedback>
        </SafeAreaView>

        <Animated.View pointerEvents="box-none" style={containerStyle}>
          { this.props.mode !== POPOVER_MODE.TOOLTIP && <TouchableWithoutFeedback onPress={this.props.onRequestClose}>
            <Animated.View style={backgroundStyle} />
          </TouchableWithoutFeedback> }

          <View pointerEvents="box-none" style={{top: 0, left: 0}}>
            
            <Animated.View style={popoverViewStyle} ref={ref => this.popoverRef = ref} onLayout={evt => this.measureContent(evt.nativeEvent.layout)}>
              {this.props.children}
            </Animated.View>

            {this.state.showArrow &&
              <Animated.View style={arrowViewStyle}>
                <View style={arrowInnerStyle} />
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

var styles = {
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
};

Popover.defaultDisplayArea = {};
Popover.PLACEMENT_OPTIONS = PLACEMENT_OPTIONS;
Popover.MODE = POPOVER_MODE;
Popover.defaultProps = {
  isVisible: true,
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

Popover.propTypes = {
  // display
  isVisible: PropTypes.bool,
  mode: PropTypes.oneOf([POPOVER_MODE.JS_MODAL, POPOVER_MODE.RN_MODAL, POPOVER_MODE.TOOLTIP]),

  // anchor
  fromRect: PropTypes.objectOf(PropTypes.number),
  fromView: PropTypes.object,
  fromDynamicRect: PropTypes.func,

  // config
  displayArea: PropTypes.objectOf(PropTypes.number),
  placement: PropTypes.oneOf([PLACEMENT_OPTIONS.LEFT, PLACEMENT_OPTIONS.RIGHT, PLACEMENT_OPTIONS.TOP, PLACEMENT_OPTIONS.BOTTOM, PLACEMENT_OPTIONS.AUTO]),
  animationConfig: PropTypes.object,
  verticalOffset: PropTypes.number,

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

export default Popover;
