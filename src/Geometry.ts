import { StyleProp, ViewStyle } from 'react-native';
import { Rect, Size, Point, Placement, PopoverProps } from './Types';
import { getBorderRadius } from './Utility';
import { POPOVER_MARGIN } from './Constants';

type ComputeGeometryBaseProps = {
  requestedContentSize: Size;
  displayArea: Rect;
  debug: (line: string, obj?: unknown) => void;
  offset?: number;
}

type ComputeGeometryProps = ComputeGeometryBaseProps & {
  placement?: Placement | Array<Placement>;
  previousPlacement?: Placement;
  fromRect: Rect | null;
  arrowSize: Size;
  popoverStyle: StyleProp<ViewStyle>;
  arrowShift?: number;
  popoverShift?: PopoverProps['popoverShift'];
}

type ComputeGeometryDirectionProps = ComputeGeometryBaseProps & {
  fromRect: Rect;
  arrowSize: Size;
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
  forcedContentSize: Size;
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
      forcedContentSize: Size;
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
    return a.popoverOrigin.equals(b.popoverOrigin) &&
      a.anchorPoint.equals(b.anchorPoint) &&
      a.placement === b.placement &&
      a.forcedContentSize.equals(b.forcedContentSize) &&
      a.viewLargerThanDisplayArea?.width === b.viewLargerThanDisplayArea?.width &&
      a.viewLargerThanDisplayArea?.height === b.viewLargerThanDisplayArea?.height;
  }
}

