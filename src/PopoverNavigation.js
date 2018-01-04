import Popover from './Popover'
import { popoverTransitionConfig, Rect, PLACEMENT_OPTIONS, isIOS } from './Utility'
import React, { Component } from 'react'
import { View, BackHandler, Dimensions, Animated, findNodeHandle, NativeModules, Alert} from 'react-native'
import PropTypes from 'prop-types'

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
const defaultDisplayArea = new Rect(10, 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-20);

let popoverDisplayAreaChangeListeners = [];
let popoverRegisteredViews = {};
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
    visible: false,
    displayArea: displayAreaStore || defaultDisplayArea,
    fromRect: null
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

  static registerRefForView(ref, viewName) {
    popoverRegisteredViews[viewName] = ref;
  }

  getParam(param:string) {
    if (this.props.children.props.navigation.state.params)
      return this.props.children.props.navigation.state.params[param];
    else
      return null;
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

    if (this.getParam('showFromView') || popoverRegisteredViews.hasOwnProperty(this.props.viewName)) {
      const ref = this.getParam('showFromView') || popoverRegisteredViews[this.props.viewName];
      NativeModules.UIManager.measure(findNodeHandle(ref), (x0, y0, width, height, x, y) => {
        this.setState({visible: true, fromRect: new Rect(x, y, width, height)});
      })
    } else {
      this.setState({visible: true});
    }
  }

  saveStashRect() {
    if (this.getParam('calculateRect'))
      this.stashRect = this.getParam('calculateRect')(this.state.displayArea.width, this.state.displayArea.height);
  }

  relayout(newDisplayArea) {
    if (newDisplayArea !== this.state.displayArea) {

      const runAfterChange = (getFirst, second, func) => {
        let interval = setInterval(() => {
          getFirst(first => {
            if (first !== second) {
              clearInterval(interval);
              func();
            }
          }, 100)
        });
        setTimeout(() => clearInterval(interval), 2000); // Failsafe so that the interval doesn't run forever
      }

      // If we are using calculateRect, need to watch for new values and wait to update until after they come in
      if (this.getParam('calculateRect')) {
        runAfterChange(callback => callback(this.getParam('calculateRect')(newDisplayArea.width, newDisplayArea.height)), this.stashRect, () => {
          this.setState({displayArea: newDisplayArea}, () => this.saveStashRect());
        });
      } else if (this.getParam('showFromView') || popoverRegisteredViews.hasOwnProperty(this.props.viewName)) {
        const ref = this.getParam('showFromView') || popoverRegisteredViews[this.props.viewName];
        runAfterChange(callback => {
          NativeModules.UIManager.measure(findNodeHandle(ref), (x0, y0, width, height, x, y) => {
            callback(new Rect(x, y, width, height));
          })
        }, this.state.fromRect, () => {
          NativeModules.UIManager.measure(findNodeHandle(ref), (x0, y0, width, height, x, y) => {
            this.setState({fromRect: new Rect(x, y, width, height), displayArea: newDisplayArea});
          })
        });
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

    let fromRect = null;
    if (this.getParam('fromRect'))
      fromRect = this.getParam('fromRect');
    else if (this.getParam('calculateRect'))
      fromRect = this.getParam('calculateRect')(displayArea.width, displayArea.height);
    else
      fromRect = this.state.fromRect;

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
          fromRect={fromRect}>
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
