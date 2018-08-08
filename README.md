## react-native-popover-view

[![npm version](http://img.shields.io/npm/v/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")
[![npm version](http://img.shields.io/npm/dm/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")
[![npm licence](http://img.shields.io/npm/l/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")

A well-tested, adaptable, lightweight `<Popover>` component for react-native. Great for use in Tablets; you can put entire views that you would normally show in a modal (on a smaller device) into a popover, optionally give it an anchor point, and have it float on top of all of the other views.

It is written entirely in JavaScript, but uses [React Native's native driver](https://facebook.github.io/react-native/blog/2017/02/14/using-native-driver-for-animated.html) for responsive animations, even when the JS thread is busy.

The `<Popover>` is able to handle dynamic content and adapt to screen size changes while showing, and will move out of the way for on-screen keyboards automatically.


##### Table of Contents
* [Features](#features)
* [Upgrading](#upgrading)
* [Demo](#demo)
* [Origins](#origins)
* [Installation](#installation)
* [Standalone Usage](#standalone)
  * [Props](#props)
  * [Example](#standalone-example)
* [Usage with React Navigation](#rn)
  * [Setup](#setup)
  * [Example](#rn-example)
  * [Advanced Usage](#advanced)
* [Contributing](#contributing)
* [Credits](#credits)

## <a name="features"/>Popover Features
* Moves to avoid keyboard
* Ability to show from a view, from a rect, or float in center of screen
* Adapts to changing content size
* Automatically detects best placement on screen
* Moves to stay visible on orientation change or when entering split-screen mode
* (Optional) Integration with [React Navigation](https://reactnavigation.org)

## <a name="upgrading" />Upgrading

#### `0.7` to `1.0`

The only breaking change in version 1.0 was renaming `PopoverStackNavigator` to `createPopoverStackNavigator`, to match the `react-navigation` other navigation functions.

#### `0.5` to `0.6`

Version 0.6 brought some large changes, increasing efficiency, stability, and flexibility.  For React Navigation users, there is a new prop, `showInPopover`, that you might want to pass to `createPopoverStackNavigator` if you want to customize when to show stack views in a Popover.  This replaces `PopoverNavigation.shouldShowInPopover`. See the new [setup](#setup) instructions below for details.

## <a name="demo"/>Demo App

You can play around with the various features using [the Expo test app](https://expo.io/@steffeydev/popover-view-test-app).
Source Code: [react-native-popover-view-test-app](https://github.com/SteffeyDev/react-native-popover-view-test-app)

### <a name="origins"/>A Note on Origins

This is a fork of [react-native-popover](https://github.com/jeanregisser/react-native-popover), originally created by Jean Regisser but since abandoned.

I have rebuilt most of the library from the ground up for improved handling of changing screen sizes on tablets (split-screen mode), a redesigned automatic placement algorithm, and ES6 compatibility.

Similar forks exist on Github (such as [react-native-modal-popover](https://github.com/doomsower/react-native-modal-popover)), but this is the first to be published on NPM as far as I know.

## <a name="installation"/>Installation

```shell
npm i react-native-popover-view
```
or
```shell
yarn add react-native-popover-view
```

## <a name="standalone"/>Standalone Usage

```jsx
import Popover from 'react-native-popover-view'

...
  render (
    <Popover
      isVisible={this.state.isVisible}>
      <CustomElement />
    </Popover>
  )
```

### <a name="props"/>Props

Prop              | Type     | Optional | Default     | Description
----------------- | -------- | -------- | ----------- | -----------
isVisible         | bool     | No       | false       | Show/Hide the popover
fromView          | ref      | Yes      | null        | The `ref` of the view that should anchor the popover.
fromRect          | rect     | Yes      | null        | Alternative to `fromView`.  Rectangle at which to anchor the popover.
displayArea       | rect     | Yes      | screen rect | Area where the popover is allowed to be displayed
placement         | string   | Yes      | 'auto'      | How to position the popover - top &#124; bottom &#124; left &#124; right &#124; auto. When 'auto' is specified, it will determine the ideal placement so that the popover is fully visible within `displayArea`.
onClose           | function | Yes      |             | Callback to be fired when the user taps outside the popover
doneClosingCallback | function | Yes    |             | Callback to be fired when the popover is finished closing (after animation)
showInModal       | bool     | Yes      | true        | Whether the popover should be encapsulated in the [Modal view from RN](https://facebook.github.io/react-native/docs/modal.html), which allows it to show above all other content, or just be present in the view hierarchy like a normal view.
arrowStyle        | object   | Yes      | {}          | The style of the arrow that points to the rect. Supported options are `width`, `height`, and `backgroundColor`. You can use `{backgroundColor: 'transparent'}` to hid the arrow completely.
popoverStyle      | object   | Yes      | {}          | The style of the popover itself. You can override the `borderRadius`, `backgroundColor`, or any other [`style` prop for a `View`](https://facebook.github.io/react-native/docs/view-style-props.html).
showBackground    | bool     | Yes      | true        | Whether the background behind the popover darkens when the popover is shown.
animationConfig    | object     | Yes      |          | An object containing any configuration options that can be passed to Animated.timing (e.g. `{ duration: 600, easing: Easing.inOut(Easing.quad) }`).  The configuration options you pass will override the defaults for all animations.

If neither `fromRect` or `fromView` are provided, the popover will float in the center of the screen.

`rect` is an object with the following properties: `{x: number, y: number, width: number, height: number}`. You can create the object yourself, or `import Popover, { Rect } from 'react-native-popover-view` and create a rect by calling `new Rect(x, y, width, height)`.

Likewise, `size` is an object with the following properties: `{width: number, height: number}`. You can create the object yourself, or `import Popover, { Size } from 'react-native-popover-view` and create a rect by calling `new Size(width, height)`.

### <a name="standalone-example"/>Full Example
```jsx
import React, { Component } from 'react';
import Popover from 'react-native-popover-view';
import {
  AppRegistry,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';

class PopoverExample extends Component {
  state = {
    isVisible: false
  }

  showPopover() {
    this.setState({isVisible: true});
  }

  closePopover() {
    this.setState({isVisible: false});
  }

  render() {
    return (
      <View style={styles.container}>
        <TouchableHighlight ref={ref => this.touchable = ref} style={styles.button} onPress={() => this.showPopover()}>
          <Text>Press me</Text>
        </TouchableHighlight>

        <Popover
          isVisible={this.state.isVisible}
          fromView={this.touchable}
          onClose={() => this.closePopover()}>
          <Text>I'm the content of this popover!</Text>
        </Popover>
      </View>
    );
  }
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(43, 186, 180)',
  },
  button: {
    borderRadius: 4,
    padding: 10,
    marginLeft: 10,
    marginRight: 10,
    backgroundColor: '#ccc',
    borderColor: '#333',
    borderWidth: 1,
  }
});

AppRegistry.registerComponent('PopoverExample', () => PopoverExample);
```

---

## <a name="rn"/>Usage with React Navigation

This can also be integrated with react-navigation's stack navigator, so that on tablets, views higher up in the stack show in a popover instead of in a full-screen modal.

### <a name="setup"/>Basic Setup


#### 1) Change `createStackNavigator` to `createPopoverStackNavigator`

`createPopoverStackNavigator` is a drop-in replacement for react-navigation's `createStackNavigator`.  It assumes the first view in your `routeConfigMap` is the base view, and every other view should be shown in a Popover when the `showInPopover` prop is `true` (see step #2).
You can pass a few (optional) per-screen options through your `routeConfigMap` or globally through your `stackConfig`:

Option      | Type              | Default                | Description
----------- | ----------------- | ---------------------- | --------------
`placement` | PLACEMENT_OPTIONS | PLACEMENT_OPTIONS.AUTO | Passed through to `Popover`.
`contentContainerStyle` | number        | {width: 380}   | The style for the internal view that wraps the `Popover`.
`showInModal`   | boolean       | true                   | Passed through to `Popover`. If you want to stack multiple `Popover`'s, only the bottom one can be shown in a `Modal` on iOS.
`showBackground` | boolean      | true                   | Passed through to `Popover`
`arrowStyle` | object           | {}                     | Passed through to `Popover`
`popoverStyle` | object           | {}                   | Passed through to `Popover`
`animationConfig` | object           |                   | Passed through to `Popover`

Note: If you pass a value through the `stackConfig`, and pass the same option for an individual screen, the value passed for the screen overrides.

Example:
```jsx
import Popover, { createPopoverStackNavigator } from 'react-native-popover-view';

let stack = createPopoverStackNavigator({
  BaseView: {
    screen: BaseView,
    navigationOptions: {
      title: 'BaseView',
      ...otherOptions
    }
  },
  ModalView: {
    screen: ModalView,
    navigationOptions: {
      title: 'ModalView',
      ...otherOptions // You'll probably want to pass in your header style's here
    },
    popoverOptions: {
      placement: Popover.PLACEMENT_OPTIONS.BOTTOM,
      showBackground: true // Remember: this overrides the global popoverOptions passed in below
    }
  }
}, 
{
  mode: 'modal',
  popoverOptions: {
    showBackground: false,
    contentContainerStyle: {
      width: 500,
      ...otherStyles // These can be any styles you'd normally apply to a view
    }
  }
});
```

#### 2) Define when Popover should be shown

By default, views will be shown in a Popover view on tablets, and normally on phones.  To override this behavior, you can pass the `showInPopover` prop to the class returned by `createPopoverStackNavigator`:

```jsx
let Stack = createPopoverStackNavigator(...);
...
  render() {
    let smallScreen = this.props.width < 500;
    return <Stack showInPopover={!smallScreen} />;
  }
```

This sort of width-based test is needed if your app can be launched in split-screen mode on tablets, because the default value is always `true` on tablets regardless of the actual display width of your app.

#### 3) (Optional) Set Popover Source

There are several ways to make sure the `Popover` shows from the button that triggered it:

##### I. (Recommended) Register Refs for Views

You can register the button as the source of the `Popover` for a particular route.  Check out this example:

We first register the ref for a view:
```jsx
<TouchableHighlight ref={ref => createPopoverStackNavigator.registerRefForView(ref, 'View1')} {...otherProps} />
```
Then, if `View1` is a route name in a `createPopoverStackNavigator`...
```jsx
import View1 from './views/View1';
...
let stack = createPopoverStackNavigator({
  View1: {
    screen: View1,
    navigationOptions: navOptions
  }
}, options);
```

When we navigate to the view, the `Popover` will originate from the associated `TouchableHighlight`:
```jsx
this.props.navigation.navigate('View1', params);
```

You can register any type of view, not only a `TouchableHighlight`, and the `Popover` will point to the outside of the bounds of that view.

Note: The map is stored statically, so you cannot register two views with the same name, even if they are in different `createPopoverStackNavigator`'s.  

##### II. Send showFromView

If you need even more fine-grained control, such as wanting to open the same child but have it originate from different views at different times, you can pass the `showFromView` param in your `navigate` call:

```js
this.props.navigation.navigate('View1', {showFromView: this.storedView});
```
where `this.storedView` is a ref of a component (obtained through a `ref` callback).

##### III. Use a Custum Rect
See "Show Popover from custom rect" in the Advanced Usage section below.

### <a name="rn-example"/>Full Example

```jsx
import React, { Component } from 'react';
import { createPopoverStackNavigator } from 'react-native-popover-view';
import { MoreHeaderView, ExtraInfoView, MoreOptionView } from './myOtherViews';
import { Colors } from './Colors';
import DeviceInfo from 'react-native-device-info';

class MoreView extends Component {
  render() {
    return (
      <View style={styles.viewStyle}>
        <MoreHeaderView />
        <View>
          <TouchableHighlight
            style={styles.buttonStyle} 
            ref={touchable => createPopoverStackNavigator.registerRefForView(touchable, 'About')} 
            onPress={() => this.props.navigation.navigate('About')}>
            <Text>About the App</Text>
          </TouchableHighlight>
          <TouchableHighlight
            style={styles.buttonStyle} 
            ref={touchable => createPopoverStackNavigator.registerRefForView(touchable, 'Settings')} 
            onPress={() => this.props.navigation.navigate('Settings')}>
            <Text>Content Settings</Text>
          </TouchableHighlight>
          <TouchableHighlight
            style={styles.buttonStyle} 
            ref={touchable => createPopoverStackNavigator.registerRefForView(touchable, 'Account')} 
            onPress={() => this.props.navigation.navigate('Account')}>
            <Text>Account Details</Text>
          </TouchableHighlight>
        </View>
        <ExtraInfoView />
      </View>
    )
  }
}

let MoreStack = createPopoverStackNavigator({
  MoreView: {
    screen: MoreView,
    navigationOptions: {title: 'More'}
  },
  About: {
    screen: AboutView,
    navigationOptions: {title: 'About', ...styles.headerStyle}
  },
  Settings: {
    screen: SettingsView,
    navigationOptions: {title: 'Settings', ...styles.headerStyle}
  },
  Account: {
    screen: AccountView,
    navigationOptions: {title: 'About', ...styles.headerStyle}
  },
}, {
  headerMode: 'screen'
});

export default class MoreStackWrapper extends Component {
  state = { width: DeviceInfo.getInitialWidth() }
  render() {
    return (
      <View
        style={styles.fullScreenViewStyle} 
        onLayout={evt => this.setState({width: evt.nativeEvent.layout.width})}>
        <MoreStack showInPopover={DeviceInfo.isTablet() && this.state.width > 500} />
      </View>
    );
  }
}

let styles = {
  buttonStyle: {
    width: 100,
    height: 40,
    marginBottom: 50
  },
  viewStyle: {
    alignItems: 'center'
  },
  headerStyle: {
    headerStyle: {
      backgroundColor: Colors.backgroundColor
    },
    headerTintColor: Colors.tintColor,
    headerTitleStyle: {
      color: Colors.headerTextColor
    }
  },
  fullScreenViewStyle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  }
}
```
### <a name="advanced"/>Advanced Usage

#### Custumize Display Area used by Popovers

By default, Popover's will query RN's `SafeAreaView` to get the allowed display area on the device, and then add a 10pt padding around all the edges, and set this as the display area.  If you want to inject a custum display area to a specific popover, you can do so either through the `createPopoverStackNavigator`'s `RouteConfigs` or through params in the `navigate` call:

```jsx
let Stack = createPopoverStackNavigator({
  View1: {
    screen: 'View1',
    popoverOptions: {
      displayArea: new Rect(0, 0, 50, 50)
    },
    ...otherOptions
  },
  ...otherViews
}, options);
```
OR
```jsx
this.props.navigation.navigate('View1', {displayArea: new Rect(0, 0, 50,50)});
```

#### Show Popover from custom rect

There may be situations in which you want to show a `Popover` with a custom fromRect, not tied to any view.  Instead of using `createPopoverStackNavigator.registerRefForView`, you can pass in a custom `fromRect` as params to the `navigate()` call.  For example:
```jsx
import { Rect } from 'react-native-popover-view';
...
  this.props.navigation.navigate('NextView', {fromRect: new Rect(10, 10, 40, 20), ...otherParams});
```

If the rect uses variables that could change when the display area changes, you should instead use `calculateRect`, and pass in a function that will return the rect.  For example, if your popover originates from a button that is always centered, regardless of screen size, you could use the following:
```jsx
import { Rect } from 'react-native-popover-view';
...
  this.props.navigation.navigate('NextView', {calculateRect: () => new Rect(this.state.width/2 - 20, 50, 40, 20), ...otherParams});
```
Now, if your app is put into split-screen mode while the popover is still showing, `calculateRect` will be called again, and the popover will shift to point to the new rect.

## <a name="contributing">Contributing

Pull requests are welcome; if you find that you are having to bend over backwards to make this work for you, feel free to open an issue or PR!  Of course, try to keep the same coding style if possible and I'll try to get back to you as soon as I can.

## <a name="credits"/>Credits

Original codebase created by Jean Regisser <jean.regisser@gmail.com> (https://github.com/jeanregisser) as [react-native-popover](https://github.com/jeanregisser/react-native-popover), which has been abandoned.

---

**MIT Licensed**
