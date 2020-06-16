import { StyleProp, ViewStyle } from 'react-native';
import { Placement } from './Constants';
import { Rect, Size, Point, getArrowSize, getBorderRadius } from './Utility';

type ComputeGeometryBaseProps = {
  requestedContentSize: Size;
  displayArea: Rect;
  debug: (line: string, obj?: any) => void;
}

type ComputeGeometryProps = ComputeGeometryBaseProps & {
  placement?: Placement;
  previousPlacement?: Placement;
  fromRect: Rect | null;
  arrowStyle: StyleProp<ViewStyle>;
  popoverStyle: StyleProp<ViewStyle>;
}

type ComputeGeometryDirectionProps = ComputeGeometryBaseProps & {
  fromRect: Rect;
  arrowStyle: StyleProp<ViewStyle>;
  borderRadius: number;
  debug: (line: string, obj?: any) => void;
}

type ComputeGeometryAutoProps = ComputeGeometryDirectionProps & {
  previousPlacement?: Placement;
};

export class Geometry {
  popoverOrigin: Point;
  anchorPoint: Point;
  placement: Placement;
  forcedContentSize: Size | null;
  viewLargerThanDisplayArea: {
    width: boolean,
    height: boolean
  }
  constructor(
    { popoverOrigin, anchorPoint, placement, forcedContentSize, viewLargerThanDisplayArea }:
    {
      popoverOrigin: Point;
      anchorPoint: Point;
      placement: Placement;
      forcedContentSize: Size | null;
      viewLargerThanDisplayArea: {
        width: boolean,
        height: boolean
      }
    }
  ) {
    this.popoverOrigin = popoverOrigin;
    this.anchorPoint = anchorPoint;
    this.placement = placement;
    this.forcedContentSize = forcedContentSize;
    this.viewLargerThanDisplayArea = viewLargerThanDisplayArea;
  }
  static equals(a: Geometry, b: Geometry): boolean {
    return Point.equals(a.popoverOrigin, b.popoverOrigin) &&
      Point.equals(a.anchorPoint, b.anchorPoint) &&
      a.placement === b.placement &&
      a.forcedContentSize?.width === b.forcedContentSize?.width &&
      a.forcedContentSize?.height === b.forcedContentSize?.height &&
      a.viewLargerThanDisplayArea?.width === b.viewLargerThanDisplayArea?.width &&
      a.viewLargerThanDisplayArea?.height === b.viewLargerThanDisplayArea?.height;
  }
}

export function computeGeometry(options: ComputeGeometryProps): Geometry {
  const { requestedContentSize, placement, displayArea, debug, popoverStyle } = options;

  let newGeom = null;

  if (options.fromRect && options.fromRect instanceof Rect) {
    const fromRect = Rect.clone(options.fromRect); // Make copy so doesn't modify original

    // Check to see if fromRect is outside of displayArea, and adjust if it is
    if (fromRect.x > displayArea.x + displayArea.width) fromRect.x = displayArea.x + displayArea.width;
    if (fromRect.y > displayArea.y + displayArea.height) fromRect.y = displayArea.y + displayArea.height;
    if (fromRect.x < 0) fromRect.x = -1 * fromRect.width;
    if (fromRect.y < 0) fromRect.y = -1 * fromRect.height;

    const borderRadius = getBorderRadius(popoverStyle);

    switch (placement) {
      case Placement.TOP:
        newGeom = computeTopGeometry({ ...options, fromRect, borderRadius });
        break;
      case Placement.BOTTOM:
        newGeom = computeBottomGeometry({ ...options, fromRect, borderRadius });
        break;
      case Placement.LEFT:
        newGeom = computeLeftGeometry({ ...options, fromRect, borderRadius });
        break;
      case Placement.RIGHT:
        newGeom = computeRightGeometry({ ...options, fromRect, borderRadius });
        break;
      case Placement.CENTER:
        newGeom = null;
        break;
      default:
        newGeom = computeAutoGeometry({ ...options, fromRect, borderRadius });
    }

    debug("computeGeometry - initial chosen geometry", newGeom);

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

        debug("computeGeometry - showing inside anchor");
        newGeom = new Geometry({
          popoverOrigin: new Point(constrainedX, constrainedY),
          anchorPoint: new Point(fromRect.x + (fromRect.width/2), fromRect.y + (fromRect.height/2)),
          placement: Placement.CENTER,
          forcedContentSize,
          viewLargerThanDisplayArea: {
            width: requestedContentSize.width > forcedContentSize.width,
            height: requestedContentSize.height > forcedContentSize.height
          }
        });
      }
      else if (
        // If we can't fit inside or outside the fromRect, show the popover centered on the screen,
        //  but only do this if they haven't asked for a specifc placement type
        //  and if it will actually help show more content
        placement === Placement.AUTO &&
        (
          (newGeom.viewLargerThanDisplayArea.width && [Placement.RIGHT, Placement.LEFT].includes(newGeom.placement)) ||
          (newGeom.viewLargerThanDisplayArea.height && [Placement.TOP, Placement.BOTTOM].includes(newGeom.placement))
        )
      ) {
        newGeom = null;
      }
    }
  }

  
  if (!newGeom) {
    const minY = displayArea.y;
    const minX = displayArea.x;
    const preferedY = (displayArea.height - requestedContentSize.height)/2 + displayArea.y;
    const preferedX = (displayArea.width - requestedContentSize.width)/2 + displayArea.x;

    debug("computeGeometry - showing centered on screen");
    newGeom = new Geometry({
      popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
      anchorPoint: new Point(displayArea.width/2 + displayArea.x, displayArea.height/2 + displayArea.y),
      placement: Placement.CENTER,
      forcedContentSize: {
        width: displayArea.width,
        height: displayArea.height
      },
      viewLargerThanDisplayArea: {
        width: preferedX < minX - 1,
        height: preferedY < minY - 1
      }
    });
  }

  debug("computeGeometry - final chosen geometry", newGeom);
  return newGeom;
}

