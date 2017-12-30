'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Dimensions, Animated, Text, TouchableWithoutFeedback, View, Modal, Keyboard, Alert, Easing } from 'react-native';
import { Rect, Point, Size, isIOS, PLACEMENT_OPTIONS } from './Utility';

var flattenStyle = require('react-native/Libraries/StyleSheet/flattenStyle');
var noop = () => {};

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
var DEFAULT_ARROW_SIZE = new Size(16, 8);
var FIX_SHIFT = SCREEN_WIDTH * 2;

export default class Popover extends React.Component {

  constructor(props) {
    super(props)

    this.state = {
      requestedContentSize: {},
      forcedContentSize: {},
      anchorPoint: new Point(0, 0),
      popoverOrigin: {},
      shiftedUp: false,
      forcedHeight: null,
      placement: PLACEMENT_OPTIONS.AUTO,
      isAwaitingShow: true,
      visible: false,
      animatedValues: {
        scale: new Animated.Value(0),
        translate: new Animated.ValueXY(),
        fade: new Animated.Value(0)
      }
    };

    this.measureContent = this.measureContent.bind(this);
    this.animateIn = this.animateIn.bind(this);
  }

    componentWillMount() {
    }

    keyboardDidShow(e) {
      this.shiftForKeyboard(e.endCoordinates.height);
    }

    keyboardDidHide() {
      const { displayArea } = this.props;
      this.handleGeomChange({displayArea});
    }

    shiftForKeyboard(keyboardHeight) {
      const { displayArea } = this.props;

      const absoluteVerticalCutoff = Dimensions.get('window').height - keyboardHeight - (isIOS() ? 10 : 40);
      const combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);

