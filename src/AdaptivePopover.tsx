import React, { Component, ReactNode, RefObject } from 'react';
import { Dimensions, EmitterSubscription, Keyboard, View } from 'react-native';
import { DEBUG, isIOS } from './Constants';
import { Point, PopoverProps, Rect } from './Types';
import { getChangedProps, getRectForRef } from './Utility';
import BasePopover from './BasePopover';

interface AdaptivePopoverState {
  fromRect: Rect | null;
  shiftedDisplayArea: Rect | null;
  defaultDisplayArea: Rect | null;
  displayAreaOffset: Point | null;
  showing: boolean;
}

type AdaptivePopoverProps = PopoverProps & {
  fromRect?: Rect;
  fromRef?: RefObject<View>;
  displayArea?: Rect;
  getDisplayAreaOffset: () => Promise<Point>;
  showBackground?: boolean;
}

export default class AdaptivePopover extends Component<AdaptivePopoverProps, AdaptivePopoverState> {
  state = {
    fromRect: null,
    shiftedDisplayArea: null,
    defaultDisplayArea: null,
    displayAreaOffset: null,
    showing: false
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
      this.debug('[AdaptivePopover] getDisplayArea - displayAreaInsets', displayAreaInsets);
      return new Rect(
        displayArea.x + (displayAreaInsets.left ?? 0),
        displayArea.y + (displayAreaInsets.top ?? 0),
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
  private keyboardDidHideSubscription: EmitterSubscription | null = null;
  private keyboardDidShowSubscription: EmitterSubscription | null = null;
  private handleResizeEventSubscription: EmitterSubscription | null = null;

  constructor(props: AdaptivePopoverProps) {
    super(props);
    this.handleResizeEvent = this.handleResizeEvent.bind(this);
    this.keyboardDidHide = this.keyboardDidHide.bind(this);
    this.keyboardDidShow = this.keyboardDidShow.bind(this);
  }

  componentDidMount(): void {
    this.handleResizeEventSubscription = Dimensions.addEventListener('change', this.handleResizeEvent);
    if (this.props.fromRect) this.setState({ fromRect: this.props.fromRect });
    else if (this.props.fromRef) this.calculateRectFromRef();
    this._isMounted = true;
  }

  componentWillUnmount(): void {
    this._isMounted = false;

    if (typeof this.handleResizeEventSubscription?.remove === 'function')
      this.handleResizeEventSubscription?.remove();
    else
      // Backward-compatibility with RN <= 0.63
      Dimensions.removeEventListener('change', this.handleResizeEvent);

    this.keyboardDidShowSubscription?.remove();
    this.keyboardDidHideSubscription?.remove();
  }

  componentDidUpdate(prevProps: AdaptivePopoverProps): void {
    // Make sure a value we care about has actually changed
    const importantProps = ['fromRef', 'fromRect', 'displayArea'];
    const changedProps = getChangedProps(this.props, prevProps, importantProps);
    if (!changedProps.length) return;
    this.debug('[AdaptivePopover] componentDidUpdate - changedProps', changedProps);

    if (changedProps.includes('fromRect')) {
      this.debug('componentDidUpdate - fromRect changed', this.props.fromRect);
      this.setState({ fromRect: this.props.fromRect || null });
    } else if (this.props.fromRef !== prevProps.fromRef) {
      this.debug('componentDidUpdate - fromRef changed');
      if (this.props.fromRef) this.calculateRectFromRef();
      else this.setState({ fromRect: null });
    }

    if (this.props.isVisible && prevProps.isVisible) {
      if (
        changedProps.includes('displayArea') ||
        (
          this.displayAreaStore &&
          !this.getDisplayArea().equals(this.displayAreaStore)
        )
      ) {
        this.debug('componentDidUpdate - displayArea changed', this.getDisplayArea());
        this.displayAreaStore = this.getDisplayArea();
      }
    }
  }


  // First thing called when device rotates
  handleResizeEvent(change: unknown): void {
    this.debug('handleResizeEvent - New Dimensions', change);
    if (this.props.isVisible) {
      this.waitForResizeToFinish = true;
    }
  }

  debug(line: string, obj?: unknown): void {
    if (DEBUG || this.props.debug)
      console.log(`[${(new Date()).toISOString()}] ${line}${obj ? `: ${JSON.stringify(obj)}` : ''}`);
  }

  async setDefaultDisplayArea(newDisplayArea: Rect): Promise<void> {
    if (!this._isMounted) return;

    const { defaultDisplayArea }: Partial<AdaptivePopoverState> = this.state;

    /*
     * When the popover is closing and the display area's onLayout event is called,
     * the width/height values may be zero which causes a bad display area for the
     * first mount when the popover re-opens
     */
    const isValidDisplayArea = newDisplayArea.width > 0 && newDisplayArea.height > 0;
    if (
      (!defaultDisplayArea || !newDisplayArea.equals(defaultDisplayArea)) &&
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
  keyboardDidShow(e: { endCoordinates: { height: number } }): void {
    this.debug(`keyboardDidShow - keyboard height: ${e.endCoordinates.height}`);
    this.shiftForKeyboard(e.endCoordinates.height);
  }

  keyboardDidHide(): void {
    this.debug('keyboardDidHide');
    if (this._isMounted) this.setState({ shiftedDisplayArea: null });
  }

  shiftForKeyboard(keyboardHeight: number): void {
    const displayArea = this.getUnshiftedDisplayArea();

    const absoluteVerticalCutoff =
      Dimensions.get('window').height - keyboardHeight - (isIOS ? 10 : 40);
    const combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);

    this.setState({
      shiftedDisplayArea:
        new Rect(displayArea.x, displayArea.y, displayArea.width, combinedY - displayArea.y)
    });
  }

  async calculateRectFromRef(): Promise<void> {
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
      /*
       * Checking if x and y is less than 0 because of a strange issue on Android related
       * to the "Toggle from" feature, where the rect.y is a large negative number at first
       */
    } while (rect.equals(initialRect) || rect.y < 0 || rect.x < 0);

    this.debug('calculateRectFromRef - calculated Rect', rect);
    if (this._isMounted) this.setState({ fromRect: rect });
  }

  render(): ReactNode {
    const { onOpenStart, onCloseStart, onCloseComplete, fromRef, ...otherProps } = this.props;
    const { fromRect, showing } = this.state;

    // Don't render popover until we have an initial fromRect calculated for the view
    if (fromRef && !fromRect && !showing) return null;

    return (
      <BasePopover
        {...otherProps}
        displayArea={this.getDisplayArea()}
        fromRect={fromRect}
        onOpenStart={() => {
          if (onOpenStart) onOpenStart();
          this.debug('Setting up keyboard listeners');
          this.keyboardDidShowSubscription = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
          this.keyboardDidHideSubscription = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);
          this.displayAreaStore = this.getDisplayArea();
          this.setState({ showing: true });
        }}
        onCloseStart={() => {
          if (onCloseStart) onCloseStart();
          this.debug('Tearing down keyboard listeners');
          if (this.keyboardDidShowSubscription !== null) {
            this.keyboardDidShowSubscription.remove();
            this.keyboardDidShowSubscription = null;
          }
          if (this.keyboardDidHideSubscription !== null) {
            this.keyboardDidHideSubscription.remove();
            this.keyboardDidHideSubscription = null;
          }
          if (this._isMounted) this.setState({ shiftedDisplayArea: null });
        }}
        onCloseComplete={() => {
          this.setState({ showing: false }, () => {
            if (onCloseComplete) onCloseComplete();
          });
        }}
        skipMeasureContent={() => this.waitForResizeToFinish}
        onDisplayAreaChanged={rect => this.setDefaultDisplayArea(rect)}
      />
    );

  }
}
