'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import {StyleSheet, Dimensions, Animated, Text, TouchableWithoutFeedback, View, Modal, Platform, Keyboard, Alert} from 'react-native';
import _ from 'lodash';

var flattenStyle = require('react-native/Libraries/StyleSheet/flattenStyle');
var Easing = require('react-native/Libraries/Animated/src/Easing');
var noop = () => {};

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
var DEFAULT_ARROW_SIZE = new Size(16, 8);
export const PLACEMENT_OPTIONS = {
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left',
    AUTO: 'auto'
};

function Point(x, y) {
    this.x = x;
    this.y = y;
}

function Size(width, height) {
    this.width = width;
    this.height = height;
}

export function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

function isIOS() {
  return Platform.select({
    ios: () => { return true },
    android: () => { return false }
  })()
}

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
		this.computeGeometry = this.computeGeometry.bind(this);
		this.computeTopGeometry = this.computeTopGeometry.bind(this);
		this.computeBottomGeometry = this.computeBottomGeometry.bind(this);
		this.computeLeftGeometry = this.computeLeftGeometry.bind(this);
		this.computeRightGeometry = this.computeRightGeometry.bind(this);
		this.computeAutoGeometry = this.computeAutoGeometry.bind(this);
		this.getArrowSize = this.getArrowSize.bind(this);
		this.getArrowColorStyle = this.getArrowColorStyle.bind(this);
		this.getArrowRotation = this.getArrowRotation.bind(this);
		this.getArrowDynamicStyle = this.getArrowDynamicStyle.bind(this);
		this.getTranslateOrigin = this.getTranslateOrigin.bind(this);
		this.animateIn = this.animateIn.bind(this);
	}

    componentWillMount() {
      this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', e => this.keyboardDidShow(e));
      this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => this.keyboardDidHide());
    }

    keyboardDidShow(e) {
      this.shiftForKeyboard(e.endCoordinates.height);
    }

    keyboardDidHide() {
      let { displayArea } = this.props;
      if (displayArea.x === undefined || displayArea.y === undefined) {
          displayArea = new Rect(10, isIOS() ? 20 : 10, displayArea.width - 20, displayArea.height - 30);
      }
      this.handleGeomChange({displayArea});
    }

    shiftForKeyboard(keyboardHeight) {
      let { displayArea } = this.props;
      if (displayArea.x === undefined || displayArea.y === undefined) {
          displayArea = new Rect(10, isIOS() ? 20 : 10, displayArea.width - 20, displayArea.height - 30);
      }

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
      this.keyboardDidShowListener.remove()
      this.keyboardDidHideListener.remove()
      if (this.state.visible)
        this.animateOut()
    }

    measureContent(x) {
        var requestedContentSize = x.nativeEvent.layout;
        if (requestedContentSize.width && requestedContentSize.height && this.state.isAwaitingShow) {
          var geom = this.computeGeometry({requestedContentSize});

          //Debounce to prevent flickering when displaying a popover with content
          //that doesn't show immediately.
          this.setState(Object.assign(geom, {requestedContentSize, isAwaitingShow: false}), () => this.animateIn());
        }
    }

    updateState(state, callback) {
        if(!this._updateState) {
            this._updateState = _.debounce(this.setState.bind(this), 100);
        }
        this._updateState(state, callback);
    }

    computeGeometry({requestedContentSize, placement, fromRect, displayArea}) {
        placement = placement || this.props.placement;
        fromRect = fromRect || this.props.fromRect;
        displayArea = displayArea || this.props.displayArea;

        if (displayArea.x === undefined || displayArea.y === undefined) {
            displayArea = new Rect(10, isIOS() ? 20 : 10, displayArea.width - 20, displayArea.height - 30);
        }

        if (fromRect) {
          //check to see if fromRect is outside of displayArea, and adjust if it is
          if (fromRect.x > displayArea.x + displayArea.width) fromRect.x = displayArea.x + displayArea.width;
          if (fromRect.y > displayArea.y + displayArea.height) fromRect.y = displayArea.y + displayArea.height;
          if (fromRect.x < 0) fromRect.x = -1 * fromRect.width;
          if (fromRect.y < 0) fromRect.y = -1 * fromRect.height;

          var options = {
              displayArea,
              fromRect,
              arrowSize,
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
              height: Math.min(requestedContentSize.height, displayArea.height),
              width: Math.min(requestedContentSize.width, displayArea.width)
            }
          }
        }
    }

    computeTopGeometry({displayArea, fromRect, requestedContentSize, arrowSize}) {
        let minY = displayArea.y;
        let preferedY = fromRect.y - requestedContentSize.height - arrowSize.height;

        let forcedContentSize = {
          height: preferedY < minY ? (fromRect.y - arrowSize.height - displayArea.y) : requestedContentSize.height,
          width: Math.min(requestedContentSize.width, displayArea.width)
        }

        let maxX = displayArea.x + displayArea.width - forcedContentSize.width;
        let minX = displayArea.x;
        let preferedX = fromRect.x + (fromRect.width - forcedContentSize.width) / 2;

        var popoverOrigin = new Point(
            Math.min(maxX, Math.max(minX, preferedX)),
            Math.max(minY, preferedY)
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y);

        // Make sure the arrow isn't cut off
        anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2);
        anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2));

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.TOP,
            forcedContentSize
        }
    }

    computeBottomGeometry({displayArea, fromRect, requestedContentSize, arrowSize}) {
        let preferedY = fromRect.y + fromRect.height + arrowSize.height;

        let forcedContentSize = {
          height: preferedY + requestedContentSize.height > displayArea.y + displayArea.height ? displayArea.y + displayArea.height - preferedY : requestedContentSize.height,
          width: Math.min(requestedContentSize.width, displayArea.width)
        }

        let maxX = displayArea.x + displayArea.width - forcedContentSize.width;
        let minX = displayArea.x;
        let preferedX = fromRect.x + (fromRect.width - forcedContentSize.width) / 2;

        var popoverOrigin = new Point(
            Math.min(maxX, Math.max(minX, preferedX)),
            preferedY
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y + fromRect.height);

        // Make sure the arrow isn't cut off
        anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2);
        anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2));

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

    computeLeftGeometry({displayArea, fromRect, requestedContentSize, arrowSize}) {
        let forcedContentSize = {
          height: requestedContentSize.height > displayArea.height ? displayArea.height : requestedContentSize.height,
          width: Math.min(requestedContentSize.width, displayArea.width)
        }

        let preferedX = fromRect.x - forcedContentSize.width - arrowSize.width;

        let preferedY = fromRect.y + (fromRect.height - forcedContentSize.height) / 2;
        let minY = displayArea.y;
        let maxY = (displayArea.height - forcedContentSize.height) + displayArea.y;

        var popoverOrigin = new Point(
            preferedX,
            Math.min(Math.max(minY, preferedY), maxY)
        );

        var anchorPoint = new Point(fromRect.x, fromRect.y + fromRect.height / 2.0);

        // Make sure the arrow isn't cut off
        anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2);
        anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2));

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.LEFT,
            forcedContentSize
        }
    }

    computeRightGeometry({displayArea, fromRect, requestedContentSize, arrowSize}) {
        let forcedContentSize = {
          height: requestedContentSize.height > displayArea.height ? displayArea.height : requestedContentSize.height,
          width: Math.min(requestedContentSize.width, displayArea.width)
        }

        let preferedX = fromRect.x + fromRect.width + arrowSize.width;

        let preferedY = fromRect.y + (fromRect.height - forcedContentSize.height) / 2;
        let minY = displayArea.y;
        let maxY = (displayArea.height - forcedContentSize.height) + displayArea.y;

        var popoverOrigin = new Point(
            preferedX,
            Math.min(Math.max(minY, preferedY), maxY)
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + fromRect.height / 2.0);

        // Make sure the arrow isn't cut off
        anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2);
        anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2));

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.RIGHT,
            forcedContentSize
        }
    }

    computeAutoGeometry({displayArea, requestedContentSize, fromRect, arrowSize}) {
        let possiblePlacements = [];
        if (fromRect.x - displayArea.x - arrowSize.width >= requestedContentSize.width) { // We could fit it on the left side
            possiblePlacements.push(PLACEMENT_OPTIONS.LEFT)
            return this.computeGeometry({requestedContentSize, placement: PLACEMENT_OPTIONS.LEFT, fromRect, displayArea});
        }
        if (displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width >= requestedContentSize.width) { // We could fit it on the right side
            possiblePlacements.push(PLACEMENT_OPTIONS.RIGHT)

        }

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
        var {anchorPoint, popoverOrigin} = this.state;
        var arrowSize = this.props.arrowSize;

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
        const {forcedContentSize, popoverOrigin, anchorPoint} = this.state;

        const popoverCenter = new Point(popoverOrigin.x + (forcedContentSize.width / 2),
            popoverOrigin.y + (forcedContentSize.height / 2));
        const shiftHorizantal = anchorPoint.x - popoverCenter.x;
        const shiftVertical = anchorPoint.y - popoverCenter.y;
        return new Point(popoverOrigin.x + shiftHorizantal, popoverOrigin.y + shiftVertical);
    }

    componentDidMount() {
      if (this.props.isVisible)
        this.setState({requestedContentSize: {}, forcedContentSize: {}, isAwaitingShow: true, visible: true});
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
                this.setState({requestedContentSize: {}, forcedContentSize: {}, isAwaitingShow: true, visible: true});
            } else {
                this.animateOut();
            }
        } else if (willBeVisible && ((fromRect !== undefined && JSON.stringify(nextProps.fromRect) !== JSON.stringify(fromRect)) || (displayArea !== undefined && JSON.stringify(nextProps.displayArea) !== JSON.stringify(displayArea)))) {
            this.handleGeomChange(nextProps);
        }
    }

    handleGeomChange({displayArea, fromRect}) {
      let { requestedContentSize, forcedContentSize, placement, anchorPoint, popoverOrigin, animatedValues } = this.state;

      let geom = this.computeGeometry({requestedContentSize, displayArea, fromRect});

      let newState = {}

      if (geom.forcedContentSize !== forcedContentSize)
        newState.forcedContentSize = geom.forcedContentSize;

      if (geom.anchorPoint !== anchorPoint)
        newState.anchorPoint = geom.anchorPoint;

      if (geom.placement !== placement)
        newState.placement = geom.placement;

      this.setState(newState, () => {
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

      // Should grow from anchor point
      let translateStart = this.getTranslateOrigin()
      translateStart.x += SCREEN_WIDTH // Temp fix for useNativeDriver issue
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

      translatePoint.x = translatePoint.x + SCREEN_WIDTH // Temp fix for useNativeDriver issue

      if (!fade && fade !== 0) console.warn("Popover: Fade value is null")
      else if (!translatePoint || (!translatePoint.x && translatePoint.x !== 0) && (!translatePoint.y !== 0)) console.warn("Popover: Translate Point value is null")
      else if (!scale && scale !== 0) console.warn("Popover: Scale value is null")
      else {
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
        ]).start(callback);
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
            {translateX: SCREEN_WIDTH /* Temp fix for useNativeDriver issue */ + anchorPoint.x - arrowWidth / 2},
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
          outputRange: [0, SCREEN_WIDTH, SCREEN_WIDTH]
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
          ...forcedContentSize,
          position: 'absolute',
          ...styles.dropShadow,
          ...styles.popoverContent
        };

        let contentView = (
            <Animated.View style={containerStyle}>
              {this.props.showBackground &&
                <TouchableWithoutFeedback onPress={this.props.onClose}>
                  <Animated.View style={backgroundStyle}/>
                </TouchableWithoutFeedback>
              }
              <View style={{top: 0, left: 0}}>
                  <Animated.View ref='content' onLayout={evt => this.measureContent(evt)} style={popoverViewStyle}>
                    {this.props.children}
                  </Animated.View>
                  {this.props.showArrow && this.props.fromRect !== undefined && this.props.fromRect !== null &&
                    <View style={arrowStyle}>
                      <Animated.View style={arrowInnerStyle}/>
                    </View>
                  }
              </View>
            </Animated.View>
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
        left: -1 * SCREEN_WIDTH,
        right: 0,
        position: 'absolute',
        backgroundColor: 'transparent'
    },
    background: {
        top: 0,
        bottom: 0,
        left: 0,
        right: SCREEN_WIDTH,
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
	displayArea: new Rect(10, 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-20),
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
