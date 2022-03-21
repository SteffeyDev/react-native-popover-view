import React, { RefObject, Component, ReactNode } from 'react';
import { View, Modal } from 'react-native';
import AdaptivePopover from './AdaptivePopover';
import { MULTIPLE_POPOVER_WARNING } from './Constants';
import { PopoverProps, Rect, ModalPopoverState, Point } from './Types';

interface RNModalPopoverProps extends PopoverProps {
  statusBarTranslucent?: boolean
  fromRect?: Rect;
  fromRef?: RefObject<View>;
  displayArea?: Rect;
}

export default class RNModalPopover extends Component<RNModalPopoverProps, ModalPopoverState> {
  state = {
    visible: false
  }

  private static isShowingInModal = false;

  componentDidMount(): void {
    if (this.props.isVisible) {
      if (RNModalPopover.isShowingInModal) console.warn(MULTIPLE_POPOVER_WARNING);
      else this.setState({ visible: true });
    }
  }

  componentDidUpdate(prevProps: RNModalPopoverProps, prevState: ModalPopoverState): void {
    if (this.props.isVisible && !prevProps.isVisible) {
      if (RNModalPopover.isShowingInModal) console.warn(MULTIPLE_POPOVER_WARNING);
      else this.setState({ visible: true });
    }

    if (!this.state.visible && prevState.visible && this.props.onCloseComplete) {
      /*
       * Don't run this callback until after update, so that <Modal> is no longer active
       * Need to wait 50ms to make sure <Modal> is completely gone, in case
       * we want to show another popover immediately after
       */
      setTimeout(this.props.onCloseComplete, 50);
    }
  }

  render(): ReactNode {
    const {
      statusBarTranslucent,
      onCloseStart,
      onRequestClose
    } = this.props;
    const { visible } = this.state;

    return (
      <Modal
        transparent={true}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}
        hardwareAccelerated={true}
        visible={visible}
        statusBarTranslucent={statusBarTranslucent}
        onShow={() => {
          RNModalPopover.isShowingInModal = true;
        }}
        // Handles android back button
        onRequestClose={onRequestClose}>
        <AdaptivePopover
          {...this.props}
          onCloseStart={() => {
            RNModalPopover.isShowingInModal = false;
            if (onCloseStart) onCloseStart();
          }}
          onCloseComplete={() => this.setState({ visible: false })}
          getDisplayAreaOffset={() => Promise.resolve(new Point(0, 0))}
        />
      </Modal>
    );
  }
}
