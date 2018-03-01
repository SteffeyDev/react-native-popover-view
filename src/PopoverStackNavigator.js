/* @flow */

import * as React from 'react';
import createNavigationContainer from '../../react-navigation/src/createNavigationContainer';
import createNavigator from '../../react-navigation/src/navigators/createNavigator';
import CardStackTransitioner from '.../../react-navigation/src/views/CardStack/CardStackTransitioner';
import StackRouter from '../../react-navigation/src/routers/StackRouter';
import NavigationActions from '../../react-navigation/src/NavigationActions';
import { popoverTransitionConfig, isTablet } from './Utility'
import PopoverNavigation from './PopoverNavigation'

export let withPopoverNavigation = (Comp, popoverOptions) => props => <PopoverNavigation {...popoverOptions}><Comp {...props} /></PopoverNavigation>;

const PopoverStackNavigator = (routeConfigMap, stackConfig = {}) => {
  const {
    initialRouteName,
    initialRouteParams,
    paths,
    headerMode,
    headerTransitionPreset,
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
    stackConfig
  )(props => {
    const { showInPopover, screenProps, ...otherProps } = props;
    shouldShowInPopover = showInPopover !== undefined ? showInPopover : isTablet();

    return (
      <CardStackTransitioner
        {...otherProps}
        screenProps={{shouldShowInPopover, ...screenProps}}
        headerMode={shouldShowInPopover ? 'screen' : headerMode}
        headerTransitionPreset={headerTransitionPreset}
        mode={mode}
        cardStyle={shouldShowInPopover ? {...cardStyle, backgroundColor: 'transparent'} : cardStyle}
        transitionConfig={shouldShowInPopover ? popoverTransitionConfig : transitionConfig}
        onTransitionStart={onTransitionStart}
        onTransitionEnd={(lastTransition, transition) => {
          const { state, dispatch } = props.navigation;
          dispatch(NavigationActions.completeTransition({ key: state.key }));
          onTransitionEnd && onTransitionEnd();
        }}
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
