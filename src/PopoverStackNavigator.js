import React from 'react'
import { View } from 'react-native'
import { StackNavigator } from '../../react-navigation'
import { popoverTransitionConfig, isTablet } from './Utility'
import PopoverNavigation from './PopoverNavigation'

export let withPopoverNavigation = (Comp, popoverOptions) => props => <PopoverNavigation {...popoverOptions}><Comp {...props} /></PopoverNavigation>;

function PopoverStackNavigator(RouteConfigs, StackNavigatorConfig) {
  let routeKeys = Object.keys(RouteConfigs);
  let newRouteConfigs = {};
  let shouldShowInPopover = StackNavigatorConfig.showInPopover || isTablet;
  routeKeys.forEach((route, i) => {
    let getRegisteredView = () => PopoverStackNavigator.registeredViews.hasOwnProperty(route) ? PopoverStackNavigator.registeredViews[route] : null;
    newRouteConfigs[route] = Object.assign({}, 
      RouteConfigs[route], 
      { 
        screen: withPopoverNavigation(RouteConfigs[route].screen, Object.assign({}, 
          RouteConfigs[route].popoverOptions, 
          {
            showInPopover: i > 0,
            getRegisteredView, 
            backgroundColor: StackNavigatorConfig.cardStyle ? StackNavigatorConfig.cardStyle.backgroundColor : (i > 0 ? 'white' : '#E9E9EF')
          }
        ))
      }
    );
  });

  const nonPopoverStack = StackNavigator(RouteConfigs, StackNavigatorConfig);
  const popoverStackConfig = Object.assign({}, StackNavigatorConfig, {transitionConfig: popoverTransitionConfig, headerMode: 'screen', cardStyle: {backgroundColor: 'transparent', ...StackNavigatorConfig.cardStyle}});
  const popoverStack = StackNavigator(newRouteConfigs, popoverStackConfig);

  class InternalPopoverStackNavigator extends React.Component {
    state = {
       width: 0,
       height: 0
    }

    updateLayout(evt) {
      this.setState({
        width: evt.nativeEvent.layout.width,
        height: evt.nativeEvent.layout.height
      });
    }

    render() {
      let { navigatorRef, ...other } = this.props;
      let Stack = nonPopoverStack;
      if (shouldShowInPopover(this.state.width, this.state.height)) Stack = popoverStack;
      return (
        <View 
          onLayout={this.updateLayout.bind(this)} 
          style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0}}>
          <Stack ref={navigatorRef} {...other} />
        </View>
      )
    }
  }

  return InternalPopoverStackNavigator;
}

PopoverStackNavigator.registeredViews = {};
PopoverStackNavigator.registerRefForView = (ref, view) => {
  PopoverStackNavigator.registeredViews[view] = ref;
}

export default PopoverStackNavigator;
