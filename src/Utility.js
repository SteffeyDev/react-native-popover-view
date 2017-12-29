import { Platform, Animated } from 'react-native'

export const PLACEMENT_OPTIONS = {
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left',
    AUTO: 'auto'
};

export function Point(x, y) {
    this.x = x;
    this.y = y;
}

export function Size(width, height) {
    this.width = width;
    this.height = height;
}

export function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

export function isIOS() {
  return Platform.OS === 'ios';
}

// Transition config needed on tablets for popover to work
export let popoverTransitionConfig = () => ({
  transitionSpec: {
    duration: 1,
    timing: Animated.timing,
  },
  screenInterpolator: sceneProps => {
    const { position, scene } = sceneProps
    const { index } = scene

    const translateY = position.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [0, 0, 0],
    })

    const opacity = position.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [0, 1, 1],
    })

    return { opacity, transform: [{ translateY }] }
  },
})
