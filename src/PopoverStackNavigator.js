import React from 'react'
import { StackNavigator } from 'react-navigation'
import { popoverTransitionConfig } from './Utility'
import PopoverNavigation, { shouldShowInPopover } from './PopoverNavigation'

export let withPopoverNavigation = (Comp, popoverOptions) => props => <PopoverNavigation {...popoverOptions}><Comp {...props} /></PopoverNavigation>;

export default function PopoverStackNavigator(RouteConfigs, StackNavigatorConfig) {
  let routeKeys = Object.keys(RouteConfigs);
  let firstRouteKey = routeKeys.splice(0, 1)[0];
  let newRouteConfigs = {};
  newRouteConfigs[firstRouteKey] = RouteConfigs[firstRouteKey];
  routeKeys.forEach(route => newRouteConfigs[route] = Object.assign({}, RouteConfigs[route], { screen: withPopoverNavigation(RouteConfigs[route].screen, Object.assign({}, RouteConfigs[route].popoverOptions, {viewName: route})) }));

  let nonPopoverStack = StackNavigator(newRouteConfigs, StackNavigatorConfig);
  const popoverStackConfig = Object.assign({}, StackNavigatorConfig, {transitionConfig: popoverTransitionConfig, headerMode: 'screen', cardStyle: {backgroundColor: 'transparent'}});
  let popoverStack = StackNavigator(newRouteConfigs, popoverStackConfig);

  return props => {
    let { navigatorRef, ...other } = props;
    let Stack = nonPopoverStack;
    if (shouldShowInPopover()) Stack = popoverStack;
    return <Stack ref={props.navigatorRef} {...other} />;
  }
}
