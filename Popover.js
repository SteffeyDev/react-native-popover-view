'use strict';

import React, {PropTypes} from 'react';
import {StyleSheet, Dimensions, Animated, Text, TouchableWithoutFeedback, View, Modal, Platform, Keyboard, Alert} from 'react-native';
import _ from 'underscore';

var flattenStyle = require('react-native/Libraries/StyleSheet/flattenStyle');
var Easing = require('react-native/Libraries/Animated/src/Easing');
var noop = () => {};

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
var DEFAULT_ARROW_SIZE = new Size(16, 8);
const PLACEMENT_OPTIONS = {
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

function Rect(x, y, width, height) {
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

var Popover = React.createClass({
    propTypes: {
        isVisible: PropTypes.bool,
        onClose: PropTypes.func,
        mode: PropTypes.string,
        layoutDirection: PropTypes.string
    },

    componentWillMount() {
      this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', e => this.keyboardDidShow(e));
      this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => this.keyboardDidHide());
    },
    keyboardDidShow(e) {
      if (this.state.contentSize.height !== undefined && this.state.popoverOrigin.y !== undefined && this.props.displayArea.height !== undefined) {
        let keyboardHeight = e.endCoordinates.height;

        if (this.props.isVisible && this.state.contentSize.height + this.state.popoverOrigin.y > this.props.displayArea.height - keyboardHeight) {
          let toShiftTo = (this.props.displayArea.height - keyboardHeight) - (this.state.contentSize.height + this.state.popoverOrigin.y) - 10;
          if (toShiftTo <= -this.state.popoverOrigin.y)
            toShiftTo = -this.state.popoverOrigin.y + 10;
          this.shiftForKeyboard(toShiftTo);
        }

        this.setState({keyboardHeight})
      }
    },
    shiftForKeyboard(toShift) {
      Animated.timing(this.state.defaultAnimatedValues.translate, {
        toValue: toShift !== 0 ? new Point(0, toShift) : new Point(0, 0),
        duration: 500,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false
      }).start(() => this.setState({shiftedUp: toShift !== 0}))
    },
    keyboardDidHide() {
      if (this.state.shiftedUp)
        this.shiftForKeyboard(0);

      this.setState({keyboardHeight: 0})
    },
    componentWillUnmount() {
      this.keyboardDidShowListener.remove()
      this.keyboardDidHideListener.remove()
    },

    getInitialState() {
        return {
            contentSize: {},
            anchorPoint: {},
            popoverOrigin: {},
            shiftedUp: false,
            placement: PLACEMENT_OPTIONS.AUTO,
            defaultAnimatedValues: {
                scale: new Animated.Value(0),
                translate: new Animated.ValueXY(),
                fade: new Animated.Value(0)
            }
        };
    },

    getDefaultProps() {
        return {
            isVisible: false,
            displayArea: new Rect(10, 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-20),
            arrowSize: DEFAULT_ARROW_SIZE,
            placement: PLACEMENT_OPTIONS.AUTO,
            onClose: noop,
            mode: 'popover'
        };
    },

    measureContent(x) {
        var {width, height} = x.nativeEvent.layout;
        var contentSize = {width, height};
        if (contentSize.width && contentSize.height && this.state.isAwaitingShow) {
          console.log("check");
          console.log(contentSize);
          var geom = this.computeGeometry({contentSize});

          var isAwaitingShow = this.state.isAwaitingShow;

          //Debounce to prevent flickering when displaying a popover with content
          //that doesn't show immediately.
          this.updateState(Object.assign(geom, {contentSize, isAwaitingShow: undefined}), () => {
              // Once state is set, call the showHandler so it can access all the geometry
              // from the state
              isAwaitingShow && this._startAnimation({show: true});
          });
        }
    },

    updateState(state, callback) {
        if(!this._updateState) {
            this._updateState = _.debounce(this.setState.bind(this), 100);
        }
        this._updateState(state, callback);
    },

    computeGeometry({contentSize, placement}, fromRect, displayArea) {
        placement = placement || this.props.placement;
        fromRect = fromRect || this.props.fromRect;
        displayArea = displayArea || this.props.displayArea;

        //check to see if the mode is select
        //and pass in a dummy arrowSize object
        var arrowSize;
        if (this.props.mode === 'select') {
            arrowSize = {
                height: 0,
                width: 0
            };
        } else {
            arrowSize = this.getArrowSize(placement);
        }

        if (displayArea.x === undefined || displayArea.y === undefined) {
            displayArea = new Rect(10, isIOS() ? 20 : 10, displayArea.width - 20, displayArea.height - 30);
        }

        if (fromRect) {
          var options = {
              displayArea,
              fromRect,
              arrowSize,
              contentSize
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
          console.log("floating");
          console.log(displayArea);
          console.log(contentSize);
          console.log(new Point((displayArea.width - contentSize.width)/2, (displayArea.height - contentSize.height)/2));
          console.log(new Point(displayArea.width/2, displayArea.height/2));
          return {
            popoverOrigin: new Point((displayArea.width - contentSize.width)/2, (displayArea.height - contentSize.height)/2),
            anchorPoint: new Point(displayArea.width/2, displayArea.height/2),
            forcedHeight: contentSize.height > displayArea.height ? displayArea.height : null
          }
        }
    },

    computeTopGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        let maxX = displayArea.x + displayArea.width - contentSize.width;
        let minX = displayArea.x;
        let preferedX = fromRect.x + (fromRect.width - contentSize.width) / 2;

        let minY = displayArea.y;
        let preferedY = fromRect.y - contentSize.height - arrowSize.height;

        var popoverOrigin = new Point(
            Math.min(maxX, Math.max(minX, preferedX)),
            Math.max(minY, preferedY)
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.TOP,
            forcedHeight: preferedY < minY ? (fromRect.y - arrowSize.height - displayArea.y) : null
        }
    },

    computeBottomGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        let maxX = displayArea.x + displayArea.width - contentSize.width;
        let minX = displayArea.x;
        let preferedX = fromRect.x + (fromRect.width - contentSize.width) / 2;

        let preferedY = fromRect.y + fromRect.height + arrowSize.height;

        var popoverOrigin = new Point(
            Math.min(maxX, Math.max(minX, preferedX)),
            preferedY
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y + fromRect.height);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.BOTTOM,
            forcedHeight: preferedY + contentSize.height > displayArea.y + displayArea.height ? displayArea.y + displayArea.height - preferedY : null
        }
    },

    getPolarity () {
        return this.props.layoutDirection === 'rtl' ? -1 : 1;
    },

    computeLeftGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        let preferedX = fromRect.x - contentSize.width - arrowSize.width;

        let preferedY = fromRect.y + (fromRect.height - contentSize.height) / 2;
        let minY = displayArea.y;

        var popoverOrigin = new Point(
            preferedX,
            Math.max(minY, preferedY)
        );

        var anchorPoint = new Point(fromRect.x, fromRect.y + fromRect.height / 2.0);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.LEFT,
            forcedHeight: contentSize.height > displayArea.height ? displayArea.height : null
        }
    },

    computeRightGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        let preferedX = fromRect.x + fromRect.width + arrowSize.width;

        let preferedY = fromRect.y + (fromRect.height - contentSize.height) / 2;
        let minY = displayArea.y;

        var popoverOrigin = new Point(
            preferedX,
            Math.max(minY, preferedY)
        );

        var anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + fromRect.height / 2.0);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.RIGHT,
            forcedHeight: contentSize.height > displayArea.height ? displayArea.height : null
        }
    },

    computeAutoGeometry({displayArea, contentSize, fromRect, arrowSize}) {
        //let placementsToTry;
        // if (this.props.mode === 'popover') {
        //     placementsToTry = ['left', 'right', 'bottom', 'top'];
        // } else {
        //     placementsToTry = ['bottom', 'top'];
        // }

        if (fromRect.x - displayArea.x - arrowSize.width >= contentSize.width) { // We could fit it on the left side
            return this.computeGeometry({contentSize, placement: 'left'});
        } else if (displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width >= contentSize.width) { // We could fit it on the right side
            return this.computeGeometry({contentSize, placement: 'right'});
        } else { // We could fit it on the top or bottom, need to figure out which is better
            let topSpace = fromRect.y - displayArea.y;
            let bottomSpace = displayArea.y + displayArea.height - (fromRect.y + fromRect.height);
            return topSpace > bottomSpace ? this.computeGeometry({contentSize, placement: 'top'}) : this.computeGeometry({contentSize, placement: 'bottom'});
        }


        // for (var i = 0; i < placementsToTry.length; i++) {
        //     var placement = placementsToTry[i];
        //     var geom = this.computeGeometry({contentSize, placement});
        //     var {popoverOrigin} = geom;
        //
        //     if (popoverOrigin.x >= displayArea.x
        //         && popoverOrigin.x <= displayArea.x + displayArea.width - contentSize.width
        //         && popoverOrigin.y >= displayArea.y
        //         && popoverOrigin.y <= displayArea.y + displayArea.height - contentSize.height) {
        //             break;
        //         }
        // }

        return geom;
    },

    getArrowSize(placement) {
        var size = this.props.arrowSize;
        switch(placement) {
            case PLACEMENT_OPTIONS.LEFT:
            case PLACEMENT_OPTIONS.RIGHT:
                return new Size(size.height, size.width);
            default:
                return size;
        }
    },

    getArrowColorStyle(color) {
        return { borderTopColor: color };
    },

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
    },

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
            left: anchorPoint.x - popoverOrigin.x - width / 2,
            top: anchorPoint.y - popoverOrigin.y - height / 2,
            width: width,
            height: height,
            borderTopWidth: height / 2,
            borderRightWidth: width / 2,
            borderBottomWidth: height / 2,
            borderLeftWidth: width / 2,
        }
    },

    getTranslateOrigin() {
        var {contentSize, popoverOrigin, anchorPoint, forcedHeight} = this.state;
        let height = forcedHeight  || contentSize.height;

        var popoverCenter = new Point(popoverOrigin.x + contentSize.width / 2,
            popoverOrigin.y + height / 2);
        return new Point(this.getPolarity() * (anchorPoint.x - popoverCenter.x), anchorPoint.y - popoverCenter.y);
    },

    componentDidMount() {
      if (this.props.isVisible)
        this.setState({contentSize: {}, isAwaitingShow: true, visible: true});
    },

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
                this.setState({contentSize: {}, isAwaitingShow: true, visible: true});
            } else {
                this._startAnimation({show: false});
            }
        } else if (willBeVisible && ((fromRect !== undefined && JSON.stringify(nextProps.fromRect) !== JSON.stringify(fromRect)) || (displayArea !== undefined && JSON.stringify(nextProps.displayArea) !== JSON.stringify(displayArea)))) {
            var contentSize = this.state.contentSize;

            var geom = this.computeGeometry({contentSize}, nextProps.fromRect, nextProps.displayArea);

            var isAwaitingShow = this.state.isAwaitingShow;
            this.setState(Object.assign(geom, {contentSize, isAwaitingShow: undefined}), () => {
                // Once state is set, call the showHandler so it can access all the geometry
                // from the state
                isAwaitingShow && this._startAnimation({show: true});

            });
        }
    },

    _startAnimation({show}) {
        var handler = this.props.startCustomAnimation || this._startDefaultAnimation;
        handler({show, doneCallback: show ? null : obj => this.setState({visible: false})});
    },

    _startDefaultAnimation({show, doneCallback}) {
        var animDuration = 300;
        var values = this.state.defaultAnimatedValues;
        var translateOrigin = this.getTranslateOrigin();

        if (show) {
            values.translate.setValue(translateOrigin);
        }

        var commonConfig = {
            duration: animDuration,
            easing: show ? Easing.out(Easing.back()) : Easing.inOut(Easing.quad),
            useNativeDriver: false
        }

        Animated.parallel([
            Animated.timing(values.fade, {
                toValue: show ? 1 : 0,
                ...commonConfig,
            }),
            Animated.timing(values.translate, {
                toValue: show ? new Point(0, 0) : translateOrigin,
                ...commonConfig,
            }),
            Animated.timing(values.scale, {
                toValue: show ? 1 : 0,
                ...commonConfig,
            })
        ]).start(doneCallback);
    },

    _getDefaultAnimatedStyles() {
        // If there's a custom animation handler,
        // we don't return the default animated styles
        if (typeof this.props.startCustomAnimation !== 'undefined') {
            return null;
        }

        var animatedValues = this.state.defaultAnimatedValues;

        return {
            backgroundStyle: {
                opacity: animatedValues.fade,
            },
            arrowStyle: {
                transform: [
                    {
                        scale: animatedValues.scale.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                        }),
                    }
                ],
            },
            contentStyle: {
                transform: [
                    {translateX: animatedValues.translate.x},
                    {translateY: animatedValues.translate.y},
                    {scale: animatedValues.scale},
                ],
            }
        };
    },

    _getExtendedStyles() {
        var background = [];
        var popover = [];
        var arrow = [];
        var content = [];

        [this._getDefaultAnimatedStyles(), this.props].forEach((source) => {
            if (source) {
                background.push(source.backgroundStyle);
                popover.push(source.popoverStyle);
                arrow.push(source.arrowStyle);
                content.push(source.contentStyle);
            }
        });

        return {
            background,
            popover,
            arrow,
            content
        }
    },

    render() {

        var {popoverOrigin, placement, forcedHeight} = this.state;
        var extendedStyles = this._getExtendedStyles();
        var contentContainerStyle = [styles.contentContainer, ...extendedStyles.content];
        var contentModeStyling;
        var dropShadowStyling;
        var contentStyle;
        var arrowColorStyle;
        var arrowDynamicStyle = this.getArrowDynamicStyle();

        //apply the relevant style required
        if (this.props.mode === 'select') {
            contentModeStyling = styles.selectContainer;
            dropShadowStyling = null;
        } else {
            contentModeStyling = styles.popoverContainer;
            dropShadowStyling = styles.dropShadow;
            contentStyle = styles.popoverContent;
            arrowColorStyle = this.getArrowColorStyle(flattenStyle(styles.popoverContent).backgroundColor);
        }
        // Special case, force the arrow rotation even if it was overriden
        var arrowStyle = [styles.arrow, arrowDynamicStyle, arrowColorStyle, ...extendedStyles.arrow];
        var arrowTransform = (flattenStyle(arrowStyle).transform || []).slice(0);
        arrowTransform.unshift({rotate: this.getArrowRotation(placement)});
        arrowStyle = [...arrowStyle, {transform: arrowTransform}];

        var contentSizeAvailable = this.state.contentSize.width;

        return (
          <Modal transparent={true} supportedOrientations={['portrait', 'landscape']} hardwareAccelerated={true} visible={this.state.visible} onRequestClose={this.props.onClose}>
            <View style={[styles.container, contentSizeAvailable && styles.containerVisible]}>
              <TouchableWithoutFeedback onPress={this.props.onClose}>
                <Animated.View style={[styles.background, ...extendedStyles.background]}/>
              </TouchableWithoutFeedback>
              <Animated.View style={[{top: popoverOrigin.y, left: popoverOrigin.x,}, ...extendedStyles.popover]}>
                  <Animated.View ref='content' onLayout={this.measureContent} style={[contentContainerStyle, contentModeStyling]}>
                      <Animated.View style={[{width: contentSizeAvailable, height: forcedHeight}, contentStyle, dropShadowStyling]}>
                          {this.props.children}
                      </Animated.View>
                  </Animated.View>
                  {this.props.mode === 'popover' && this.props.fromRect !== undefined && <Animated.View style={arrowStyle}/>}
              </Animated.View>
            </View>
          </Modal>
        );
    }
});

var styles = StyleSheet.create({
    container: {
        opacity: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        position: 'absolute',
        backgroundColor: 'transparent'
    },
    containerVisible: {
        opacity: 1
    },
    background: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
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
});

module.exports = Popover;
