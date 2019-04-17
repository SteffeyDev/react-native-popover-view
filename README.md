## react-native-popover-view

[![npm version](http://img.shields.io/npm/v/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")
[![npm version](http://img.shields.io/npm/dm/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")
[![npm licence](http://img.shields.io/npm/l/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")

A well-tested, adaptable, lightweight `<Popover>` component for react-native. Great for use in Tablets; you can put entire views that you would normally show in a modal (on a smaller device) into a popover, optionally give it an anchor point, and have it float on top of all of the other views.

It is written entirely in JavaScript, but uses [React Native's native driver](https://facebook.github.io/react-native/blog/2017/02/14/using-native-driver-for-animated.html) for responsive animations, even when the JS thread is busy.

The `<Popover>` is able to handle dynamic content and adapt to screen size changes while showing, and will move out of the way for on-screen keyboards automatically.


##### Table of Contents
* [Features](#features)
* [Demo](#demo)
* [Origins](#origins)
* [Installation](#installation)
* [Standalone Usage](#standalone)
  * [Props](#props)
  * [Example](#standalone-example)
* [Usage with React Navigation](#rn)
* [Troubleshooting](#troubleshooting)
* [Upgrading](#upgrading)
* [Contributing](#contributing)
* [Credits](#credits)

## <a name="features"/>Popover Features
* Moves to avoid keyboard
* Ability to show from a view, from a rect, or float in center of screen
* Adapts to changing content size
* Automatically detects best placement on screen
* Moves to stay visible on orientation change or when entering split-screen mode
* (Optional) Integration with [React Navigation](https://reactnavigation.org)

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
mode              | string   | Yes      | 'rn-modal'  | One of: 'rn-modal', 'js-modal', 'tooltip'. See [Mode](#mode) section below for details.
fromView          | ref      | Yes      | null        | The `ref` of the view that should anchor the popover.
fromRect          | rect     | Yes      | null        | Alternative to `fromView`.  Rectangle at which to anchor the popover.
fromDynamicRect   | function | Yes      |             | Same as `fromRect`, but instead of passing a static rectangle, pass a function that takes the display area dimensions as parameters: `(displayAreaWidth, displayAreaHeight) => new Rect(...)`
displayArea       | rect     | Yes      | screen rect | Area where the popover is allowed to be displayed
placement         | string   | Yes      | 'auto'      | How to position the popover - top &#124; bottom &#124; left &#124; right &#124; auto. When 'auto' is specified, it will determine the ideal placement so that the popover is fully visible within `displayArea`.
animationConfig   | object   | Yes      |             | An object containing any configuration options that can be passed to Animated.timing (e.g. `{ duration: 600, easing: Easing.inOut(Easing.quad) }`).  The configuration options you pass will override the defaults for all animations.
verticalOffset    | number   | Yes      | 0           | The amount to vertically shift the popover on the screen.  In certain Android configurations, you may need to apply a `verticalOffset` of `-StatusBar.currentHeight` for the popover to originate from the correct place.
popoverStyle      | object   | Yes      | {}          | The style of the popover itself. You can override the `borderRadius`, `backgroundColor`, or any other [`style` prop for a `View`](https://facebook.github.io/react-native/docs/view-style-props.html).
arrowStyle        | object   | Yes      | {}          | The style of the arrow that points to the rect. Supported options are `width`, `height`, and `backgroundColor`. You can use `{backgroundColor: 'transparent'}` to hid the arrow completely.
backgroundStyle   | object   | Yes      | {}          | The style of the background that fades in.
onOpenStart       | function | Yes      |             | Callback to be fired when the open animation starts (before animation)
onOpenComplete    | function | Yes      |             | Callback to be fired when the open animation ends (after animation)
onRequestClose    | function | Yes      |             | Callback to be fired when the user taps outside the popover (on the background) or taps the "hardware" back button on Android
onCloseStart      | function | Yes      |             | Callback to be fired when the popover starts closing (before animation)
onCloseComplete   | function | Yes      |             | Callback to be fired when the popover is finished closing (after animation)
debug             | bool     | Yes      | false       | Set this to `true` to turn on debug logging to the console.  This is useful for figuring out why a Popover isn't showing.

If neither `fromRect` or `fromView` are provided, the popover will float in the center of the screen.

`rect` is an object with the following properties: `{x: number, y: number, width: number, height: number}`. You can create the object yourself, or `import Popover, { Rect } from 'react-native-popover-view` and create a rect by calling `new Rect(x, y, width, height)`.

Likewise, `size` is an object with the following properties: `{width: number, height: number}`. You can create the object yourself, or `import Popover, { Size } from 'react-native-popover-view` and create a rect by calling `new Size(width, height)`.

### <a name="mode"/>Mode

The Popover can show in three modes:
* Popover.MODE.RN_MODAL ('rn-modal')
* Popover.MODE.JS_MODAL ('js-modal')
* Popover.MODE.TOOLTIP ('tooltip')

#### RN Modal (Default)

Shows the popover full screen in a [React Native Modal](https://facebook.github.io/react-native/docs/modal) Component.  The upside is that it is guaranteed to show on top of all other views, regardless of where the `Popover` component is placed in the view hierarchy.  The downside is that you can only have one Modal shown at any one time, so this won't work for nested popovers or if you use a Modal for other reasons.  Taps to the area outside the popover will trigger the `onRequestClose` callback.

#### JS Modal

Shows the popover in the space provided, filling the `Popover` component's parent.  This looks identical to `rn-modal` if the `Popover` component's parent is a top-level view, but may look weird if the `Popover` is nested inside a few views with their own padding and margins.  With careful component hierarchy design, this can allow for nested popovers and popovers in other Modals. Taps to the area outside the popover will trigger the `onRequestClose` callback.

#### Tooltip

Shows the `Popover` without taking over the screen, no background is faded in and taps to the area around the popover fall through to those views (as expected).  The `onRequestClose` callback will never be called, so the `Popover` will have to be dismissed some other way.

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
          onRequestClose={() => this.closePopover()}>
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

To use this library with React Navigation for deep integration, see [react-navigation-popover](https://github.com/SteffeyDev/react-navigation-popover).

## <a name="troubleshooting" />Troubleshooting

In all cases, start by passing the `debug={true}` prop to the Popover, to see if the debug output can help you figure out the issue.

#### Show `fromView` not working

First, make sure that the `ref` is defined prior to showing the Popover.  If you set the Popover's `isVisible` prop to `true` while the variable passed into `fromView` is undefined, the Popover will show centered on the screen.

If you pass in a `fromView` prop, but the Popover still shows centered on the screen on an **Android device**, try adding these props to the component whose `ref` you passed in to `fromView`:
* `renderToHardwareTextureAndroid={true}`
* `collapsable={false}`

See https://github.com/facebook/react-native/issues/3282 and https://github.com/SteffeyDev/react-native-popover-view/issues/28 for more info.

## <a name="upgrading" />Upgrading

#### `1.x` to `2.0`

* `onClose` has been renamed to `onRequestClose` (for clarity and consistency with normal RN Modals)
* New `mode` prop replaces `showInModal`.  Replace `showInModal={false}` with `mode={Popover.MODE.JS_MODAL}`
* `doneClosingCallback` has been renamed `onCloseComplete`
* New `backgroundStyle` prop replaces `showBackground`.  Replace `showBackground={false}` with `backgroundStyle={{ backgroundColor: 'transparent' }}`
* Fix in version 2.0 means that `verticalOffset` may no longer be needed, so if you are using it be sure to test

#### `1.0` to `1.1`

This version moved the react-navigation portion of this project to it's own repository: [react-navigation-popover](https://github.com/SteffeyDev/react-navigation-popover).
To use with react-navigation, install that npm package change `import { createPopoverStackNavigator } from 'react-native-popover-view'` to `import createPopoverStackNavigator from 'react-navigation-popover'`.

#### `0.7` to `1.0`

The only breaking change in version 1.0 was renaming `PopoverStackNavigator` to `createPopoverStackNavigator`, to match the `react-navigation` other navigation functions.

#### `0.5` to `0.6`

Version 0.6 brought some large changes, increasing efficiency, stability, and flexibility.  For React Navigation users, there is a new prop, `showInPopover`, that you might want to pass to `createPopoverStackNavigator` if you want to customize when to show stack views in a Popover.  This replaces `PopoverNavigation.shouldShowInPopover`. See the new [setup](#setup) instructions below for details.

## <a name="contributing">Contributing

Pull requests are welcome; if you find that you are having to bend over backwards to make this work for you, feel free to open an issue or PR!  Of course, try to keep the same coding style if possible and I'll try to get back to you as soon as I can.

## <a name="credits"/>Credits

Original codebase created by Jean Regisser <jean.regisser@gmail.com> (https://github.com/jeanregisser) as [react-native-popover](https://github.com/jeanregisser/react-native-popover), which has been abandoned.

---

**MIT Licensed**
