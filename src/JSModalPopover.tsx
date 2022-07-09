import React, { Component, ReactNode, RefObject } from 'react';
import { View } from 'react-native';
import AdaptivePopover from './AdaptivePopover';
import { styles } from './Constants';
import { PopoverProps, Rect, ModalPopoverState, Point } from './Types';
import { getRectForRef } from './Utility';

interface JSModalPopoverProps extends PopoverProps {
  showBackground: boolean;
  fromRect?: Rect;
  fromRef?: RefObject<View>;
  displayArea?: Rect;
}

export default class JSModalPopover extends Component<JSModalPopoverProps, ModalPopoverState> {
  state = {
    visible: false
  }

  private containerRef = React.createRef<View>();

  componentDidMount(): void {
    if (this.props.isVisible) this.setState({ visible: true });
  }

  componentDidUpdate(prevProps: JSModalPopoverProps): void {
    if (this.props.isVisible && !prevProps.isVisible) this.setState({ visible: true });
  }

  render(): ReactNode {
    const { onCloseComplete } = this.props;
    const { visible } = this.state;

    if (visible) {
      return (
        <View
          pointerEvents="box-none"
          style={styles.container}
          ref={this.containerRef}>
          <AdaptivePopover
            {...this.props}
            onCloseComplete={() => {
              if (onCloseComplete) onCloseComplete();
              this.setState({ visible: false });
            }}
            getDisplayAreaOffset={async () => {
              const rect = await getRectForRef(this.containerRef);
              return new Point(rect.x, rect.y);
            }}
          />
        </View>
      );
    }

    return null;
  }
}
