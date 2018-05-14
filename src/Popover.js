'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { SafeAreaView, StyleSheet, Dimensions, Animated, Text, TouchableWithoutFeedback, findNodeHandle, NativeModules, View, Modal, Keyboard, Alert, Easing } from 'react-native';
import { Rect, Point, Size, isIOS, isRect, isPoint, rectChanged, pointChanged, waitForNewRect } from './Utility';

var flattenStyle = require('react-native/Libraries/StyleSheet/flattenStyle');
var noop = () => {};

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
var DEFAULT_ARROW_SIZE = new Size(16, 8);
var DEFAULT_BORDER_RADIUS = 3;
var FIX_SHIFT = SCREEN_WIDTH * 2;

const PLACEMENT_OPTIONS = Object.freeze({
  TOP: 'top',
  RIGHT: 'right',
  BOTTOM: 'bottom',
  LEFT: 'left',
  AUTO: 'auto'
});


class Popover extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      requestedContentSize: {},
      forcedContentSize: {},
      anchorPoint: new Point(0, 0),
      popoverOrigin: {},
      forcedHeight: null,
      shiftedDisplayArea: null,
      defaultDisplayArea: null,
      placement: PLACEMENT_OPTIONS.AUTO,
      isAwaitingShow: true,
      visible: false,
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

  setDefaultDisplayArea(evt) {
    if (this.safeAreaViewReady || !isIOS()) {
      let newDisplayArea = new Rect(evt.nativeEvent.layout.x + 10, evt.nativeEvent.layout.y + 10, evt.nativeEvent.layout.width - 20, evt.nativeEvent.layout.height - 20);
      if (!this.state.defaultDisplayArea || rectChanged(this.state.defaultDisplayArea, newDisplayArea)) {
        this.setState({defaultDisplayArea: newDisplayArea});//, () => this.handleGeomChange({displayArea: newDisplayArea}));
      }
    }
    this.safeAreaViewReady = true;
  }

    keyboardDidShow(e) {
      this.shiftForKeyboard(e.endCoordinates.height);
    }

    keyboardDidHide() {
      this.setState({shiftedDisplayArea: null}, () => this.handleGeomChange({displayArea: this.getDisplayArea()}));
    }

    shiftForKeyboard(keyboardHeight) {
      const displayArea = this.getDisplayArea();

      const absoluteVerticalCutoff = Dimensions.get('window').height - keyboardHeight - (isIOS() ? 10 : 40);
      const combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);

      this.setState({shiftedDisplayArea: {
        x: displayArea.x,
        y: displayArea.y,
        width: displayArea.width,
        height: combinedY - displayArea.y
      }}, () => this.handleGeomChange({displayArea: this.state.shiftedDisplayArea}));
    }

    componentDidMount() {

      // I found that the RN SafeAreaView doesn't actually tell you the safe area until the second layout,
      //  so we don't want to rely on it to give us an accurate display area until it's figured that out
      this.safeAreaViewReady = false;
    }

    componentWillUnmount() {
      if (this.state.visible)
        this.animateOut();
    }

    measureContent(requestedContentSize) {
      if (requestedContentSize.width && requestedContentSize.height) {
        if (this.state.isAwaitingShow) {
          if ((this.props.fromView && !this.state.fromRect) || !this.getDisplayArea() || !this.safeAreaViewReady) {
            setTimeout(() => this.measureContent(requestedContentSize), 100);
          } else {
            let geom = this.computeGeometry({requestedContentSize});
            this.setState(Object.assign(geom, {requestedContentSize, isAwaitingShow: false}), this.animateIn);
          }
        } else if (requestedContentSize.width !== this.state.requestedContentSize.width || requestedContentSize.height !== this.state.requestedContentSize.height) {
          this.handleGeomChange({requestedContentSize});
        }
      }
    }

    computeGeometry({requestedContentSize, placement, fromRect, displayArea}) {
        placement = placement || this.props.placement;
        fromRect = fromRect || Object.assign({}, this.props.fromRect || this.state.fromRect);
        displayArea = displayArea || Object.assign({}, this.getDisplayArea());

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
                return this.computeTopGeometry(options);
            case PLACEMENT_OPTIONS.BOTTOM:
                return this.computeBottomGeometry(options);
            case PLACEMENT_OPTIONS.LEFT:
                return this.computeLeftGeometry(options);
            case PLACEMENT_OPTIONS.RIGHT:
                return this.computeRightGeometry(options);
            default:
                return this.computeAutoGeometry(options);
          }
        } else {
          const minY = displayArea.y;
          const minX = displayArea.x;
          const preferedY = (displayArea.height - requestedContentSize.height)/2 + displayArea.y;
          const preferedX = (displayArea.width - requestedContentSize.width)/2 + displayArea.x;

          return {
            popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
            anchorPoint: new Point(displayArea.width/2 + displayArea.x, displayArea.height/2 + displayArea.y),
            forcedContentSize: {
              width: preferedX < minX ? displayArea.width : null,
              height: preferedY < minY ? displayArea.height : null
            }
          }
        }
    }

    computeTopGeometry({displayArea, fromRect, requestedContentSize}) {
        let minY = displayArea.y;
        const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.TOP);
        let preferedY = fromRect.y - requestedContentSize.height - arrowSize.height;

        let forcedContentSize = {
          height: preferedY <= minY ? (fromRect.y - arrowSize.height - displayArea.y) : null,
          width: requestedContentSize.width >= displayArea.width ? displayArea.width : null
        }

        let viewWidth = forcedContentSize.width || requestedContentSize.width;

        let maxX = displayArea.x + displayArea.width - viewWidth;
        let minX = displayArea.x;
        let preferedX = fromRect.x + (fromRect.width - viewWidth) / 2;

        var popoverOrigin = new Point(
            Math.min(maxX, Math.max(minX, preferedX)),
            Math.max(minY, preferedY)
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y);

        // Make sure the arrow isn't cut off
        anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + 3);
        anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - 3);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.TOP,
            forcedContentSize
        }
    }

    computeBottomGeometry({displayArea, fromRect, requestedContentSize}) {
        const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.BOTTOM);
        let preferedY = fromRect.y + fromRect.height + arrowSize.height;

        let forcedContentSize = {
          height: preferedY + requestedContentSize.height >= displayArea.y + displayArea.height ? displayArea.y + displayArea.height - preferedY : null,
          width: requestedContentSize.width >= displayArea.width ? displayArea.width : null
        }

        let viewWidth = forcedContentSize.width || requestedContentSize.width;

        let maxX = displayArea.x + displayArea.width - viewWidth;
        let minX = displayArea.x;
        let preferedX = fromRect.x + (fromRect.width - viewWidth) / 2;

        var popoverOrigin = new Point(
            Math.min(maxX, Math.max(minX, preferedX)),
            preferedY
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y + fromRect.height);

        // Make sure the arrow isn't cut off
        anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + 3);
        anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - 3);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.BOTTOM,
            forcedContentSize
        }
    }

    getPolarity () {
        return this.props.layoutRtl ? -1 : 1;
    }

    computeLeftGeometry({displayArea, fromRect, requestedContentSize}) {
        const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.LEFT);
        let forcedContentSize = {
          height: requestedContentSize.height >= displayArea.height ? displayArea.height : null,
          width: requestedContentSize.width >= fromRect.x - displayArea.x - arrowSize.width ? fromRect.x - displayArea.x - arrowSize.width : null
        }

        let viewWidth = forcedContentSize.width || requestedContentSize.width;
        let viewHeight = forcedContentSize.height || requestedContentSize.height;

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
        anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + 3);
        anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - 3);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.LEFT,
            forcedContentSize
        }
    }

    computeRightGeometry({displayArea, fromRect, requestedContentSize}) {
        const arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.RIGHT);
        let horizontalSpace = displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width;
        let forcedContentSize = {
          height: requestedContentSize.height >= displayArea.height ? displayArea.height : null,
          width: requestedContentSize.width >= horizontalSpace ? horizontalSpace : null
        }

        let viewHeight = forcedContentSize.height || requestedContentSize.height;

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
        anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + 3);
        anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - 3);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.RIGHT,
            forcedContentSize
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

        // Keep same placement if possible
        if (possiblePlacements.length === 2 && this.state.placement !== PLACEMENT_OPTIONS.AUTO && possiblePlacements.indexOf(this.state.placement) !== -1) {
            return this.computeGeometry({requestedContentSize, placement: this.state.placement, fromRect, displayArea});
        } else if (possiblePlacements.length === 1) {
            return this.computeGeometry({requestedContentSize, placement: possiblePlacements[0], fromRect, displayArea});
        } else {
          if (this.state.placement === PLACEMENT_OPTIONS.TOP || this.state.placement === PLACEMENT_OPTIONS.BOTTOM)
            return this.computeGeometry({requestedContentSize, placement: this.state.placement, fromRect, displayArea});

          // We could fit it on the top or bottom, need to figure out which is better
          else {
            let topSpace = fromRect.y - displayArea.y;
            let bottomSpace = displayArea.y + displayArea.height - (fromRect.y + fromRect.height);
            return (topSpace - 50) > bottomSpace ? this.computeGeometry({requestedContentSize, placement: PLACEMENT_OPTIONS.TOP, fromRect, displayArea}) : this.computeGeometry({requestedContentSize, placement: PLACEMENT_OPTIONS.BOTTOM, fromRect, displayArea});
          }
        }
    }

    getArrowSize(placement) {
        var size = this.props.arrowSize;
        switch(placement) {
            case PLACEMENT_OPTIONS.LEFT:
            case PLACEMENT_OPTIONS.RIGHT:
                return new Size(size.height, size.width);
            default:
                return size;
        }
    }

    getArrowColorStyle(color) {
        return { borderTopColor: color };
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
        const { anchorPoint, popoverOrigin, placement } = this.state;
        const { arrowSize } = this.props;

        // Create the arrow from a rectangle with the appropriate borderXWidth set
        // A rotation is then applied dependending on the placement
        // Also make it slightly bigger
        // to fix a visual artifact when the popover is animated with a scale
        var width = arrowSize.width + 2;
        var height = arrowSize.height * 2 + 2;

        return {
            width: width,
            height: height,
            borderTopWidth: height / 2,
            borderRightWidth: width / 2,
            borderBottomWidth: height / 2,
            borderLeftWidth: width / 2,
        }
    }

    getArrowTranslateLocation(translatePoint = null) {
      const { anchorPoint, placement, forcedContentSize, requestedContentSize } = this.state;
      const { arrowSize } = this.props;
      const arrowWidth = arrowSize.width + 2;
      const arrowHeight = arrowSize.height * 2 + 2;
      const viewWidth = forcedContentSize.width || requestedContentSize.width || 0;
      const viewHeight = forcedContentSize.height || requestedContentSize.height || 0;


      let arrowX = anchorPoint.x - arrowWidth / 2;
      let arrowY = anchorPoint.y - arrowHeight / 2;

      // Ensuring that the arrow does not go outside the bounds of the content box during a move
      if (translatePoint) {
        if (placement === PLACEMENT_OPTIONS.LEFT || placement === PLACEMENT_OPTIONS.RIGHT) {
          if (translatePoint.y > (arrowY - 3))
            arrowY = translatePoint.y + 3
          else if (viewHeight && translatePoint.y + viewHeight < arrowY + arrowHeight)
            arrowY = translatePoint.y + viewHeight - arrowHeight - 3
        } else if (placement === PLACEMENT_OPTIONS.TOP || placement === PLACEMENT_OPTIONS.BOTTOM) {
          if (translatePoint.x > arrowX - 3)
            arrowX = translatePoint.x + 3
          else if (viewWidth && translatePoint.x + viewWidth < arrowX + arrowWidth)
            arrowX = translatePoint.x + viewWidth - arrowWidth - 3
        }
      }
      return new Point(FIX_SHIFT /* Temp fix for useNativeDriver issue */ + arrowX, arrowY);
    }

    getTranslateOrigin() {
        const {forcedContentSize, requestedContentSize, popoverOrigin, anchorPoint} = this.state;

        const viewWidth = forcedContentSize.width || requestedContentSize.width || 0;
        const viewHeight = forcedContentSize.height || requestedContentSize.height || 0;
        const popoverCenter = new Point(popoverOrigin.x + (viewWidth / 2),
            popoverOrigin.y + (viewHeight / 2));
        const shiftHorizantal = anchorPoint.x - popoverCenter.x;
        const shiftVertical = anchorPoint.y - popoverCenter.y;
        return new Point(popoverOrigin.x + shiftHorizantal, popoverOrigin.y + shiftVertical);
    }

    getDisplayArea() {
      return this.state.shiftedDisplayArea || this.props.displayArea || this.state.defaultDisplayArea;
    }

    componentWillReceiveProps(nextProps:any) {
        let willBeVisible = nextProps.isVisible;
        let {
            isVisible,
            displayArea
        } = this.props;

        if (willBeVisible !== isVisible) {
            if (willBeVisible) {
              // We want to start the show animation only when contentSize is known
              // so that we can have some logic depending on the geometry
              this.calculateRect(nextProps, fromRect => this.setState({fromRect, isAwaitingShow: true, visible: true}));
            } else {
                this.animateOut();
            }
        } else if (willBeVisible) {
          this.calculateRect(nextProps, fromRect => {
            if (rectChanged(fromRect, this.state.fromRect)
                || (nextProps.displayArea && !this.props.displayArea)
                || rectChanged(nextProps.displayArea, this.props.displayArea)
                || rectChanged(this.getDisplayArea(), this.displayAreaStore))
              this.displayAreaStore = this.getDisplayArea();
              this.setState({fromRect}, () => this.handleGeomChange(Object.assign(nextProps, {fromRect})))
          })
        }
    }

    calculateRect(props, callback) {
      let initialRect = this.state.fromRect || new Rect(0, 0, 0, 0);
      if (props.calculateRect)
        runAfterChange(callback_ => callback_(props.calculateRect(newDisplayArea.width, newDisplayArea.height)), initialRect, () => {
          callback({fromRect: props.calculateRect(newDisplayArea.width, newDisplayArea.height)});
        });
      else if (props.fromView)
        waitForNewRect(props.fromView, initialRect, callback);
      else
        callback(props.fromRect);
    }

    handleGeomChange({displayArea, fromRect, requestedContentSize}) {
      const { forcedContentSize, placement, anchorPoint, popoverOrigin, animatedValues } = this.state;
      requestedContentSize = requestedContentSize || Object.assign({}, this.state.requestedContentSize);

      let geom = this.computeGeometry({requestedContentSize, displayArea, fromRect});

      if (pointChanged(geom.popoverOrigin, popoverOrigin)) {
        this.setState(Object.assign(geom, {requestedContentSize}), () => {
          this.animateTo({
            values: animatedValues,
            fade: 1,
            scale: 1,
            translatePoint: new Point(geom.popoverOrigin.x, geom.popoverOrigin.y),
            easing: Easing.inOut(Easing.quad)
          });
        });
      }
    }

    animateOut() {
      this.keyboardDidShowListener && this.keyboardDidShowListener.remove();
      this.keyboardDidHideListener && this.keyboardDidHideListener.remove();
      this.safeAreaViewReady = false;
      this.setState({shiftedDisplayArea: null});
      this.animateTo({
        values: this.state.animatedValues,
        fade: 0,
        scale: 0,
        translatePoint: this.getTranslateOrigin(),
        callback: () => this.setState({visible: false, forcedContentSize: {}}, () => this.props.doneClosingCallback()),
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
      translateStart.x += FIX_SHIFT // Temp fix for useNativeDriver issue
      values.translate.setValue(translateStart);
      const translatePoint = new Point(this.state.popoverOrigin.x, this.state.popoverOrigin.y);
      values.translateArrow.setValue(this.getArrowTranslateLocation(translatePoint));

      this.animateTo({
        values,
        fade: 1,
        scale: 1,
        translatePoint,
        easing: Easing.out(Easing.back())
      })
    }

    animateTo({fade, translatePoint, scale, callback, easing, values}) {
      const commonConfig = {
          duration: 300,
          easing,
          useNativeDriver: true
      }

      if (this.animating) {
        setTimeout(() => this.animateTo.apply(this, arguments), 100);
        return;
      }

      const newArrowLocation = this.getArrowTranslateLocation(translatePoint);

      translatePoint.x = translatePoint.x + FIX_SHIFT // Temp fix for useNativeDriver issue

      if (!fade && fade !== 0) { console.log("Popover: Fade value is null"); return; }
      if (!isPoint(translatePoint)) { console.log("Popover: Translate Point value is null"); return; }
      if (!scale && scale !== 0) { console.log("Popover: Scale value is null"); return; }
      this.animating = true;
      Animated.parallel([
          Animated.timing(values.fade, {
              toValue: fade,
              ...commonConfig,
          }),
          Animated.timing(values.translate, {
              toValue: translatePoint,
              ...commonConfig,
          }),
          Animated.timing(values.scale, {
              toValue: scale,
              ...commonConfig,
          }),
          Animated.timing(values.translateArrow, {
              toValue: newArrowLocation,
              ...commonConfig,
          })
      ]).start(() => {
        this.animating = false;
        if (callback) callback();
      });
    }

    render() {
        var {popoverOrigin, placement, forcedHeight, animatedValues, anchorPoint, forcedContentSize} = this.state;

        let arrowScale = animatedValues.scale.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        })

        var arrowSize = this.props.arrowSize;
        var arrowWidth = arrowSize.width + 2;
        var arrowHeight = arrowSize.height * 2 + 2;

        var arrowStyle = {
          position: 'absolute',
          top: 0,
          left: 0,
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
            borderTopColor: styles.popoverContent.backgroundColor,
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
            {translateX: backgroundShift}
          ]
        };
        if (this.props.showBackground)
          backgroundStyle.backgroundColor = 'rgba(0,0,0,0.5)'

        let containerStyle = {
          ...styles.container,
          opacity: animatedValues.fade
        };

        let popoverViewStyle = {
          transform: [
              {translateX: animatedValues.translate.x},
              {translateY: animatedValues.translate.y},
              {scale: animatedValues.scale},
              {perspective: 1000}
          ],
          maxWidth: forcedContentSize.width,
          maxHeight: forcedContentSize.height,
          position: 'absolute',
          borderRadius: this.props.borderRadius,
          ...styles.dropShadow,
          ...styles.popoverContent
        };

        let contentView = (
            <View style={[styles.container, {left: 0}]}>
              <SafeAreaView pointerEvent="none" style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}>
                <View style={{flex: 1}} onLayout={evt => this.setDefaultDisplayArea(evt)} />
              </SafeAreaView>

              <Animated.View style={containerStyle}>
                <TouchableWithoutFeedback onPress={this.props.onClose}>
                  <Animated.View style={backgroundStyle}/>
                </TouchableWithoutFeedback>

                <View style={{top: 0, left: 0}}>

                  <Animated.View style={popoverViewStyle} onLayout={evt => this.measureContent(evt.nativeEvent.layout)}>
                    {this.props.children}
                  </Animated.View>

                  {this.props.showArrow && (this.props.fromRect || this.state.fromRect) &&
                    <Animated.View style={arrowStyle}>
                      <View style={arrowInnerStyle}/>
                    </Animated.View>
                  }
                </View>
              </Animated.View>
            </View>
        );

        if (this.props.showInModal) {
            return (
                <Modal transparent={true} supportedOrientations={['portrait', 'landscape']} hardwareAccelerated={true} visible={this.state.visible} onRequestClose={this.props.onClose}>
                  {contentView}
                </Modal>
            );
        } else {
            return contentView;
        }
    }
}

