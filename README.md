## react-native-popover-view

[![npm version](http://img.shields.io/npm/v/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")
[![npm version](http://img.shields.io/npm/dm/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")
[![npm licence](http://img.shields.io/npm/l/react-native-popover-view.svg?style=flat-square)](https://npmjs.org/package/react-native-popover-view "View this project on npm")

A well-tested, adaptable, lightweight `<Popover>` component for react-native.  Tested and working on iOS and Android.  May work on Web, but not officially supported.

It is written entirely in TypeScript, but uses [React Native's native driver](https://facebook.github.io/react-native/blog/2017/02/14/using-native-driver-for-animated.html) for responsive animations, even when the JS thread is busy.

The `<Popover>` is able to handle dynamic content and adapt to screen size changes while showing, and will move out of the way for on-screen keyboards automatically.


##### Table of Contents
* [Features](#features)
* [Demo](#demo)
* [Installation](#installation)
* [Usage](#usage)
* [Props](#props)
* [Usage with Safe Area Context](#safeArea)
* [Troubleshooting](#troubleshooting)
* [Upgrading](#upgrading)
* [Contributing](#contributing)
* [Credits](#credits)

## <a name="features"/>Popover Features
* Extremely simple but also highly customizable
* Moves to avoid keyboard
* Ability to show from a view, from a rect, or float in center of screen
* Adapts to changing content size
* Automatically detects best placement on screen
* Moves to stay visible on orientation change or when entering split-screen mode
* Great for use in Tablets: you can put entire views that you would normally show in a modal (on a smaller device) into a popover, optionally give it an anchor point, and have it float on top of all of the other views.

## <a name="demo"/>Demo App

You can play around with the various features using [the Expo test app](https://expo.io/@steffeydev/popover-view-test-app).
Source Code: [react-native-popover-view-test-app](https://github.com/SteffeyDev/react-native-popover-view-test-app)


## <a name="installation"/>Installation

```shell
npm i react-native-popover-view
```
or
```shell
yarn add react-native-popover-view
```

## <a name="usage"/>Usage

### Showing popover from an element

For the simplest usage, just pass your `Touchable` into the `from` prop.  The `Popover` will automatically be shown when the `Touchable` is pressed.

```jsx
import React from 'react';
import Popover from 'react-native-popover-view';

function App() {
  return (
    <Popover
      from={(
        <TouchableOpacity>
          <Text>Press here to open popover!</Text>
        </TouchableOpacity>
      )}>
      <Text>This is the contents of the popover</Text>
    </Popover>
  );
}
```
Note that if you pass an `onPress` or `ref` prop to the `Touchable` it will be overwritten.

### Showing popover from an element (advanced)

For more advanced usage, pass in a function that returns any React element.  You control which element the popover anchors on (using the `sourceRef`) and when the popover will be shown (using the `showPopover` callback).  In this example, the `Popover` will appear to originate from the text _inside_ the popover, and will only be shown when the `Touchable` is held down.

```jsx
import React from 'react';
import Popover from 'react-native-popover-view';

function App() {
  return (
    <Popover
      from={(sourceRef, showPopover) => (
        <View>
          <TouchableOpacity onLongPress={showPopover}>
            <Text ref={sourceRef}>Press here to open popover!</Text>
          </TouchableOpacity>
        </View>
      )}>
      <Text>This is the contents of the popover</Text>
    </Popover>
  );
}
```

### Showing popover from an element (allow manual dismiss)

You can control visibility yourself instead of letting the `Popover` manage it automatically by using the `isVisible` and `onRequestClose` prop.  This would allow you to manually dismiss the `Popover`.  `onRequestClose` is called when the user taps outside the `Popover`.  If you want to force the user to tap a button inside the `Popover` to dismiss, you could omit `onRequestClose` and change the state manually.

```jsx
import React, { useState, useEffect } from 'react';
import Popover from 'react-native-popover-view';

function App() {
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowPopover(false), 2000);
  }, []);

  return (
    <Popover
      isVisible={showPopover}
      onRequestClose={() => setShowPopover(false)}
      from={(
        <TouchableOpacity onPress={() => setShowPopover(true)}>
          <Text>Press here to open popover!</Text>
        </TouchableOpacity>
      )}>
      <Text>This popover will be dismissed automatically after 2 seconds</Text>
    </Popover>
  );
}
```

### Showing popover from a reference to an element

If you need even more control (e.g. having the `Popover` and `Touchable` in complete different parts of the node hierarchy), you can just pass in a normal `ref`.

```jsx
import React, { useRef, useState } from 'react';
import Popover from 'react-native-popover-view';

function App() {
  const touchable = useRef();
  const [showPopover, setShowPopover] = useState(false);

  return (
    <>
      <TouchableOpacity ref={touchable} onPress={() => setShowPopover(true)}>
        <Text>Press here to open popover!</Text>
      </TouchableOpacity>
      <Popover from={touchable} isVisible={showPopover} onRequestClose={() => setShowPopover(false)}>
        <Text>This is the contents of the popover</Text>
      </Popover>
    </>
  );
}
```

### Showing popover from a predetermined position

If you already know the exact location of the place you want the `Popover` to anchor, you can create a `Rect(x, y, width, height)` object, and show from that `Rect`.  Note that `Rect(x, y, 0, 0)` is equivalent to showing from the point `(x, y)`.

```jsx
import React, { useState } from 'react';
import Popover, { Rect } from 'react-native-popover-view';

function App() {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setShowPopover(true)}>
        <Text>Press here to open popover!</Text>
      </TouchableOpacity>
      <Popover from={new Rect(5, 100, 20, 40)} isVisible={showPopover} onRequestClose={() => setShowPopover(false)}>
        <Text>This is the contents of the popover</Text>
      </Popover>
    </>
  );
}
```

### Showing popover centered on the screen

If you just want the popover to be centered on the screen, not anchored to anything, you can omit the `from` prop altogether.

```jsx
import React, { useState } from 'react';
import Popover from 'react-native-popover-view';

function App() {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setShowPopover(true)}>
        <Text>Press here to open popover!</Text>
      </TouchableOpacity>
      <Popover isVisible={showPopover} onRequestClose={() => setShowPopover(false)}>
        <Text>This popover will stay centered on the screen, even when the device is rotated!</Text>
      </Popover>
    </>
  );
}
```

### Showing popover in a specific direction

Normally, the `Popover` will automatically pick the direction it pops out based on where it would fit best on the screen, even showing centered and unanchored if the contents would be compressed otherwise.  If you would like to force a direction, you can pass in the `placement` prop.

```jsx
import React from 'react';
import Popover, { PopoverPlacement } from 'react-native-popover-view';

function App() {
  return (
    <Popover
      placement={PopoverPlacement.BOTTOM}
      from={(
        <TouchableOpacity>
          <Text>Press here to open popover!</Text>
        </TouchableOpacity>
      )}>
      <Text>This is the contents of the popover</Text>
    </Popover>
  );
}
```

### Showing popover as a tooltip

Normally, the popover creates a background that dims the content behind it.  You can also show a tooltip without fading the background.  Read more about the available modes below.  Note that when using `TOOLTIP` mode, you must control the visiblity manually (`onRequestClose` will never be called).

```jsx
import React, { useRef, useState } from 'react';
import Popover, { PopoverMode, PopoverPlacement } from 'react-native-popover-view';

function App() {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <Popover
      mode={PopoverMode.TOOLTIP}
      placement={PopoverPlacement.TOP}
      isVisible={showPopover}
      from={(
        <TouchableOpacity onPress={() => setShowPopover(true)}>
          <Text>Press here to open popover!</Text>
        </TouchableOpacity>
      )}>
      <>
        <Text>This is the contents of the popover</Text>
        <TouchableOpacity onPress={() => setShowPopover(false)}>
          <Text>Dismiss</Text>
        </TouchableOpacity>
      </>
    </Popover>
  );
}
```

### Using class components

If you are not using functional components and hooks yet, you can still use class components in almost every case outlined above.  Here is an example of using a class component and a `ref`, which is slightly different when using class components.

```jsx
import React, { createRef } from 'react';
import Popover from 'react-native-popover-view';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.touchable = createRef();
    this.state = {
      showPopover: false
    }
  }

  render() {
    return (
      <>
        <TouchableOpacity ref={this.touchable} onPress={() => this.setState({ showPopover: true })}>
          <Text>Press here to open popover!</Text>
        </TouchableOpacity>
        <Popover
          from={this.touchable}
          isVisible={this.state.showPopover}
          onRequestClose={() => this.setState({ showPopover: false })}>
          <Text>This is the contents of the popover</Text>
        </Popover>
      </>
    );
  }
}
```

## <a name="props"/>Props

All props are optional

Prop              | Type     | Default     | Description
----------------- | -------- | ----------- | -----------
isVisible         | bool     | false       | Show/Hide the popover
mode              | string   | 'rn-modal'  | One of: 'rn-modal', 'js-modal', 'tooltip'. See [Mode](#mode) section below for details.
from              | element OR  | Yes      | null        | Either a React element, a function that returns a React element, a `ref` created from `React.createRef` or `React.useRef`, or a Rect object created by `new Rect(x, y, width, height)`.
displayArea       | rect     |             | Area where the popover is allowed to be displayed.  By default, this will be automatically calculated to be the size of the display, or the size of the parent component if mode is not 'rn-modal'.
placement         | string   | 'auto'      | How to position the popover - top &#124; bottom &#124; left &#124; right &#124; center &#124; auto. When 'auto' is specified, it will determine the ideal placement so that the popover is fully visible within `displayArea`.
animationConfig   | object   |             | An object containing any configuration options that can be passed to Animated.timing (e.g. `{ duration: 600, easing: Easing.inOut(Easing.quad) }`).  The configuration options you pass will override the defaults for all animations.
verticalOffset    | number   | 0           | The amount to vertically shift the popover on the screen.  In certain Android configurations, you may need to apply a `verticalOffset` of `-StatusBar.currentHeight` for the popover to originate from the correct place.
statusBarTranslucent | bool  |             | For 'rn-modal' mode only. Determines whether the background should go under the status bar. Passed through to RN `Modal` component, see [their docs](https://reactnative.dev/docs/modal#statusbartranslucent-1) as well.
displayAreaInsets | object   |             | Insets to apply to the display area.  The Popover will not be allowed to go beyond the display area minus the insets.
popoverStyle      | object   |             | The style of the popover itself. You can override the `borderRadius`, `backgroundColor`, or any other [`style` prop for a `View`](https://facebook.github.io/react-native/docs/view-style-props.html).
backgroundStyle   | object   |             | The style of the background that fades in.
arrowStyle        | object   |             | The style of the arrow that points to the rect. Supported options are `width`, `height`, and `backgroundColor`. You can use `{backgroundColor: 'transparent'}` to hide the arrow completely.
arrowShift        | number   | 0           | How much to shift the arrow to either side, as a multiplier. `-1` will shift it all the way to the left (or top) corner of the source view, while `1` will shift all the way to the right (or bottom) corner.  A value of `0.5` or `-0.8` will shift it partly to one side.
onOpenStart       | function |             | Callback to be fired when the open animation starts (before animation)
onOpenComplete    | function |             | Callback to be fired when the open animation ends (after animation)
onRequestClose    | function |             | Callback to be fired when the user taps outside the popover (on the background) or taps the "hardware" back button on Android
onCloseStart      | function |             | Callback to be fired when the popover starts closing (before animation)
onCloseComplete   | function |             | Callback to be fired when the popover is finished closing (after animation)
debug             | bool     | false       | Set this to `true` to turn on debug logging to the console.  This is useful for figuring out why a Popover isn't showing.

If no `from` is provided, the popover will float in the center of the screen.

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

## <a name="safeArea" />Usage with Safe Area Context

Some devices have notches or other screen features that create zones where you might want to avoid showing a `Popover`.  To do so, follow the instructions to setup [`react-native-safe-area-context`](https://github.com/th3rdwave/react-native-safe-area-context), then use the provided hooks to pass the safe area insets straight to the `displayAreaInsets` prop:

```jsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Popover from 'react-native-popover-view';

function PopoverSafeWrapper(props) {
  const insets = useSafeAreaInsets();
  return (
    <Popover {...props} displayAreaInsets={insets} />
  );
}
```

---

## <a name="troubleshooting" />Troubleshooting

In all cases, start by passing the `debug={true}` prop to the Popover, to see if the debug output can help you figure out the issue.

#### Show `from` a ref not working

If on an **Android device**, try adding these props to the component whose `ref` you passed in to `from`:
* `renderToHardwareTextureAndroid={true}`
* `collapsable={false}`

See https://github.com/facebook/react-native/issues/3282 and https://github.com/SteffeyDev/react-native-popover-view/issues/28 for more info.

#### Android vertical positioning incorrect

Depending on how your app is configured, you may need to use the following `verticalOffset` prop to correctly position the popover on Android:
```
import { Platform, StatusBar, ... } from 'react-native';

...

  <Popover
    {...otherProps}
    verticalOffset={Platform.OS === 'android' ? -StatusBar.currentHeight : 0 }
  />
```

## <a name="upgrading" />Upgrading

#### `3.x` to `4.0`

Removed internal safe area view; if you want the Popover to avoid showing behind notches on some devices, follow the instructions: [Usage with Safe Area Context](#safeArea).

#### `2.x` to `3.0`

* `fromRect` and `fromView` have been consolidated into a single `from` prop, where you can pass a Rect or a Ref.  All Refs passed in must now be a `RefObject` created from `React.createRef` or `React.useRef`.  All Rects passed in must be an actual Rect object (e.g. `from={new Rect(x, y, width, height)}`).
* `from` prop now supports additional modes, including passing in a React element for simpler usage.  See new examples and usage notes above.
* `fromDynamicRect` has been removed.

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

Use `yarn build` to build the `dist` folder (compile TypeScript to JavaScript), and use `yarn watch` to continuously build on save.

## <a name="credits"/>Credits

This is a fork of [react-native-popover](https://github.com/jeanregisser/react-native-popover), originally created by Jean Regisser <jean.regisser@gmail.com> (https://github.com/jeanregisser) but since abandoned.

I have rebuilt most of the library from the ground up for improved handling of changing screen sizes on tablets (split-screen mode), a redesigned automatic placement algorithm, TypeScript, and ES6 compatibility.

Similar forks exist on Github (such as [react-native-modal-popover](https://github.com/doomsower/react-native-modal-popover)), but this is the first to be published on NPM as far as I know.

---

**MIT Licensed**