export function computeGeometry(options: ComputeGeometryProps): Geometry {
  const {
    requestedContentSize,
    placement,
    displayArea,
    debug,
    popoverStyle,
    arrowShift,
    popoverShift,
    arrowSize
  } = options;

  let newGeom = null;

  // Make copy so doesn't modify original
  const fromRect = options.fromRect
    ? Rect.clone(options.fromRect)
    : null;
  if (fromRect && options.fromRect instanceof Rect) {

    const borderRadius = getBorderRadius(popoverStyle);

    // Default to first option if given list of placements
    let selectedPlacement = Array.isArray(placement) ? placement[0] : placement;

    // If we can find a placement in the list that is better, use that
    if (Array.isArray(placement)) {
      const spaceList =
        generateSpaceList({ fromRect, displayArea, requestedContentSize, arrowSize });
      const bestPlacements = calculateBestPlacements(spaceList);
      const [bestProvidedPlacement] = placement.
        filter(p => p === Placement.AUTO || p === Placement.FLOATING || bestPlacements.includes(p));
      if (bestProvidedPlacement) selectedPlacement = bestProvidedPlacement;
    }

    switch (selectedPlacement) {
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
      case Placement.FLOATING:
        newGeom = null;
        break;
      default:
        newGeom = computeAutoGeometry({ ...options, fromRect, borderRadius });
    }

    debug('computeGeometry - initial chosen geometry', newGeom);

    /*
     * If the popover will be restricted and the view that the popover is showing
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

        const forcedContentSize = new Size(
          Math.min(fromRect.width - 20, displayArea.width),
          Math.min(fromRect.height - 20, displayArea.height)
        );

        debug('computeGeometry - showing inside anchor');
        newGeom = new Geometry({
          popoverOrigin:
            new Point(constrainedX, constrainedY),
          anchorPoint:
            new Point(fromRect.x + (fromRect.width / 2), fromRect.y + (fromRect.height / 2)),
          placement: Placement.FLOATING,
          forcedContentSize,
          viewLargerThanDisplayArea: {
            width: requestedContentSize.width > forcedContentSize.width,
            height: requestedContentSize.height > forcedContentSize.height
          }
        });
      } else if (
        /*
         * If we can't fit inside or outside the fromRect, show the popover floating on the screen,
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

    debug('computeGeometry - showing floating');
    newGeom = new Geometry({
      popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
      anchorPoint: new Point(
        (displayArea.width / 2) + displayArea.x,
        (displayArea.height / 2) + displayArea.y
      ),
      placement: Placement.FLOATING,
      forcedContentSize: new Size(displayArea.width, displayArea.height),
      viewLargerThanDisplayArea: {
        width: preferedX < minX - 1,
        height: preferedY < minY - 1
      }
    });

    // Apply popover shift
    if (!newGeom.viewLargerThanDisplayArea.width && popoverShift?.x) {
      debug('computeGeometry - applying popoverShift.x', popoverShift.x);
      const horizontalMargin = (displayArea.width - requestedContentSize.width) / 2;
      newGeom.popoverOrigin.x += popoverShift.x * horizontalMargin;
      newGeom.anchorPoint.x = newGeom.popoverOrigin.x + (requestedContentSize.width / 2);
    }
    if (!newGeom.viewLargerThanDisplayArea.height && popoverShift?.y) {
      debug('computeGeometry - applying popoverShift.y', popoverShift.y);
      const verticalMargin = (displayArea.height - requestedContentSize.height) / 2;
      newGeom.popoverOrigin.y += popoverShift.y * verticalMargin;
      newGeom.anchorPoint.y = newGeom.popoverOrigin.y + (requestedContentSize.height / 2);
    }
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
  arrowSize,
  borderRadius,
  offset
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x + POPOVER_MARGIN,
    displayArea.y + POPOVER_MARGIN,
    displayArea.width - (POPOVER_MARGIN * 2),
    displayArea.height
  );

  if (offset) fromRect.y -= offset;

  const minY = displayArea.y;
  const maxY = displayArea.y + displayArea.height;
  const preferredY = fromRect.y - requestedContentSize.height - arrowSize.height;

  const forcedContentSize = new Size(
    displayArea.width,
    (fromRect.y - arrowSize.height - displayArea.y)
  );

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
    Math.min(maxY, Math.max(minY, preferredY))
  );

  const anchorPoint = new Point(fromRect.x + (fromRect.width / 2), fromRect.y);

  // Make sure the arrow isn't cut off
  anchorPoint.x = Math.max(anchorPoint.x, popoverOrigin.x + (arrowSize.width / 2) + borderRadius);
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
  arrowSize,
  borderRadius,
  offset
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x + POPOVER_MARGIN,
    displayArea.y,
    displayArea.width - (POPOVER_MARGIN * 2),
    displayArea.height - POPOVER_MARGIN
  );

  if (offset) fromRect.y += offset;

  const minY = displayArea.y;
  const maxY = displayArea.y + displayArea.height;
  const preferedY = fromRect.y + fromRect.height;

  const forcedContentSize = new Size(
    displayArea.width,
    displayArea.y + displayArea.height - preferedY
  );

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
    Math.min(maxY, Math.max(minY, preferedY))
  );

  const anchorPoint = new Point(fromRect.x + (fromRect.width / 2), fromRect.y + fromRect.height);

  // Make sure the arrow isn't cut off
  anchorPoint.x = Math.max(anchorPoint.x, popoverOrigin.x + (arrowSize.width / 2) + borderRadius);
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
  arrowSize,
  offset
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x + POPOVER_MARGIN,
    displayArea.y + POPOVER_MARGIN,
    displayArea.width,
    displayArea.height - (POPOVER_MARGIN * 2)
  );

  if (offset) fromRect.x -= offset;

  const forcedContentSize = new Size(
    fromRect.x - displayArea.x - arrowSize.width,
    displayArea.height
  );

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

  const preferedX = fromRect.x - viewWidth - arrowSize.height;
  const minX = displayArea.x;
  const maxX = displayArea.x + displayArea.width;

  const preferedY = fromRect.y + ((fromRect.height - viewHeight) / 2);
  const minY = displayArea.y;
  const maxY = (displayArea.height - viewHeight) + displayArea.y;

  const popoverOrigin = new Point(
    Math.min(Math.max(minX, preferedX), maxX),
    Math.min(Math.max(minY, preferedY), maxY)
  );

  const anchorPoint = new Point(fromRect.x, fromRect.y + (fromRect.height / 2));

  // Make sure the arrow isn't cut off
  anchorPoint.y = Math.max(anchorPoint.y, popoverOrigin.y + (arrowSize.height / 2) + borderRadius);
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
  arrowSize,
  borderRadius,
  offset
}: ComputeGeometryDirectionProps): Geometry {
  // Apply a margin on non-arrow sides
  displayArea = new Rect(
    displayArea.x,
    displayArea.y + POPOVER_MARGIN,
    displayArea.width - POPOVER_MARGIN,
    displayArea.height - (POPOVER_MARGIN * 2)
  );

  if (offset) fromRect.x += offset;

  const horizontalSpace =
    displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width;

  const forcedContentSize = new Size(
    horizontalSpace,
    displayArea.height
  );

  const viewLargerThanDisplayArea = {
    height: requestedContentSize.height >= displayArea.height + 1,
    width: requestedContentSize.width >= horizontalSpace + 1
  };

  const viewHeight = viewLargerThanDisplayArea.height
    ? forcedContentSize.height
    : requestedContentSize.height;

  const preferedX = fromRect.x + fromRect.width;
  const minX = displayArea.x;
  const maxX = displayArea.x + displayArea.width;

  const preferedY = fromRect.y + ((fromRect.height - viewHeight) / 2);
  const minY = displayArea.y;
  const maxY = (displayArea.height - viewHeight) + displayArea.y;

  const popoverOrigin = new Point(
    Math.min(Math.max(minX, preferedX), maxX),
    Math.min(Math.max(minY, preferedY), maxY)
  );

  const anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + (fromRect.height / 2.0));

  // Make sure the arrow isn't cut off
  anchorPoint.y = Math.max(anchorPoint.y, popoverOrigin.y + (arrowSize.height / 2) + borderRadius);
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

type PlacementOption = {
  sizeRequested: number;
  sizeAvailable: number;
  fits: boolean;
  extraSpace: number;
}
type SpaceList = Partial<Record<Placement, PlacementOption>>
type SpaceListProps = Pick<ComputeGeometryDirectionProps, 'fromRect' | 'displayArea' | 'arrowSize' | 'requestedContentSize'>;
function generateSpaceList({
  fromRect,
  displayArea,
  arrowSize,
  requestedContentSize
}: SpaceListProps): SpaceList {
  function generateOption(props: Pick<PlacementOption, 'sizeRequested' | 'sizeAvailable'>): PlacementOption {
    return {
      ...props,
      fits: props.sizeAvailable >= props.sizeRequested,
      extraSpace: props.sizeAvailable - props.sizeRequested
    };
  }
  return {
    [Placement.LEFT]: generateOption({
      sizeAvailable: fromRect.x - displayArea.x - arrowSize.width,
      sizeRequested: requestedContentSize.width
    }),
    [Placement.RIGHT]: generateOption({
      sizeAvailable:
        displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width,
      sizeRequested: requestedContentSize.width
    }),
    [Placement.TOP]: generateOption({
      sizeAvailable: fromRect.y - displayArea.y - arrowSize.width,
      sizeRequested: requestedContentSize.height
    }),
    [Placement.BOTTOM]: generateOption({
      sizeAvailable:
        displayArea.y + displayArea.height - (fromRect.y + fromRect.height) - arrowSize.width,
      sizeRequested: requestedContentSize.height
    })
  };
}

function computeAutoGeometry(options: ComputeGeometryAutoProps): Geometry | null {
  const {
    displayArea,
    requestedContentSize,
    fromRect,
    previousPlacement,
    debug,
    arrowSize
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

  // generating list of all possible sides with validity
  debug('computeAutoGeometry - displayArea', displayArea);
  debug('computeAutoGeometry - fromRect', fromRect);

  const spaceList = generateSpaceList({ fromRect, displayArea, arrowSize, requestedContentSize });
  debug('computeAutoGeometry - List of available space', spaceList);

  const [bestPlacementPosition] = calculateBestPlacements(spaceList);
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

function calculateBestPlacements(spaceList: SpaceList): Placement[] {
  return (Object.keys(spaceList) as Placement[]).filter(
    o => spaceList[o]?.fits
  ).sort((a, b) => (spaceList[b]?.extraSpace ?? 0) - (spaceList[a]?.extraSpace ?? 0));
}
