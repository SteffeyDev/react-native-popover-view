import React, { Component, ReactNode } from 'react';
import { Animated, Easing, EasingFunction, I18nManager, LayoutChangeEvent, StyleSheet, TouchableWithoutFeedback, View, ViewStyle } from 'react-native';
import Arrow, { ArrowProps } from './Arrow';
import { DEBUG, DEFAULT_ARROW_SIZE, FIX_SHIFT, isWeb, styles } from './Constants';
import { computeGeometry, Geometry } from './Geometry';
import { Placement, Point, PopoverProps, Rect, Size } from './Types';
import { getChangedProps, getRectForRef } from './Utility';

type BasePopoverProps = Omit<PopoverProps, 'displayAreaInsets'> & {
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


export default class BasePopover extends Component<BasePopoverProps, BasePopoverState> {
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

  componentDidMount(): void {
    this._isMounted = true;
  }

  componentDidUpdate(prevProps: BasePopoverProps): void {
    // Make sure a value we care about has actually changed
    const importantProps = ['isVisible', 'fromRect', 'displayArea', 'verticalOffset', 'offset', 'placement'];
    const changedProps = getChangedProps(this.props, prevProps, importantProps);
    if (!changedProps.length) return;
    this.debug('[BasePopover] componentDidUpdate - changedProps', changedProps);

    if (this.props.isVisible !== prevProps.isVisible) {
      this.debug(`componentDidUpdate - isVisible changed, now ${this.props.isVisible}`);
      if (!this.props.isVisible) {
        if (this.state.showing) this.animateOut();
        else this.animateOutAfterShow = true;
        this.debug('componentDidUpdate - Hiding popover');
      }
    } else if (this.props.isVisible && prevProps.isVisible) {
      this.debug('componentDidUpdate - isVisible not changed, handling other changes');
      this.handleChange();
    }
  }

  componentWillUnmount(): void {
    this._isMounted = false;

    if (this.state.showing) {
      this.debug('componentWillUnmount');
      this.animateOut();
    }
  }

  measureContent(requestedContentSize: Size): void {
    if (!requestedContentSize.width) {
      console.warn(`Popover Warning - Can't Show - The Popover content has a width of 0, so there is nothing to present.`);
      return;
    }
    if (!requestedContentSize.height) {
      console.warn(`Popover Warning - Can't Show - The Popover content has a height of 0, so there is nothing to present.`);
      return;
    }
    if (this.props.skipMeasureContent()) {
      this.debug(`measureContent - Skipping, waiting for resize to finish`);
      return;
    }

    if (
      !this.state.requestedContentSize ||
      !requestedContentSize.equals(this.state.requestedContentSize)
    ) {
      this.debug(`measureContent - new requestedContentSize: ${JSON.stringify(requestedContentSize)} (used to be ${JSON.stringify(this.state.requestedContentSize)})`);
      this.setState({ requestedContentSize }, () => this.handleChange());
    } else {
      this.debug(`measureContent - Skipping, content size did not change`);
    }
  }

  /*
   * Many factors may cause the geometry to change.
   * This function collects all of them, waiting for 200ms after the last change,
   * then takes action, either bringing up the popover or moving it to its new location
   */
  handleChange(): void {
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
        arrowSize,
        popoverStyle,
        fromRect,
        displayArea,
        placement,
        onOpenStart,
        arrowShift,
        onPositionChange,
        offset,
        popoverShift
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
          arrowSize: arrowSize || DEFAULT_ARROW_SIZE,
          popoverStyle,
          arrowShift,
          debug: this.debug.bind(this),
          previousPlacement: this.getGeom().placement,
          offset,
          popoverShift
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
              geom,
              callback: onPositionChange
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
      forcedContentSize: new Size(0, 0),
      viewLargerThanDisplayArea: {
        width: false,
        height: false
      }
    });
  }

  getTranslateOrigin(): Point {
    const { requestedContentSize } = this.state;
    const arrowSize = this.props.arrowSize || DEFAULT_ARROW_SIZE;
    const {
      forcedContentSize,
      viewLargerThanDisplayArea,
      anchorPoint,
      placement
    } = this.getGeom();

    let viewWidth = 0;
    if (viewLargerThanDisplayArea.width && forcedContentSize?.width)
      viewWidth = forcedContentSize.width;
    else if (requestedContentSize?.width)
      viewWidth = requestedContentSize.width;
    if ([Placement.LEFT, Placement.RIGHT].includes(placement))
      viewWidth += arrowSize.height;

    let viewHeight = 0;
    if (viewLargerThanDisplayArea.height && forcedContentSize?.height)
      viewHeight = forcedContentSize.height;
    else if (requestedContentSize?.height)
      viewHeight = requestedContentSize.height;
    if ([Placement.TOP, Placement.BOTTOM].includes(placement))
      viewHeight += arrowSize.height;

    this.debug('getTranslateOrigin - popoverSize', { width: viewWidth, height: viewHeight });
    this.debug('getTranslateOrigin - anchorPoint', anchorPoint);

    return new Point(
      anchorPoint.x - (viewWidth / 2),
      anchorPoint.y - (viewHeight / 2)
    );
  }

  animateOut(): void {
    if (this.props.onCloseStart) setTimeout(this.props.onCloseStart);

    if (this._isMounted) this.setState({ showing: false });

    this.debug('animateOut - isMounted', this._isMounted);
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

  animateIn(): void {
    const { nextGeom } = this.state;
    if (nextGeom !== undefined && nextGeom instanceof Geometry) {
      const values = this.state.animatedValues;

      // Should grow from anchor point
      const translateStart = this.getTranslateOrigin();
      // eslint-disable-next-line
      translateStart.y += FIX_SHIFT // Temp fix for useNativeDriver issue
      values.translate.setValue(translateStart);
      const translatePoint = new Point(nextGeom.popoverOrigin.x, nextGeom.popoverOrigin.y);

      this.debug('animateIn - translateStart', translateStart);
      this.debug('animateIn - translatePoint', translatePoint);
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
  ): void {
    const { fade, translatePoint, scale, callback, easing, values } = args;
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
      })
    ]).start(() => {
      this.animating = false;
      if (this._isMounted) this.setState({ activeGeom: this.state.nextGeom });
      if (callback) callback();
    });
  }

  render(): ReactNode {
    const {
      animatedValues,
      nextGeom,
      requestedContentSize
    }: Partial<BasePopoverState> = this.state;
    const flattenedPopoverStyle = StyleSheet.flatten(this.props.popoverStyle);
    const arrowSize = this.props.arrowSize || DEFAULT_ARROW_SIZE;
    const geom = this.getGeom();

    const transformStyle = {
      position: 'absolute' as const,
      ...requestedContentSize,
      transform: [
        { translateX: animatedValues.translate.x },
        { translateY: animatedValues.translate.y },
        { scale: animatedValues.scale }
      ]
    };

    const {
      shadowOffset,
      shadowColor,
      shadowOpacity,
      shadowRadius,
      elevation,
      ...otherPopoverStyles
    } = flattenedPopoverStyle;

    const shadowStyle = {
      shadowOffset,
      shadowColor,
      shadowOpacity,
      shadowRadius
    };

    const contentWrapperStyle: ViewStyle = {
      ...styles.popoverContent,
      ...otherPopoverStyles,
      elevation
    };

    /*
     * We want to always use next here, because the we need this to re-render
     * before we can animate to the correct spot for the active.
     */
    if (nextGeom) {
      contentWrapperStyle.maxWidth = nextGeom.forcedContentSize.width;
      contentWrapperStyle.maxHeight = nextGeom.forcedContentSize.height;
    }

    const arrowPositionStyle: ArrowProps['positionStyle'] = {};

    if (geom.placement === Placement.RIGHT || geom.placement === Placement.LEFT) {
      arrowPositionStyle.top = geom.anchorPoint.y - geom.popoverOrigin.y - arrowSize.height;
      if (transformStyle.width) transformStyle.width += arrowSize.height;
      if (geom.placement === Placement.RIGHT) contentWrapperStyle.left = arrowSize.height;
    } else if (geom.placement === Placement.TOP || geom.placement === Placement.BOTTOM) {
      arrowPositionStyle.left = geom.anchorPoint.x - geom.popoverOrigin.x - (arrowSize.width / 2);
      if (transformStyle.height) transformStyle.height += arrowSize.height;
      if (geom.placement === Placement.BOTTOM) contentWrapperStyle.top = arrowSize.height;
    }
    switch (geom.placement) {
      case Placement.TOP: arrowPositionStyle.bottom = 0; break;
      case Placement.BOTTOM: arrowPositionStyle.top = 0; break;
      case Placement.LEFT: arrowPositionStyle.right = 0; break;
      case Placement.RIGHT: arrowPositionStyle.left = 0; break;
      default:
    }

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

    const backgroundColor = flattenedPopoverStyle.backgroundColor ||
      styles.popoverContent.backgroundColor;

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

          <View pointerEvents="box-none" style={{ top: 0, left: 0, ...shadowStyle }}>
            <Animated.View style={transformStyle}>
              <View
                ref={this.popoverRef}
                style={contentWrapperStyle}
                onLayout={(evt: LayoutChangeEvent) => {
                  const layout = { ...evt.nativeEvent.layout };
                  setTimeout(
                    () => this._isMounted &&
                      this.measureContent(new Size(layout.width, layout.height)),
                    10
                  );
                }}>
                {this.props.children}
              </View>
              {geom.placement !== Placement.FLOATING &&
                <Arrow
                  ref={this.arrowRef}
                  placement={geom.placement}
                  color={backgroundColor}
                  arrowSize={arrowSize}
                  positionStyle={arrowPositionStyle}
                  elevation={elevation}
                />
              }
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    );
  }
}
