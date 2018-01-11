import Popover from './Popover'
import { popoverTransitionConfig, Rect, isIOS } from './Utility'
import React, { Component } from 'react'
import { View, BackHandler, Animated, findNodeHandle, NativeModules, Alert, Dimensions } from 'react-native'
import PropTypes from 'prop-types'

export default class PopoverNavigation extends Component {
  static navigationOptions = {}

  state = {
    visible: false,
  }

  getParam(param:string) {
    if (this.props.children.props.navigation.state.params)
      return this.props.children.props.navigation.state.params[param];
    else
      return null;
  }

  goBack() {
    if (this.constructor.shouldShowInPopover())
      this.setState({visible: false});
    else
      this.props.children.props.navigation.goBack();
  }

  componentDidMount() {
    BackHandler.addEventListener('hardwareBackPress', this.backButtonPressed);
    this.setState({visible: true});
  }

  backButtonPressed = () => {
    this.goBack();
    return true;
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.backButtonPressed);
  }

  render() {
    const child = React.cloneElement(this.props.children, {goBack: () => this.goBack()});
    const { preferedWidth, preferedHeight, arrowSize, placement, showInModal, layoutRtl, showArrow, showBackground, viewName, displayArea } = this.props;

    if (this.constructor.shouldShowInPopover()) {
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
          displayArea={displayArea || this.getParam('displayArea')}
          doneClosingCallback={() => this.props.children.props.navigation.goBack()}
          fromView={this.constructor.registeredViews.hasOwnProperty(viewName) ? this.constructor.registeredViews[viewName] : this.getParam('showFromView')}
          calculateRect={this.getParam('calculateRect')}
          fromRect={this.getParam('fromRect')}>
          <View style={{width: preferedWidth, height: preferedHeight}}>{child}</View>
        </Popover>
      )
    } else {
      return child;
    }
  }
}

PopoverNavigation.shouldShowInPopover = () => Dimensions.get('window').height / Dimensions.get('window').width < 1.6;
PopoverNavigation.registeredViews = {};
PopoverNavigation.registerRefForView = (ref, viewName) => {
  if (!PopoverNavigation.registeredViews.hasOwnProperty(viewName))
    PopoverNavigation.registeredViews[viewName] = ref;
}

PopoverNavigation.defaultProps = {
  preferedWidth: 380
}

PopoverNavigation.propTypes = {
  arrowSize: PropTypes.objectOf(PropTypes.number),
  placement: PropTypes.oneOf([Popover.PLACEMENT_OPTIONS.LEFT, Popover.PLACEMENT_OPTIONS.RIGHT, Popover.PLACEMENT_OPTIONS.TOP, Popover.PLACEMENT_OPTIONS.BOTTOM, Popover.PLACEMENT_OPTIONS.AUTO]),
  showInModal: PropTypes.bool,
  layoutRtl: PropTypes.bool,
  showArrow: PropTypes.bool,
  showBackground: PropTypes.bool,
  preferedWidth: PropTypes.number,
  preferedHeight: PropTypes.number,
  displayArea: PropTypes.objectOf(PropTypes.number),
}