var styles = {
    container: {
        top: 0,
        bottom: 0,
        left: -1 * FIX_SHIFT,
        right: 0,
        position: 'absolute',
        backgroundColor: 'transparent'
    },
    background: {
        top: 0,
        bottom: 0,
        left: 0,
        right: FIX_SHIFT,
        position: 'absolute',
    },
    contentContainer: {
        flexDirection: 'column',
    },
    popoverContainer: {
        position: 'absolute'
    },
    popoverContent: {
        backgroundColor: 'white',
        borderBottomColor: '#333438',
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
Popover.defaultProps = {
	isVisible: false,
	arrowSize: DEFAULT_ARROW_SIZE,
  borderRadius: DEFAULT_BORDER_RADIUS,
	placement: PLACEMENT_OPTIONS.AUTO,
	onClose: noop,
	doneClosingCallback: noop,
	showInModal: true,
  layoutRtl: false,
  showArrow: true,
  showBackground: true,
}

Popover.propTypes = {
  isVisible: PropTypes.bool,
  displayArea: PropTypes.objectOf(PropTypes.number),
  arrowSize: PropTypes.objectOf(PropTypes.number),
  borderRadius: PropTypes.objectOf(PropTypes.number),
  placement: PropTypes.oneOf([PLACEMENT_OPTIONS.LEFT, PLACEMENT_OPTIONS.RIGHT, PLACEMENT_OPTIONS.TOP, PLACEMENT_OPTIONS.BOTTOM, PLACEMENT_OPTIONS.AUTO]),
  onClose: PropTypes.func,
  doneClosingCallback: PropTypes.func,
  showInModal: PropTypes.bool,
  fromRect: PropTypes.objectOf(PropTypes.number),
  fromView: PropTypes.object,
  calculateRect: PropTypes.func,
  layoutRtl: PropTypes.bool,
  showArrow: PropTypes.bool,
  showBackground: PropTypes.bool,
}

export default Popover;
