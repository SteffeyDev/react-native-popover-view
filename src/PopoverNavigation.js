import Popover from './Popover'
import { popoverTransitionConfig, Rect, PLACEMENT_OPTIONS, isIOS } from './Utility'
import React, { Component } from 'react'
import { View, BackHandler, Dimensions, Animated } from 'react-native'
import PropTypes from 'prop-types'

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
const defaultDisplayArea = new Rect(10, 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-20);

let popoverDisplayAreaChangeListeners = [];
let displayAreaStore = null;

export let shouldShowInPopover = () => true;

export let withPopoverNavigationRootWrapper = Comp => props => <View 
  style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}
  onLayout={evt => {
    let popoverDispayArea = {
      x: 10,
      y: isIOS() ? 20 : 10,
      width: evt.nativeEvent.layout.width - 20,
      height: evt.nativeEvent.layout.height - (isIOS() ? 30 : 20)
    }
    PopoverNavigation.setDisplayArea(popoverDispayArea)
  }}><Comp {...props} /></View>

export default class PopoverNavigation extends Component {
  static navigationOptions = {}

  state = {
    visible: true,
    displayArea: displayAreaStore || defaultDisplayArea
  }

  static setShouldShowInPopover(func) {
    shouldShowInPopover = func;
  }

  static setDisplayArea(displayArea) {
    if (displayArea !== displayAreaStore) {
      displayAreaStore = displayArea;
      popoverDisplayAreaChangeListeners.forEach(instance => instance.relayout(displayArea));
    }
  }

  static addPopoverInstance(instance) {
    popoverDisplayAreaChangeListeners.push(instance);
    return () => popoverDisplayAreaChangeListeners.splice(popoverDisplayAreaChangeListeners.indexOf(instance), 1);
  }

  goBack() {
    if (shouldShowInPopover())
      this.setState({visible: false});
    else
      this.props.children.props.navigation.goBack();
  }

  componentDidMount() {
    BackHandler.addEventListener('hardwareBackPress', this.backButtonPressed);
    this.removeDisplayAreaChangeListener = PopoverNavigation.addPopoverInstance(this);
    this.saveStashRect()
  }

  saveStashRect() {
    if (this.props.children.props.navigation.state.params && this.props.children.props.navigation.state.params.calculateRect)
      this.stashRect = this.props.children.props.navigation.state.params.calculateRect(this.state.displayArea.width, this.state.displayArea.height);
  }

  relayout(newDisplayArea) {
    if (newDisplayArea !== this.state.displayArea) {

      // If we are using calculateRect, need to watch for new values and wait to update until after they come in
      if (this.props.children.props.navigation.state.params && this.props.children.props.navigation.state.params.calculateRect) {
        let interval = setInterval(() => {
          let newRect = this.props.children.props.navigation.state.params.calculateRect(newDisplayArea.width, newDisplayArea.height);
          if (newRect !== this.stashRect) {
            clearInterval(interval);
            this.setState({displayArea: newDisplayArea}, () => this.saveStashRect());
          }
        }, 100)
        setTimeout(() => clearInterval(interval), 2000); // Failsafe so that the interval doesn't run forever
      } else {
        this.setState({displayArea: newDisplayArea});
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
    const { preferedWidth, preferedHeight, arrowSize, placement, showInModal, layoutRtl, showArrow, showBackground } = this.props;
    const { displayArea } = this.state;

    if (shouldShowInPopover()) {
      return (
        <Popover
          arrowSize={arrowSize}
          placement={placement}
          showInModal={showInModal}
          layoutRtl={layoutRtl}
          showArrow={showArrow}
          showBackground={showBackground}
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
  showBackground: PropTypes.bool,
  preferedWidth: PropTypes.number,
  preferedHeight: PropTypes.number,
}
