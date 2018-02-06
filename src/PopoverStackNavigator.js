/* @flow */

import * as React from 'react';
import createNavigationContainer from '../../react-navigation/src/createNavigationContainer';
import createNavigator from '../../react-navigation/src/navigators/createNavigator';
import CardStackTransitioner from '.../../react-navigation/src/views/CardStack/CardStackTransitioner';
import StackRouter from '../../react-navigation/src/routers/StackRouter';
import NavigatorTypes from '../../react-navigation/src/navigators/NavigatorTypes';
import { popoverTransitionConfig, isTablet } from './Utility'
import PopoverNavigation from './PopoverNavigation'

import type {
  NavigationRouteConfigMap,
  stackConfig,
  NavigationState,
  NavigationStackScreenOptions,
  NavigationNavigatorProps,
} from '../../react-navigation/src/TypeDefinition';

// A stack navigators props are the intersection between
// the base navigator props (navgiation, screenProps, etc)
// and the view's props
type StackNavigatorProps = NavigationNavigatorProps<
  NavigationStackScreenOptions,
  NavigationState
> &
  React.ElementProps<typeof CardStackTransitioner>;

type PopoverStackNavigatorProps = StackNavigatorProps & {
  showInPopover: boolean,
}

export let withPopoverNavigation = (Comp, popoverOptions) => props => <PopoverNavigation {...popoverOptions}><Comp {...props} /></PopoverNavigation>;

const PopoverStackNavigator = (
  routeConfigMap: NavigationRouteConfigMap,
  stackConfig: stackConfig = {}
) => {
  const {
    initialRouteName,
    initialRouteParams,
    paths,
    headerMode,
    mode,
    cardStyle,
    transitionConfig,
    onTransitionStart,
    onTransitionEnd,
    navigationOptions,
  } = stackConfig;

  const stackRouterConfig = {
    initialRouteName,
    initialRouteParams,
    paths,
    navigationOptions,
  };

  let routeKeys = Object.keys(routeConfigMap);
  let newRouteConfigMap = {};
  let displayArea = {
    width: 0,
    height: 0
  };
  let shouldShowInPopover = isTablet();
  routeKeys.forEach((route, i) => {
    let getRegisteredView = () => PopoverStackNavigator.registeredViews.hasOwnProperty(route) ? PopoverStackNavigator.registeredViews[route] : null;
    newRouteConfigMap[route] = Object.assign({}, 
      routeConfigMap[route], 
      { 
        screen: withPopoverNavigation(routeConfigMap[route].screen, Object.assign({}, 
          stackConfig.popoverOptions,
          routeConfigMap[route].popoverOptions, 
          {
            showInPopover: i > 0 ? () => shouldShowInPopover : () => false,
            getRegisteredView, 
            backgroundColor: stackConfig.cardStyle ? stackConfig.cardStyle.backgroundColor : (i > 0 ? 'white' : '#E9E9EF')
          }
        )),
        navigationOptions: (ops) => {
          const userNavigationOptions = routeConfigMap[route].navigationOptions;
          let additionalNavigationOptions = null;
          if (userNavigationOptions) {
            if (typeof userNavigationOptions === "function")
              additionalNavigationOptions = userNavigationOptions(ops);
            else if (typeof userNavigationOptions === "object")
              additionalNavigationOptions = userNavigationOptions;
          }
          return i > 0 && shouldShowInPopover 
            ? Object.assign({}, additionalNavigationOptions, {header: null})
            : additionalNavigationOptions;
        }
      }
    );
  });

  const router = StackRouter(newRouteConfigMap, stackRouterConfig);

  // Create a navigator with CardStackTransitioner as the view
  const navigator = createNavigator(
    router,
    routeConfigMap,
    stackConfig,
    NavigatorTypes.STACK
  )((props: PopoverStackNavigatorProps) => {
    const { showInPopover, screenProps, ...otherProps } = props;
    shouldShowInPopover = showInPopover !== undefined ? showInPopover : isTablet();

    return (
      <CardStackTransitioner
        {...otherProps}
        screenProps={{shouldShowInPopover, ...screenProps}}
        headerMode={shouldShowInPopover ? 'screen' : headerMode}
        mode={mode}
        cardStyle={shouldShowInPopover ? {...cardStyle, backgroundColor: 'transparent'} : cardStyle}
        transitionConfig={shouldShowInPopover ? popoverTransitionConfig : transitionConfig}
        onTransitionStart={onTransitionStart}
        onTransitionEnd={onTransitionEnd}
      />
    )
  });

  return createNavigationContainer(navigator);
};

PopoverStackNavigator.registeredViews = {};
PopoverStackNavigator.registerRefForView = (ref, view) => {
  PopoverStackNavigator.registeredViews[view] = ref;
}

export default PopoverStackNavigator;
