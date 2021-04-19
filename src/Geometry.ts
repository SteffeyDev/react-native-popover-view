import { StyleProp, ViewStyle } from 'react-native';
import { Placement } from './Types';
import { Rect, Size, Point, getArrowSize, getBorderRadius } from './Utility';
import { POPOVER_MARGIN } from './Constants';

type ComputeGeometryBaseProps = {
  requestedContentSize: Size;
  displayArea: Rect;
  debug: (line: string, obj?: unknown) => void;
}

type ComputeGeometryProps = ComputeGeometryBaseProps & {
  placement?: Placement;
  previousPlacement?: Placement;
  fromRect: Rect | null;
  arrowStyle: StyleProp<ViewStyle>;
  popoverStyle: StyleProp<ViewStyle>;
  arrowShift?: number;
}

type ComputeGeometryDirectionProps = ComputeGeometryBaseProps & {
  fromRect: Rect;
  arrowStyle: StyleProp<ViewStyle>;
  borderRadius: number;
  debug: (line: string, obj?: unknown) => void;
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
  const { requestedContentSize, placement, displayArea, debug, popoverStyle, arrowShift } = options;

  let newGeom = null;

  // Make copy so doesn't modify original
  const fromRect = options.fromRect
    ? Rect.clone(options.fromRect)
    : null;
  if (fromRect && options.fromRect instanceof Rect) {

    // Check to see if fromRect is outside of displayArea, and adjust if it is
    if (fromRect.x > displayArea.x + displayArea.width)
      fromRect.x = displayArea.x + displayArea.width;
    if (fromRect.y > displayArea.y + displayArea.height)
      fromRect.y = displayArea.y + displayArea.height;
    if (fromRect.x + fromRect.width < 0) fromRect.x = -1 * fromRect.width;
    if (fromRect.y + fromRect.height < 0) fromRect.y = -1 * fromRect.height;

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

    debug('computeGeometry - initial chosen geometry', newGeom);

    /*
     * If the popover will be restricted and the view that the popover isshowing
     * from is sufficiently large, try to show the popover inside the view
     */
    if (
      newGeom &&
      (newGeom.viewLargerThanDisplayArea.width || newGeom.viewLargerThanDisplayArea.height)
    ) {
      const fromRectHeightVisible = fromRect.y < displayArea.y
        ? fromRect.height - (displayArea.y - fromRect.y)
        : displayArea.y + displayArea.height - fromRect.y;
      if (
        fromRect.width > requestedContentSize.width &&
        fromRectHeightVisible > requestedContentSize.height
      ) {
        const preferredX = Math.max(
          fromRect.x + 10, fromRect.x + ((fromRect.width - requestedContentSize.width) / 2)
        );
        const preferredY = Math.max(
          fromRect.y + 10, fromRect.y + ((fromRect.height - requestedContentSize.height) / 2)
        );

        let constrainedX = Math.max(preferredX, displayArea.x);
        if (constrainedX + requestedContentSize.width > displayArea.x + displayArea.width)
          constrainedX = displayArea.x + displayArea.width - requestedContentSize.width;

        let constrainedY = Math.max(preferredY, displayArea.y);
        if (constrainedY + requestedContentSize.height > displayArea.y + displayArea.height)
          constrainedY = displayArea.y + displayArea.height - requestedContentSize.height;

        const forcedContentSize = {
          width: Math.min(fromRect.width - 20, displayArea.width),
          height: Math.min(fromRect.height - 20, displayArea.height)
        };

        debug('computeGeometry - showing inside anchor');
        newGeom = new Geometry({
          popoverOrigin:
            new Point(constrainedX, constrainedY),
          anchorPoint:
            new Point(fromRect.x + (fromRect.width / 2), fromRect.y + (fromRect.height / 2)),
          placement: Placement.CENTER,
          forcedContentSize,
          viewLargerThanDisplayArea: {
            width: requestedContentSize.width > forcedContentSize.width,
            height: requestedContentSize.height > forcedContentSize.height
          }
        });
      } else if (
        /*
         * If we can't fit inside or outside the fromRect, show the popover centered on the screen,
         *  but only do this if they haven't asked for a specifc placement type
         *  and if it will actually help show more content
         */
        placement === Placement.AUTO &&
        (
          (
            newGeom.viewLargerThanDisplayArea.width &&
            [Placement.RIGHT, Placement.LEFT].includes(newGeom.placement)
          ) ||
          (
            newGeom.viewLargerThanDisplayArea.height &&
            [Placement.TOP, Placement.BOTTOM].includes(newGeom.placement)
          )
        )
      ) {
        newGeom = null;
      }
    }
  }

  if (!newGeom) {
    const minY = displayArea.y;
    const minX = displayArea.x;
    const preferedY = ((displayArea.height - requestedContentSize.height) / 2) + displayArea.y;
    const preferedX = ((displayArea.width - requestedContentSize.width) / 2) + displayArea.x;

    debug('computeGeometry - showing centered on screen');
    newGeom = new Geometry({
      popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
      anchorPoint: new Point(
        (displayArea.width / 2) + displayArea.x,
        (displayArea.height / 2) + displayArea.y
      ),
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

  if (arrowShift && fromRect) {
    if (newGeom.placement === Placement.BOTTOM || newGeom.placement === Placement.TOP)
      newGeom.anchorPoint.x += arrowShift * 0.5 * fromRect.width;
    else
      newGeom.anchorPoint.y += arrowShift * 0.5 * fromRect.height;
  }

  debug('computeGeometry - final chosen geometry', newGeom);
  return newGeom;
}

function computeTopGeometry({
  displayArea,
  fromRect,
  requestedContentSize,
  arrowStyle,
  borderRadius
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x + POPOVER_MARGIN,
    displayArea.y + POPOVER_MARGIN,
    displayArea.width - (POPOVER_MARGIN * 2),
    displayArea.height
  );

  const arrowSize = getArrowSize(Placement.TOP, arrowStyle);
  const minY = displayArea.y;
  const preferredY = fromRect.y - requestedContentSize.height - arrowSize.height;

  const forcedContentSize = {
    height: (fromRect.y - arrowSize.height - displayArea.y),
    width: displayArea.width
  };

  const viewLargerThanDisplayArea = {
    height: preferredY <= minY - 1,
    width: requestedContentSize.width >= displayArea.width + 1
  };

  const viewWidth = viewLargerThanDisplayArea.width
    ? forcedContentSize.width
    : requestedContentSize.width;

  const maxX = displayArea.x + displayArea.width - viewWidth;
  const minX = displayArea.x;
  const preferredX = fromRect.x + ((fromRect.width - viewWidth) / 2);

  const popoverOrigin = new Point(
    Math.min(maxX, Math.max(minX, preferredX)),
    Math.max(minY, preferredY)
  );

  const anchorPoint = new Point(fromRect.x + (fromRect.width / 2), fromRect.y);

  // Make sure the arrow isn't cut off
  anchorPoint.x = Math.max(anchorPoint.x, (arrowSize.width / 2) + borderRadius);
  anchorPoint.x = Math.min(
    anchorPoint.x,
    displayArea.x + displayArea.width - (arrowSize.width / 2) - borderRadius
  );

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.TOP,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeBottomGeometry({
  displayArea,
  fromRect,
  requestedContentSize,
  arrowStyle,
  borderRadius
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x + POPOVER_MARGIN,
    displayArea.y,
    displayArea.width - (POPOVER_MARGIN * 2),
    displayArea.height - POPOVER_MARGIN
  );

  const arrowSize = getArrowSize(Placement.BOTTOM, arrowStyle);
  const preferedY = fromRect.y + fromRect.height + arrowSize.height;

  const forcedContentSize = {
    height: displayArea.y + displayArea.height - preferedY,
    width: displayArea.width
  };

  const viewLargerThanDisplayArea = {
    height: preferedY + requestedContentSize.height >= displayArea.y + displayArea.height + 1,
    width: requestedContentSize.width >= displayArea.width + 1
  };

  const viewWidth = viewLargerThanDisplayArea.width
    ? forcedContentSize.width
    : requestedContentSize.width;

  const maxX = displayArea.x + displayArea.width - viewWidth;
  const minX = displayArea.x;
  const preferedX = fromRect.x + ((fromRect.width - viewWidth) / 2);

  const popoverOrigin = new Point(
    Math.min(maxX, Math.max(minX, preferedX)),
    preferedY
  );

  const anchorPoint = new Point(fromRect.x + (fromRect.width / 2), fromRect.y + fromRect.height);

  // Make sure the arrow isn't cut off
  anchorPoint.x = Math.max(anchorPoint.x, (arrowSize.width / 2) + borderRadius);
  anchorPoint.x = Math.min(
    anchorPoint.x,
    displayArea.x + displayArea.width - (arrowSize.width / 2) - borderRadius
  );

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.BOTTOM,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeLeftGeometry({
  displayArea,
  fromRect,
  requestedContentSize,
  borderRadius,
  arrowStyle
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x + POPOVER_MARGIN,
    displayArea.y + POPOVER_MARGIN,
    displayArea.width,
    displayArea.height - (POPOVER_MARGIN * 2)
  );

  const arrowSize = getArrowSize(Placement.LEFT, arrowStyle);

  const forcedContentSize = {
    height: displayArea.height,
    width: fromRect.x - displayArea.x - arrowSize.width
  };

  const viewLargerThanDisplayArea = {
    height: requestedContentSize.height >= displayArea.height + 1,
    width: requestedContentSize.width >= fromRect.x - displayArea.x - arrowSize.width + 1
  };

  const viewWidth = viewLargerThanDisplayArea.width
    ? forcedContentSize.width
    : requestedContentSize.width;
  const viewHeight = viewLargerThanDisplayArea.height
    ? forcedContentSize.height
    : requestedContentSize.height;

  const preferedX = fromRect.x - viewWidth - arrowSize.width;

  const preferedY = fromRect.y + ((fromRect.height - viewHeight) / 2);
  const minY = displayArea.y;
  const maxY = (displayArea.height - viewHeight) + displayArea.y;

  const popoverOrigin = new Point(
    preferedX,
    Math.min(Math.max(minY, preferedY), maxY)
  );

  const anchorPoint = new Point(fromRect.x, fromRect.y + (fromRect.height / 2));

  // Make sure the arrow isn't cut off
  anchorPoint.y = Math.max(anchorPoint.y, (arrowSize.height / 2) + borderRadius);
  anchorPoint.y = Math.min(
    anchorPoint.y,
    displayArea.y + displayArea.height - (arrowSize.height / 2) - borderRadius
  );

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.LEFT,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeRightGeometry({
  displayArea,
  fromRect,
  requestedContentSize,
  arrowStyle,
  borderRadius
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x,
    displayArea.y + POPOVER_MARGIN,
    displayArea.width - POPOVER_MARGIN,
    displayArea.height - (POPOVER_MARGIN * 2)
  );

  const arrowSize = getArrowSize(Placement.RIGHT, arrowStyle);
  const horizontalSpace =
    displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width;

  const forcedContentSize = {
    height: displayArea.height,
    width: horizontalSpace
  };

  const viewLargerThanDisplayArea = {
    height: requestedContentSize.height >= displayArea.height + 1,
    width: requestedContentSize.width >= horizontalSpace + 1
  };

  const viewHeight = viewLargerThanDisplayArea.height
    ? forcedContentSize.height
    : requestedContentSize.height;

  const preferedX = fromRect.x + fromRect.width + arrowSize.width;

  const preferedY = fromRect.y + ((fromRect.height - viewHeight) / 2);
  const minY = displayArea.y + POPOVER_MARGIN;
  const maxY = (displayArea.height - viewHeight) + displayArea.y - POPOVER_MARGIN;

  const popoverOrigin = new Point(
    preferedX,
    Math.min(Math.max(minY, preferedY), maxY)
  );

  const anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + (fromRect.height / 2.0));

  // Make sure the arrow isn't cut off
  anchorPoint.y = Math.max(anchorPoint.y, (arrowSize.height / 2) + borderRadius);
  anchorPoint.y = Math.min(
    anchorPoint.y,
    displayArea.y + displayArea.height - (arrowSize.height / 2) - borderRadius
  );

  return new Geometry({
    popoverOrigin,
    anchorPoint,
    placement: Placement.RIGHT,
    forcedContentSize,
    viewLargerThanDisplayArea
  });
}

function computeAutoGeometry(options: ComputeGeometryAutoProps): Geometry | null {
  const {
    displayArea,
    requestedContentSize,
    fromRect,
    previousPlacement,
    debug,
    arrowStyle
  } = options;

  // Keep same placement if possible (left/right)
  if (previousPlacement === Placement.LEFT || previousPlacement === Placement.RIGHT) {
    const geom = previousPlacement === Placement.LEFT
      ? computeLeftGeometry(options)
      : computeRightGeometry(options);
    debug('computeAutoGeometry - Left/right tryping to keep same, geometry', geom);
    if (!geom.viewLargerThanDisplayArea.width) return geom;
  }

  // Keep same placement if possible (top/bottom)
  if (previousPlacement === Placement.TOP || previousPlacement === Placement.BOTTOM) {
    const geom = previousPlacement === Placement.TOP
      ? computeTopGeometry(options)
      : computeBottomGeometry(options);
    debug('computeAutoGeometry - Top/bottom tryping to keep same, geometry', geom);
    if (!geom.viewLargerThanDisplayArea.height) return geom;
  }

  /*
   * Otherwise, find the place that can fit it best (try left/right but
   * default to top/bottom as that will typically have more space)
   */
  const arrowSize = getArrowSize(Placement.LEFT, arrowStyle);

  // generating list of all possible sides with validity
  debug('computeAutoGeometry - displayArea', displayArea);
  debug('computeAutoGeometry - fromRect', fromRect);
  const spaceList: SpaceList = {
    [Placement.LEFT]: {
      sizeAvailable: fromRect.x - displayArea.x - arrowSize.width,
      sizeRequested: requestedContentSize.width
    },
    [Placement.RIGHT]: {
      sizeAvailable:
        displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width,
      sizeRequested: requestedContentSize.width
    },
    [Placement.TOP]: {
      sizeAvailable: fromRect.y - displayArea.y - arrowSize.width,
      sizeRequested: requestedContentSize.height
    },
    [Placement.BOTTOM]: {
      sizeAvailable:
        displayArea.y + displayArea.height - (fromRect.y + fromRect.height) - arrowSize.width,
      sizeRequested: requestedContentSize.height
    }
  };

  debug('computeAutoGeometry - List of availabe space', spaceList);

  const bestPlacementPosition = findBestPlacement(spaceList);

  debug('computeAutoGeometry - Found best postition for placement', bestPlacementPosition);

  switch (bestPlacementPosition) {
    case Placement.LEFT: return computeLeftGeometry(options);
    case Placement.RIGHT: return computeRightGeometry(options);
    case Placement.BOTTOM: return computeBottomGeometry(options);
    case Placement.TOP: return computeTopGeometry(options);
    // Return nothing so popover will be placed in middle of screen
    default: return null;
  }
}

type SpaceList = Record<
  Placement.LEFT | Placement.RIGHT | Placement.TOP | Placement.BOTTOM,
  PlacementOption
>
type PlacementOption = {
  sizeRequested: number;
  sizeAvailable: number;
}
function findBestPlacement(spaceList: SpaceList): Placement | null {
  return Object.keys(spaceList).reduce(
    (bestPlacement, placement) => (
      // If it can fit, and is the first one or fits better than the last one, use this placement
      spaceList[placement].sizeRequested <= spaceList[placement].sizeAvailable &&
        (
          !bestPlacement ||
          spaceList[placement].sizeAvailable > spaceList[bestPlacement].sizeAvailable
        )
        ? placement as Placement
        : bestPlacement
    ),
    null as Placement | null
  );
}