function computeTopGeometry({ displayArea, fromRect, requestedContentSize, arrowStyle, borderRadius }: ComputeGeometryDirectionProps): Geometry {
  const arrowSize = getArrowSize(Placement.TOP, arrowStyle);
  let minY = displayArea.y;
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
  anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + borderRadius);
  anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - borderRadius);

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.TOP,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeBottomGeometry({ displayArea, fromRect, requestedContentSize, arrowStyle, borderRadius }: ComputeGeometryDirectionProps): Geometry {
  const arrowSize = getArrowSize(Placement.BOTTOM, arrowStyle);
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
  anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + borderRadius);
  anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - borderRadius);

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.BOTTOM,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeLeftGeometry({ displayArea, fromRect, requestedContentSize, borderRadius, arrowStyle }: ComputeGeometryDirectionProps): Geometry {
  const arrowSize = getArrowSize(Placement.LEFT, arrowStyle);

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
  anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + borderRadius);
  anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - borderRadius);

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.LEFT,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeRightGeometry({ displayArea, fromRect, requestedContentSize, arrowStyle, borderRadius }: ComputeGeometryDirectionProps): Geometry {
  const arrowSize = getArrowSize(Placement.RIGHT, arrowStyle);
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
  anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + borderRadius);
  anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - borderRadius);

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.RIGHT,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeAutoGeometry(options: ComputeGeometryAutoProps): Geometry {
  const { displayArea, requestedContentSize, fromRect, previousPlacement, debug, arrowStyle } = options

  // Keep same placement if possible (left/right)
  if (previousPlacement === Placement.LEFT || previousPlacement === Placement.RIGHT) {
    const geom = previousPlacement === Placement.LEFT
      ? computeLeftGeometry(options)
      : computeRightGeometry(options)
    debug("computeAutoGeometry - Left/right tryping to keep same, geometry", geom);
    if (!geom.viewLargerThanDisplayArea.width) return geom;
  }

  // Keep same placement if possible (top/bottom)
  if (previousPlacement === Placement.TOP || previousPlacement === Placement.BOTTOM) {
    const geom = previousPlacement === Placement.TOP
      ? computeTopGeometry(options)
      : computeBottomGeometry(options)
    debug("computeAutoGeometry - Top/bottom tryping to keep same, geometry", geom);
    if (!geom.viewLargerThanDisplayArea.height) return geom;
  }

  // Otherwise, find the place that can fit it best (try left/right but default to top/bottom as that will typically have more space
  const arrowSize = getArrowSize(Placement.LEFT, arrowStyle);

  // If it fits on left, choose left
  if (fromRect.x - displayArea.x - arrowSize.width >= requestedContentSize.width) { // We could fit it on the left side
    debug("computeAutoGeometry - could fit on left side");
    return computeLeftGeometry(options);
  }

  // If it fits on right, choose right
  if (displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width >= requestedContentSize.width) { // We could fit it on the right side
    debug("computeAutoGeometry - could fit on right side");
    return computeRightGeometry(options);
  }

  // We could fit it on the top or bottom, need to figure out which is better
  let topSpace = fromRect.y - displayArea.y;
  let bottomSpace = displayArea.y + displayArea.height - (fromRect.y + fromRect.height);
  debug("computeAutoGeometry - Top/bottom picking best, top space", topSpace);
  return (topSpace - 50) > bottomSpace ? computeTopGeometry(options) : computeBottomGeometry(options);
}
