import React, { Component, RefObject, ReactNode, ReactElement } from 'react';
import PropTypes from 'prop-types';
import { ViewPropTypes } from 'deprecated-react-native-prop-types';
import { View, ViewProps } from 'react-native';
import { Rect, PopoverProps, Placement, Mode, Point, Size } from './Types';
import { DEFAULT_ARROW_SIZE } from './Constants';
import JSModalPopover from './JSModalPopover';
import RNModalPopover from './RNModalPopover';

export interface PublicPopoverProps extends Omit<PopoverProps, 'displayArea' | 'arrowSize'> {
  displayArea?: Pick<Rect, 'x' | 'y' | 'width' | 'height'>;
  arrowSize?: Pick<Size, 'width' | 'height'>;
  mode?: Mode;
  from?:
    | Rect
    | RefObject<View>
    | ((sourceRef: RefObject<View>, openPopover: () => void) => ReactNode)
    | ReactNode
    | Point;
  testID?: ViewProps['testID'];
}

interface PublicPopoverState {
  isVisible: boolean;
}

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
    placement: PropTypes.oneOfType([
      PropTypes.oneOf([
        Placement.LEFT,
        Placement.RIGHT,
        Placement.TOP,
        Placement.BOTTOM,
        Placement.AUTO,
        Placement.FLOATING,
        Placement.CENTER
      ]),
      PropTypes.arrayOf(
        PropTypes.oneOf([
          Placement.LEFT,
          Placement.RIGHT,
          Placement.TOP,
          Placement.BOTTOM,
          Placement.AUTO,
          Placement.FLOATING,
          Placement.CENTER
        ])
      )
    ]),
    animationConfig: PropTypes.object,
    verticalOffset: PropTypes.number,

    // style
    popoverStyle: ViewPropTypes.style,
    popoverShift: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number
    }),
    backgroundStyle: ViewPropTypes.style,
    arrowSize: PropTypes.shape({
      width: PropTypes.number,
      height: PropTypes.number
    }),
    arrowShift: PropTypes.number,

    // lifecycle
    onOpenStart: PropTypes.func,
    onOpenComplete: PropTypes.func,
    onRequestClose: PropTypes.func,
    onCloseStart: PropTypes.func,
    onCloseComplete: PropTypes.func,
    onPositionChange: PropTypes.func,

    debug: PropTypes.bool
  }

  static defaultProps: Partial<PublicPopoverProps> = {
    mode: Mode.RN_MODAL,
    placement: Placement.AUTO,
    verticalOffset: 0,
    popoverStyle: {},
    arrowSize: DEFAULT_ARROW_SIZE,
    backgroundStyle: {},
    debug: false
  }

  state = {
    isVisible: false
  }

  private sourceRef: RefObject<View> = React.createRef();

  render(): ReactNode {
    const {
      mode,
      from,
      isVisible,
      onRequestClose,
      placement,
      arrowSize,
      displayArea,
      ...otherProps
    } = this.props;

    const actualIsVisible = isVisible === undefined
      ? this.state.isVisible
      : isVisible;

    let fromRect: Rect | undefined;
    let fromRef: RefObject<View> | undefined;
    let sourceElement: ReactElement | undefined;

    if (from) {
      if (typeof from === 'object' && ((from as Point).x || (from as Point).x === 0) && ((from as Point).y || (from as Point).y === 0)) {
        if (((from as Rect).width || (from as Rect).width === 0) && ((from as Rect).height || (from as Rect).height === 0)) {
          const fromAsRect = from as Rect;
          fromRect = new Rect(fromAsRect.x, fromAsRect.y, fromAsRect.width, fromAsRect.height);
        } else {
          fromRect = new Rect((from as Point).x, (from as Point).y, 0, 0);
        }
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
      arrowSize: arrowSize ? new Size(arrowSize?.width, arrowSize?.height) : undefined,
      displayArea: displayArea
        ? new Rect(displayArea.x, displayArea.y, displayArea.width, displayArea.height)
        : undefined,
      onRequestClose: () => {
        if (onRequestClose) onRequestClose();
        this.setState({ isVisible: false });
      },
      // Handle changing CENTER -> FLOATING until CENTER is removed
      placement: placement === Placement.CENTER ? Placement.FLOATING : placement
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
