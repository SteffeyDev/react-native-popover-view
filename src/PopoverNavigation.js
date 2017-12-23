import Popover, { Rect, PLACEMENT_OPTIONS } from './Popover'
import React, { Component } from 'react'
import { View, BackHandler, Dimensions } from 'react-native'
import PropTypes from 'prop-types';

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
const defaultDisplayArea = new Rect(10, 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-20);

let popoverDisplayAreaChangeListeners = [];
let displayAreaStore = null;

let shouldShowInPopover = () => true;

function addPopoverInstance(instance) {
  popoverDisplayAreaChangeListeners.push(instance);
  return () => popoverDisplayAreaChangeListeners.splice(popoverDisplayAreaChangeListeners.indexOf(instance), 1);
}

export function navigationTransitionConfig() {
  return {
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
  }
}

export default class PopoverNavigation extends Component {
  static navigationOptions = {
  }

  state = {
    visible: true,
    displayArea: displayAreaStore || defaultDisplayArea
  }

  static setShouldShowInPopover(func) {
    shouldShowInPopover = func;
  }

  static setDisplayArea(displayArea) {
    popoverDisplayAreaChangeListeners.forEach(instance => instance.relayout(displayArea));
  }

  goBack() {
    if (shouldShowInPopover())
      this.setState({visible: false});
    else
      this.props.children.props.navigation.goBack();
  }

  componentDidMount() {
    BackHandler.addEventListener('hardwareBackPress', this.backButtonPressed);
    this.removeDisplayAreaChangeListener = addPopoverInstance(this);
    this.saveStashRect()
  }

  saveStashRect = () => this.stashRect = this.props.children.props.navigation.state.params.calculateRect(this.state.displayArea.width, this.state.displayArea.height);

  relayout({width, height}) {
    if (width !== this.state.width, height !== this.state.height) {
      let displayArea = this.state.displayArea;
      displayArea.width = width;
      displayArea.height = height;

      // If we are using calculateRect, need to watch for new values and wait to update until after they come in
      if (this.props.children.props.navigation.state.params && this.props.children.props.navigation.state.params.calculateRect) {
        let interval = setInterval(() => {
          let newRect = this.props.children.props.navigation.state.params.calculateRect(this.state.width, this.state.height);
          if (newRect !== this.stashRect) {
            this.setState({displayArea}, () => this.saveStashRect());
            clearInterval(interval);
          }
        }, 100)
        setTimeout(() => clearInterval(interval), 2000); // Failsafe so that the interval doesn't run forever
      } else {
        this.setState({displayArea});
      }
    }
  }

  backButtonPressed = () => {
    this.goBack();
    return true;
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.backButtonPressed);
    this.removeDisplayAreaChangeListener();
  }

  render() {
    const child = React.cloneElement(this.props.children, {goBack: () => this.goBack()});
    const { preferedWidth, preferedHeight, arrowSize, placement, showInModal, layoutRtl, showArrow } = this.props;
    const displayArea = { width: this.state.width, height: this.state.height };
    if (shouldShowInPopover()) {
      return (
        <Popover
          arrowSize={arrowSize}
          placement={placement}
          showInModal={showInModal}
          layoutRtl={layoutRtl}
          showArrow={showArrow}
          isVisible={this.state.visible}
          onClose={() => this.goBack()}
          displayArea={displayArea}
          doneClosingCallback={() => this.props.children.props.navigation.goBack()}
          fromRect={this.props.children.props.navigation.state.params && (this.props.children.props.navigation.state.params.fromRect ||  (this.props.children.props.navigation.state.params.calculateRect && this.props.children.props.navigation.state.params.calculateRect(displayArea.width, displayArea.height)))}>
          <View style={{width: Math.min(displayArea.width - 100, preferedWidth), height: preferedHeight ? Math.min(displayArea.height - 100, preferedHeight) : null}}>{child}</View>
        </Popover>
      )
    } else {
      return child;
    }
  }
}

PopoverNavigation.defaultProps = {
  preferedWidth: 380
}

PopoverNavigation.propTypes = {
  arrowSize: PropTypes.objectOf(PropTypes.number),
  placement: PropTypes.oneOf([PLACEMENT_OPTIONS.LEFT, PLACEMENT_OPTIONS.RIGHT, PLACEMENT_OPTIONS.TOP, PLACEMENT_OPTIONS.BOTTOM, PLACEMENT_OPTIONS.AUTO]),
  showInModal: PropTypes.bool,
  layoutRtl: PropTypes.bool,
  showArrow: PropTypes.bool,
}
