import { Dimensions, Platform, StyleSheet } from 'react-native';
import { Size } from './Types';

export const MULTIPLE_POPOVER_WARNING = `Popover Warning - Can't Show - Attempted to show a Popover while another one was already showing.  You can only show one Popover at a time, and must wait for one to close completely before showing a different one.  You can use the onCloseComplete prop to detect when a Popover has finished closing.  To show multiple Popovers simultaneously, all but one should have mode={Popover.MODE.JS_MODAL}.  Once you change the mode, you can show as many Popovers as you want, but you are responsible for keeping them above other views.`;

export const DEFAULT_ARROW_SIZE = new Size(16, 8);
export const DEFAULT_BORDER_RADIUS = 3;
export const POPOVER_MARGIN = 10;

export const DEBUG = false;
export const isIOS = Platform.OS === 'ios';
export const isWeb = Platform.OS === 'web';

/*
 * FIX_SHIFT resolves an issue with useNativeDriver, where it would flash the
 * popover on and off really quickly, and then animate in normally. Now, because
 * of the shift, the flash happens off screen, and then it is shifted on screen
 * just before beginning the actual animation.
 */
export const FIX_SHIFT = isWeb
  ? 0
  : Dimensions.get('window').height * 2;

export const styles = StyleSheet.create({
  container: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    position: 'absolute',
    backgroundColor: 'transparent'
  },
  background: {
    top: 0,
    bottom: FIX_SHIFT,
    left: 0,
    right: 0,
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  popoverContent: {
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: 'white',
    borderBottomColor: '#333438',
    borderRadius: DEFAULT_BORDER_RADIUS
  }
});