      this.handleGeomChange({displayArea: {
        x: displayArea.x,
        y: displayArea.y,
        width: displayArea.width,
        height: combinedY - displayArea.y
      }});
    }

    componentWillUnmount() {
      if (this.state.visible)
        this.animateOut()
    }

    measureContent(x) {
        let requestedContentSize = x.nativeEvent.layout;
        if (requestedContentSize.width && requestedContentSize.height) {
          if (this.state.isAwaitingShow) {
            let geom = this.computeGeometry({requestedContentSize});

            this.setState(Object.assign(geom, {requestedContentSize, isAwaitingShow: false}), this.animateIn);
          } else if (requestedContentSize.width !== this.state.requestedContentSize.width || requestedContentSize.height !== this.state.requestedContentSize.height) {
            this.handleGeomChange({requestedContentSize});
          }
        }
    }

    computeGeometry({requestedContentSize, placement, fromRect, displayArea}) {
        placement = placement || this.props.placement;
        fromRect = fromRect || (this.props.fromRect ? Object.assign({}, this.props.fromRect) : null);
        displayArea = displayArea || Object.assign({}, this.props.displayArea);

        if (fromRect) {
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
          return {
            popoverOrigin: new Point((displayArea.width - requestedContentSize.width)/2, (displayArea.height - requestedContentSize.height)/2),
            anchorPoint: new Point(displayArea.width/2, displayArea.height/2),
            forcedContentSize: {
              height: requestedContentSize.height >= displayArea.height ? displayArea.height : null,
              width: requestedContentSize.width >= displayArea.width ? displayArea.width : null
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
        let forcedContentSize = {
          height: requestedContentSize.height >= displayArea.height ? displayArea.height : null,
          width: requestedContentSize.width >= displayArea.x + displayArea.width - (fromRect.x + fromRect.width) ? displayArea.x + displayArea.width - (fromRect.x + fromRect.width) : null
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
        if (possiblePlacements.length === 2) {
          if (this.state.placement !== PLACEMENT_OPTIONS.AUTO)
            return this.computeGeometry({requestedContentSize, placement: this.state.placement, fromRect, displayArea});
          else
            return this.computeGeometry({requestedContentSize, placement: possiblePlacements[0], fromRect, displayArea});
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

    componentWillReceiveProps(nextProps:any) {
        var willBeVisible = nextProps.isVisible;
        var {
            isVisible,
            fromRect,
            displayArea
        } = this.props;

        if (willBeVisible !== isVisible) {
            if (willBeVisible) {
                // We want to start the show animation only when contentSize is known
                // so that we can have some logic depending on the geometry
                this.setState({isAwaitingShow: true, visible: true});
            } else {
                this.animateOut();
            }
        } else if (willBeVisible) {// && ((fromRect !== undefined && JSON.stringify(nextProps.fromRect) !== JSON.stringify(fromRect)) || (displayArea !== undefined && JSON.stringify(nextProps.displayArea) !== JSON.stringify(displayArea)))) {
            this.handleGeomChange(nextProps);
        }
    }

    handleGeomChange({displayArea, fromRect, ...newProps}) {
      let { forcedContentSize, placement, anchorPoint, popoverOrigin, animatedValues } = this.state;
      let requestedContentSize = newProps.requestedContentSize || Object.assign({}, this.state.requestedContentSize);

      let geom = this.computeGeometry({requestedContentSize, displayArea, fromRect});

      this.setState(Object.assign(geom, {requestedContentSize}), () => {
        if (geom.popoverOrigin !== popoverOrigin) {
          this.animateTo({
            values: animatedValues,
            fade: 1,
            scale: 1,
            translatePoint: new Point(geom.popoverOrigin.x, geom.popoverOrigin.y),
            easing: Easing.inOut(Easing.quad)
          })
        }
      });
    }

    animateOut() {
      this.keyboardDidShowListener.remove()
      this.keyboardDidHideListener.remove()
      this.animateTo({
        values: this.state.animatedValues,
        fade: 0,
        scale: 0,
        translatePoint: this.getTranslateOrigin(),
        callback: () => this.setState({visible: false}, () => this.props.doneClosingCallback()),
        easing: Easing.inOut(Easing.quad)
      })
    }

    animateIn() {
      var values = this.state.animatedValues;

      this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow.bind(this));
      this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide.bind(this));

      // Should grow from anchor point
      let translateStart = this.getTranslateOrigin()
      translateStart.x += FIX_SHIFT // Temp fix for useNativeDriver issue
      values.translate.setValue(translateStart);

      this.animateTo({
        values,
        fade: 1,
        scale: 1,
        translatePoint: new Point(this.state.popoverOrigin.x, this.state.popoverOrigin.y),
        easing: Easing.out(Easing.back())
      })
    }

    animateTo({fade, translatePoint, scale, callback, easing, values}) {
      var commonConfig = {
          duration: 300,
          easing,
          useNativeDriver: true
      }

      if (this.animating) {
        setTimeout(() => this.animateTo.apply(this, arguments), 100);
        return;
      }

      translatePoint.x = translatePoint.x + FIX_SHIFT // Temp fix for useNativeDriver issue

      if (!fade && fade !== 0) console.log("Popover: Fade value is null")
      else if (!translatePoint || (!translatePoint.x && translatePoint.x !== 0) || (!translatePoint.y && translatePoint.y !== 0)) console.log("Popover: Translate Point value is null")
      else if (!scale && scale !== 0) console.log("Popover: Scale value is null")
      else {
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
            })
        ]).start(() => { 
          this.animating = false;
          if (callback) callback();
        });
      }
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
            {translateX: FIX_SHIFT /* Temp fix for useNativeDriver issue */ + anchorPoint.x - arrowWidth / 2},
            {translateY: anchorPoint.y - arrowHeight / 2},
            {rotate: this.getArrowRotation(placement)}
          ]
        };

        let arrowInnerStyle = [
          styles.arrow,
          this.getArrowDynamicStyle(),
          {
            borderTopColor: styles.popoverContent.backgroundColor,
            transform: [
              {scale: arrowScale},
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
          ...styles.dropShadow,
          ...styles.popoverContent
        };

        let contentView = (
            <View style={[styles.container, {left: 0}]}>
              <Animated.View style={containerStyle}>
                {this.props.showBackground &&
                  <TouchableWithoutFeedback onPress={this.props.onClose}>
                    <Animated.View style={backgroundStyle}/>
                  </TouchableWithoutFeedback>
                }
                <View style={{top: 0, left: 0}}>
                  
                  <Animated.View style={popoverViewStyle} onLayout={this.measureContent}j>
                    {this.props.children}
                  </Animated.View>

                  {this.props.showArrow && this.props.fromRect !== undefined && this.props.fromRect !== null &&
                    <View style={arrowStyle}>
                      <Animated.View style={arrowInnerStyle}/>
                    </View>
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
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    contentContainer: {
        flexDirection: 'column',
    },
    popoverContainer: {
        position: 'absolute'
    },
    popoverContent: {
        backgroundColor: 'white',
        borderRadius: 3,
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

Popover.defaultProps = {
	isVisible: false,
	displayArea: new Rect(10, isIOS() ? 20 : 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-30),
	arrowSize: DEFAULT_ARROW_SIZE,
	placement: PLACEMENT_OPTIONS.AUTO,
	onClose: noop,
	doneClosingCallback: noop,
	showInModal: true,
  layoutRtl: false,
  showArrow: true,
  showBackground: true
}

Popover.propTypes = {
  isVisible: PropTypes.bool,
  displayArea: PropTypes.objectOf(PropTypes.number),
  arrowSize: PropTypes.objectOf(PropTypes.number),
  placement: PropTypes.oneOf([PLACEMENT_OPTIONS.LEFT, PLACEMENT_OPTIONS.RIGHT, PLACEMENT_OPTIONS.TOP, PLACEMENT_OPTIONS.BOTTOM, PLACEMENT_OPTIONS.AUTO]),
  onClose: PropTypes.func,
  doneClosingCallback: PropTypes.func,
  showInModal: PropTypes.bool,
  fromRect: PropTypes.objectOf(PropTypes.number),
  layoutRtl: PropTypes.bool,
  showArrow: PropTypes.bool,
  showBackground: PropTypes.bool
}
