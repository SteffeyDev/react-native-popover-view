import React, { ForwardedRef, ReactElement } from 'react';
import { View, ViewStyle } from 'react-native';
import { Placement, Size } from './Types';

export type ArrowProps = {
    placement: Placement,
    color: ViewStyle['backgroundColor'],
    arrowSize: Size,
    positionStyle: Pick<ViewStyle, 'top' | 'bottom' | 'left' | 'right'>
};
const Arrow = React.forwardRef((props: ArrowProps, ref: ForwardedRef<View>): ReactElement => {
  const { placement, color, arrowSize, positionStyle } = props;

  // Make width and height slightly bigger so that it overlaps popover to eliminate seem
  const width = arrowSize.width + 2;
  const height = arrowSize.height + 2;

  // Flip width and height when showing on side to account for inner transform
  const placeLeftOrRight = [Placement.LEFT, Placement.RIGHT].includes(placement);
  const arrowOuterStyle: ViewStyle = {
    position: 'absolute',
    width: placeLeftOrRight ? height : width,
    height: placeLeftOrRight ? width : height,
    overflow: 'hidden',
    ...positionStyle
  };

  // Create a triangle using borders
  const arrowInnerStyle: ViewStyle = {
    position: 'absolute',
    [placement]: 0,
    borderBottomColor: color,
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
    width,
    height: height * 2,
    borderBottomWidth: height,
    borderRightWidth: width / 2,
    borderLeftWidth: width / 2
  };

  // Rotate to show the triangle in different directions
  switch (placement) {
    case Placement.TOP: arrowInnerStyle.transform = [{ rotateZ: '180deg' }]; break;
    case Placement.LEFT: arrowInnerStyle.transform = [{ rotateZ: '90deg' }]; break;
    case Placement.RIGHT: arrowInnerStyle.transform = [{ rotateZ: '270deg' }]; break;
    default:
  }

  return (
    <View style={arrowOuterStyle} ref={ref}>
      <View style={arrowInnerStyle} />
    </View>
  );
});

export default Arrow;
