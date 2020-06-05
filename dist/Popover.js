'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import SafeAreaView from 'react-native-safe-area-view';
import { Platform, Dimensions, Animated, TouchableWithoutFeedback, View, Modal, Keyboard, Easing, StyleSheet, I18nManager } from 'react-native';
import { Rect, Point, Size, waitForNewRect, waitForChange, getRectForRef } from './Utility';
var noop = function () { };
var DEFAULT_ARROW_SIZE = new Size(16, 8);
var DEFAULT_BORDER_RADIUS = 3;
var FIX_SHIFT = Dimensions.get('window').height * 2;
var isIOS = Platform.OS === 'ios';
var DEBUG = false;
var MULTIPLE_POPOVER_WARNING = "Popover Warning - Can't Show - Attempted to show a Popover while another one was already showing.  You can only show one Popover at a time, and must wait for one to close completely before showing a different one.  You can use the onCloseComplete prop to detect when a Popover has finished closing.  To show multiple Popovers simultaneously, all but one should have mode={Popover.MODE.JS_MODAL}.  Once you change the mode, you can show as many Popovers as you want, but you are responsible for keeping them above other views.";
export var PLACEMENT_OPTIONS;
(function (PLACEMENT_OPTIONS) {
    PLACEMENT_OPTIONS["TOP"] = "top";
    PLACEMENT_OPTIONS["RIGHT"] = "right";
    PLACEMENT_OPTIONS["BOTTOM"] = "bottom";
    PLACEMENT_OPTIONS["LEFT"] = "left";
    PLACEMENT_OPTIONS["AUTO"] = "auto";
    PLACEMENT_OPTIONS["CENTER"] = "center";
})(PLACEMENT_OPTIONS || (PLACEMENT_OPTIONS = {}));
export var POPOVER_MODE;
(function (POPOVER_MODE) {
    POPOVER_MODE["JS_MODAL"] = "js-modal";
    POPOVER_MODE["RN_MODAL"] = "rn-modal";
    POPOVER_MODE["TOOLTIP"] = "tooltip";
})(POPOVER_MODE || (POPOVER_MODE = {}));
var Popover = /** @class */ (function (_super) {
    __extends(Popover, _super);
    function Popover() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            requestedContentSize: null,
            forcedContentSize: null,
            viewLargerThanDisplayArea: {
                width: false,
                height: false
            },
            anchorPoint: new Point(0, 0),
            popoverOrigin: new Point(0, 0),
            forcedHeight: null,
            shiftedDisplayArea: null,
            defaultDisplayArea: null,
            displayAreaOffset: null,
            placement: PLACEMENT_OPTIONS.AUTO,
            isAwaitingShow: true,
            visible: false,
            showing: false,
            fromRect: null,
            animatedValues: {
                scale: new Animated.Value(0),
                translate: new Animated.ValueXY(),
                fade: new Animated.Value(0),
                translateArrow: new Animated.ValueXY()
            }
        };
        _this.skipNextDefaultDisplayArea = false;
        _this.waitForResizeToFinish = false;
        _this._isMounted = false;
        _this.updateCount = 0;
        _this.animating = false;
        _this.animateOutAfterShow = false;
        _this.containerRef = React.createRef();
        _this.popoverRef = React.createRef();
        // First thing called when device rotates
        _this.handleResizeEvent = function (change) {
            _this.debug("handleResizeEvent - New Dimensions", change);
            if (_this.props.isVisible) {
                _this.waitForResizeToFinish = true;
            }
        };
        return _this;
    }
    Popover.prototype.debug = function (line, obj) {
        if (DEBUG || this.props.debug)
            console.log(line + (obj ? ": " + JSON.stringify(obj) : ''));
    };
    Popover.prototype.getDisplayAreaOffset = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rect;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.props.mode !== POPOVER_MODE.RN_MODAL)) return [3 /*break*/, 2];
                        return [4 /*yield*/, getRectForRef(this.containerRef)];
                    case 1:
                        rect = _a.sent();
                        return [2 /*return*/, new Point(rect.x, rect.y + FIX_SHIFT)];
                    case 2: return [2 /*return*/, new Point(0, 0)];
                }
            });
        });
    };
    Popover.prototype.setDefaultDisplayArea = function (newDisplayArea) {
        var _this = this;
        var _a = this.state, fromRect = _a.fromRect, defaultDisplayArea = _a.defaultDisplayArea;
        // When the popover is closing and the display area's onLayout event is called, the width/height values may be zero
        // which causes a bad display area for the first mount when the popover re-opens
        var isValidDisplayArea = newDisplayArea.width > 0 && newDisplayArea.height > 0;
        if ((!defaultDisplayArea || !Rect.equals(defaultDisplayArea, newDisplayArea)) && isValidDisplayArea) {
            this.debug("setDefaultDisplayArea - newDisplayArea", newDisplayArea);
            if (!this.skipNextDefaultDisplayArea) {
                this.getDisplayAreaOffset().then(function (displayAreaOffset) {
                    _this.debug("setDefaultDisplayArea - displayAreaOffset", displayAreaOffset);
                    _this.setState({ defaultDisplayArea: newDisplayArea, displayAreaOffset: displayAreaOffset }, function () {
                        _this.calculateRect().then(function (newFromRect) {
                            _this.debug("setDefaultDisplayArea (inside calculateRect callback) - fromRect", newFromRect);
                            _this.debug("setDefaultDisplayArea (inside calculateRect callback) - getDisplayArea()", _this.getDisplayArea());
                            _this.debug("setDefaultDisplayArea (inside calculateRect callback) - displayAreaStore", _this.displayAreaStore);
                            if (((!fromRect && !!newFromRect) ||
                                (!!fromRect && !newFromRect) ||
                                (newFromRect && fromRect && !Rect.equals(newFromRect, fromRect))) ||
                                (!_this.displayAreaStore || !Rect.equals(_this.getDisplayArea(), _this.displayAreaStore))) {
                                _this.displayAreaStore = _this.getDisplayArea();
                                if (_this.state.visible && !_this.state.isAwaitingShow) {
                                    _this.debug("setDefaultDisplayArea (inside calculateRect callback) - Triggering state update");
                                    _this.setState({ fromRect: newFromRect }, function () {
                                        _this.handleGeomChange();
                                        _this.waitForResizeToFinish = false;
                                    });
                                }
                            }
                        });
                    });
                });
            }
            if (this.skipNextDefaultDisplayArea)
                this.debug("setDefaultDisplayArea - Skipping first because isLandscape");
            this.skipNextDefaultDisplayArea = false;
        }
    };
    Popover.prototype.keyboardDidShow = function (e) {
        this.debug("keyboardDidShow - keyboard height: " + e.endCoordinates.height);
        this.shiftForKeyboard(e.endCoordinates.height);
    };
    Popover.prototype.keyboardDidHide = function () {
        var _this = this;
        this.debug("keyboardDidHide");
        // On android, the keyboard update causes a default display area change, so no need to manually trigger
        this.setState({ shiftedDisplayArea: null }, function () { return isIOS && _this.handleGeomChange(); });
    };
    Popover.prototype.shiftForKeyboard = function (keyboardHeight) {
        var _this = this;
        var displayArea = this.getDisplayArea();
        var absoluteVerticalCutoff = Dimensions.get('window').height - keyboardHeight - (isIOS ? 10 : 40);
        var combinedY = Math.min(displayArea.height + displayArea.y, absoluteVerticalCutoff);
        this.setState({ shiftedDisplayArea: {
                x: displayArea.x,
                y: displayArea.y,
                width: displayArea.width,
                height: combinedY - displayArea.y
            } }, function () { return _this.handleGeomChange(); });
    };
    Popover.prototype.componentDidMount = function () {
        var _this = this;
        // This is used so that when the device is rotating or the viewport is expanding for any other reason,
        //  we can suspend updates due to content changes until we are finished calculating the new display
        //  area and rect for the new viewport size
        // This makes the recalc on rotation much faster
        this.waitForResizeToFinish = false;
        // Show popover if isVisible is initially true
        if (this.props.isVisible) {
            if (!Popover.isShowingInModal) {
                var from_1 = this.props.from;
                setTimeout(function () { return _this.calculateRect().then(function (fromRect) { return (fromRect || !(from_1 && from_1.hasOwnProperty('current'))) && _this.setState({ fromRect: fromRect, isAwaitingShow: true, visible: true }); }); }, 0);
                if (this.props.mode === POPOVER_MODE.RN_MODAL)
                    Popover.isShowingInModal = true;
            }
            else {
                console.warn(MULTIPLE_POPOVER_WARNING);
            }
        }
        Dimensions.addEventListener('change', this.handleResizeEvent);
        this._isMounted = true;
    };
    Popover.prototype.componentWillUnmount = function () {
        this._isMounted = false;
        if (this.state.visible) {
            this.animateOut();
        }
        else {
            setTimeout(this.props.onCloseStart);
            setTimeout(this.props.onCloseComplete);
        }
        Dimensions.removeEventListener('change', this.handleResizeEvent);
    };
    Popover.prototype.measureContent = function (requestedContentSize) {
        var _this = this;
        if (!requestedContentSize.width)
            console.warn("Popover Warning - Can't Show - The Popover content has a width of 0, so there is nothing to present.");
        if (!requestedContentSize.height)
            console.warn("Popover Warning - Can't Show - The Popover content has a height of 0, so there is nothing to present.");
        if (this.waitForResizeToFinish)
            this.debug("measureContent - Waiting for resize to finish");
        var lastRequestedContentSize = this.state.requestedContentSize;
        if (requestedContentSize.width && requestedContentSize.height && !this.waitForResizeToFinish) {
            if (this.state.isAwaitingShow) {
                var from = this.props.from;
                if ((from && from.hasOwnProperty('current') && !this.state.fromRect) || !this.getDisplayArea()) {
                    this.debug("measureContent - Waiting " + (this.getDisplayArea() ? "for Rect" : "for Display Area") + " - requestedContentSize", requestedContentSize);
                    setTimeout(function () { return _this.measureContent(requestedContentSize); }, 100);
                }
                else {
                    this.debug("measureContent - Showing Popover - requestedContentSize", requestedContentSize);
                    var geom = this.computeGeometry({ requestedContentSize: requestedContentSize });
                    this.debug("measureContent - Showing Popover - geom", geom);
                    // If the view initially overflowed the display area, wait one more render cycle to test-render it within the display area to get
                    //  final calculations for popoverOrigin before show
                    if (geom.viewLargerThanDisplayArea.width || geom.viewLargerThanDisplayArea.height) {
                        this.debug("measureContent - Delaying showing popover because viewLargerThanDisplayArea");
                        this.setState(__assign(__assign({}, geom), { requestedContentSize: requestedContentSize }));
                    }
                    else {
                        // If showing in a modal, the onOpenStart callback will be called from the modal onShow callback
                        if (this.props.mode !== POPOVER_MODE.RN_MODAL)
                            setTimeout(this.props.onOpenStart);
                        this.debug("measureContent - Showing Popover - Animating In");
                        this.setState(__assign(__assign({}, geom), { requestedContentSize: requestedContentSize, isAwaitingShow: false }), function () { return _this.animateIn(); });
                    }
                }
            }
            else if (lastRequestedContentSize !== null && (requestedContentSize.width !== lastRequestedContentSize.width || requestedContentSize.height !== lastRequestedContentSize.height)) {
                // In the case of an animation within the popover that affects the popover size, this function will be called frequently throughout the duration
                //   of the animation.  This will continuously schedule and then cancel the timeout until the last time this is called when the animation is complete.
                // If this method is only called once, we are only introducing a 50ms lag into the process, so shouldn't be noticeable
                clearTimeout(this.measureContentTimeout);
                this.measureContentTimeout = setTimeout(function () {
                    _this.debug("measureContent - new requestedContentSize: " + JSON.stringify(requestedContentSize) + " (used to be " + JSON.stringify(_this.state.requestedContentSize) + ")");
                    _this.handleGeomChange(requestedContentSize);
                }, 50);
            }
        }
    };
    Popover.prototype.computeGeometry = function (_a) {
        var requestedContentSize = _a.requestedContentSize, placement = _a.placement, fromRect = _a.fromRect, displayArea = _a.displayArea;
        placement = placement || this.props.placement;
        if (!fromRect) {
            var currentFromRect = this.state.fromRect;
            if (this.props.from instanceof Rect)
                fromRect = this.props.from;
            else if (currentFromRect != null)
                fromRect = currentFromRect;
        }
        displayArea = displayArea || __assign({}, this.getDisplayArea());
        this.debug("computeGeometry - displayArea", displayArea);
        this.debug("computeGeometry - fromRect", fromRect);
        this.debug("computeGeometry - placement", placement.toString());
        var newGeom = null;
        if (fromRect && fromRect instanceof Rect) {
            //check to see if fromRect is outside of displayArea, and adjust if it is
            if (fromRect.x > displayArea.x + displayArea.width)
                fromRect.x = displayArea.x + displayArea.width;
            if (fromRect.y > displayArea.y + displayArea.height)
                fromRect.y = displayArea.y + displayArea.height;
            if (fromRect.x < 0)
                fromRect.x = -1 * fromRect.width;
            if (fromRect.y < 0)
                fromRect.y = -1 * fromRect.height;
            var options = {
                displayArea: displayArea,
                fromRect: fromRect,
                requestedContentSize: requestedContentSize
            };
            switch (placement) {
                case PLACEMENT_OPTIONS.TOP:
                    newGeom = this.computeTopGeometry(options);
                    break;
                case PLACEMENT_OPTIONS.BOTTOM:
                    newGeom = this.computeBottomGeometry(options);
                    break;
                case PLACEMENT_OPTIONS.LEFT:
                    newGeom = this.computeLeftGeometry(options);
                    break;
                case PLACEMENT_OPTIONS.RIGHT:
                    newGeom = this.computeRightGeometry(options);
                    break;
                case PLACEMENT_OPTIONS.CENTER:
                    newGeom = null;
                    break;
                default:
                    newGeom = this.computeAutoGeometry(options);
                    this.debug("computeGeometry - chosen auto geometry", newGeom);
            }
            // If the popover will be restricted and the view that the popover is showing from is sufficiently large, try to show the popover inside the view
            if (newGeom && (newGeom.viewLargerThanDisplayArea.width || newGeom.viewLargerThanDisplayArea.height)) {
                var fromRectHeightVisible = fromRect.y < displayArea.y
                    ? fromRect.height - (displayArea.y - fromRect.y)
                    : displayArea.y + displayArea.height - fromRect.y;
                if (fromRect.width > requestedContentSize.width && fromRectHeightVisible > requestedContentSize.height) {
                    var preferedX = Math.max(fromRect.x + 10, fromRect.x + (fromRect.width - requestedContentSize.width) / 2);
                    var preferedY = Math.max(fromRect.y + 10, fromRect.y + (fromRect.height - requestedContentSize.height) / 2);
                    var constrainedX = Math.max(preferedX, displayArea.x);
                    if (constrainedX + requestedContentSize.width > displayArea.x + displayArea.width)
                        constrainedX = displayArea.x + displayArea.width - requestedContentSize.width;
                    var constrainedY = Math.max(preferedY, displayArea.y);
                    if (constrainedY + requestedContentSize.height > displayArea.y + displayArea.height)
                        constrainedY = displayArea.y + displayArea.height - requestedContentSize.height;
                    var forcedContentSize = {
                        width: Math.min(fromRect.width - 20, displayArea.width),
                        height: Math.min(fromRect.height - 20, displayArea.height)
                    };
                    this.debug("computeGeometry - showing inside anchor");
                    newGeom = {
                        popoverOrigin: new Point(constrainedX, constrainedY),
                        anchorPoint: new Point(fromRect.x + (fromRect.width / 2), fromRect.y + (fromRect.height / 2)),
                        placement: PLACEMENT_OPTIONS.CENTER,
                        forcedContentSize: forcedContentSize,
                        viewLargerThanDisplayArea: {
                            width: requestedContentSize.width > forcedContentSize.width,
                            height: requestedContentSize.height > forcedContentSize.height
                        }
                    };
                }
                else if (placement === PLACEMENT_OPTIONS.AUTO) {
                    // If we can't fit inside or outside the fromRect, show the popover centered on the screen,
                    //  but only do this if they haven't asked for a specifc placement type
                    newGeom = null;
                }
            }
        }
        if (!newGeom) {
            var minY = displayArea.y;
            var minX = displayArea.x;
            var preferedY = (displayArea.height - requestedContentSize.height) / 2 + displayArea.y;
            var preferedX = (displayArea.width - requestedContentSize.width) / 2 + displayArea.x;
            this.debug("computeGeometry - showing centered on screen");
            newGeom = {
                popoverOrigin: new Point(Math.max(minX, preferedX), Math.max(minY, preferedY)),
                anchorPoint: new Point(displayArea.width / 2 + displayArea.x, displayArea.height / 2 + displayArea.y),
                placement: PLACEMENT_OPTIONS.CENTER,
                forcedContentSize: {
                    width: displayArea.width,
                    height: displayArea.height
                },
                viewLargerThanDisplayArea: {
                    width: preferedX < minX - 1,
                    height: preferedY < minY - 1
                }
            };
        }
        return newGeom;
    };
    Popover.prototype.computeTopGeometry = function (_a) {
        var displayArea = _a.displayArea, fromRect = _a.fromRect, requestedContentSize = _a.requestedContentSize;
        var minY = displayArea.y;
        var arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.TOP);
        var preferedY = fromRect.y - requestedContentSize.height - arrowSize.height;
        var forcedContentSize = {
            height: (fromRect.y - arrowSize.height - displayArea.y),
            width: displayArea.width
        };
        var viewLargerThanDisplayArea = {
            height: preferedY < minY - 1,
            width: requestedContentSize.width > displayArea.width + 1
        };
        var viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width;
        var maxX = displayArea.x + displayArea.width - viewWidth;
        var minX = displayArea.x;
        var preferedX = fromRect.x + (fromRect.width - viewWidth) / 2;
        var popoverOrigin = new Point(Math.min(maxX, Math.max(minX, preferedX)), Math.max(minY, preferedY));
        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y);
        // Make sure the arrow isn't cut off
        anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + this.getBorderRadius());
        anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - this.getBorderRadius());
        return {
            popoverOrigin: popoverOrigin,
            anchorPoint: anchorPoint,
            placement: PLACEMENT_OPTIONS.TOP,
            forcedContentSize: forcedContentSize,
            viewLargerThanDisplayArea: viewLargerThanDisplayArea
        };
    };
    Popover.prototype.computeBottomGeometry = function (_a) {
        var displayArea = _a.displayArea, fromRect = _a.fromRect, requestedContentSize = _a.requestedContentSize;
        var arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.BOTTOM);
        var preferedY = fromRect.y + fromRect.height + arrowSize.height;
        var forcedContentSize = {
            height: displayArea.y + displayArea.height - preferedY,
            width: displayArea.width
        };
        var viewLargerThanDisplayArea = {
            height: preferedY + requestedContentSize.height > displayArea.y + displayArea.height + 1,
            width: requestedContentSize.width > displayArea.width + 1
        };
        var viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width;
        var maxX = displayArea.x + displayArea.width - viewWidth;
        var minX = displayArea.x;
        var preferedX = fromRect.x + (fromRect.width - viewWidth) / 2;
        var popoverOrigin = new Point(Math.min(maxX, Math.max(minX, preferedX)), preferedY);
        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y + fromRect.height);
        // Make sure the arrow isn't cut off
        anchorPoint.x = Math.max(anchorPoint.x, arrowSize.width / 2 + this.getBorderRadius());
        anchorPoint.x = Math.min(anchorPoint.x, displayArea.x + displayArea.width - (arrowSize.width / 2) - this.getBorderRadius());
        return {
            popoverOrigin: popoverOrigin,
            anchorPoint: anchorPoint,
            placement: PLACEMENT_OPTIONS.BOTTOM,
            forcedContentSize: forcedContentSize,
            viewLargerThanDisplayArea: viewLargerThanDisplayArea
        };
    };
    Popover.prototype.getPolarity = function () {
        return I18nManager.isRTL ? -1 : 1;
    };
    Popover.prototype.computeLeftGeometry = function (_a) {
        var displayArea = _a.displayArea, fromRect = _a.fromRect, requestedContentSize = _a.requestedContentSize;
        var arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.LEFT);
        var forcedContentSize = {
            height: displayArea.height,
            width: fromRect.x - displayArea.x - arrowSize.width
        };
        var viewLargerThanDisplayArea = {
            height: requestedContentSize.height > displayArea.height + 1,
            width: requestedContentSize.width > fromRect.x - displayArea.x - arrowSize.width + 1
        };
        var viewWidth = viewLargerThanDisplayArea.width ? forcedContentSize.width : requestedContentSize.width;
        var viewHeight = viewLargerThanDisplayArea.height ? forcedContentSize.height : requestedContentSize.height;
        var preferedX = fromRect.x - viewWidth - arrowSize.width;
        var preferedY = fromRect.y + (fromRect.height - viewHeight) / 2;
        var minY = displayArea.y;
        var maxY = (displayArea.height - viewHeight) + displayArea.y;
        var popoverOrigin = new Point(preferedX, Math.min(Math.max(minY, preferedY), maxY));
        var anchorPoint = new Point(fromRect.x, fromRect.y + fromRect.height / 2.0);
        // Make sure the arrow isn't cut off
        anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + this.getBorderRadius());
        anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - this.getBorderRadius());
        return {
            popoverOrigin: popoverOrigin,
            anchorPoint: anchorPoint,
            placement: PLACEMENT_OPTIONS.LEFT,
            forcedContentSize: forcedContentSize,
            viewLargerThanDisplayArea: viewLargerThanDisplayArea
        };
    };
    Popover.prototype.computeRightGeometry = function (_a) {
        var displayArea = _a.displayArea, fromRect = _a.fromRect, requestedContentSize = _a.requestedContentSize;
        var arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.RIGHT);
        var horizontalSpace = displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width;
        var forcedContentSize = {
            height: displayArea.height,
            width: horizontalSpace
        };
        var viewLargerThanDisplayArea = {
            height: requestedContentSize.height > displayArea.height + 1,
            width: requestedContentSize.width > horizontalSpace + 1
        };
        var viewHeight = viewLargerThanDisplayArea.height ? forcedContentSize.height : requestedContentSize.height;
        var preferedX = fromRect.x + fromRect.width + arrowSize.width;
        var preferedY = fromRect.y + (fromRect.height - viewHeight) / 2;
        var minY = displayArea.y;
        var maxY = (displayArea.height - viewHeight) + displayArea.y;
        var popoverOrigin = new Point(preferedX, Math.min(Math.max(minY, preferedY), maxY));
        var anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + fromRect.height / 2.0);
        // Make sure the arrow isn't cut off
        anchorPoint.y = Math.max(anchorPoint.y, arrowSize.height / 2 + this.getBorderRadius());
        anchorPoint.y = Math.min(anchorPoint.y, displayArea.y + displayArea.height - (arrowSize.height / 2) - this.getBorderRadius());
        return {
            popoverOrigin: popoverOrigin,
            anchorPoint: anchorPoint,
            placement: PLACEMENT_OPTIONS.RIGHT,
            forcedContentSize: forcedContentSize,
            viewLargerThanDisplayArea: viewLargerThanDisplayArea
        };
    };
    Popover.prototype.computeAutoGeometry = function (_a) {
        var displayArea = _a.displayArea, requestedContentSize = _a.requestedContentSize, fromRect = _a.fromRect;
        // Keep same placement if possible (left/right)
        if (this.state.placement === PLACEMENT_OPTIONS.LEFT || this.state.placement === PLACEMENT_OPTIONS.RIGHT) {
            var geom = this.state.placement === PLACEMENT_OPTIONS.LEFT
                ? this.computeLeftGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea })
                : this.computeRightGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea });
            this.debug("computeAutoGeometry - Left/right tryping to keep same, geometry", geom);
            if (!geom.viewLargerThanDisplayArea.width)
                return geom;
        }
        // Keep same placement if possible (top/bottom)
        if (this.state.placement === PLACEMENT_OPTIONS.TOP || this.state.placement === PLACEMENT_OPTIONS.BOTTOM) {
            var geom = this.state.placement === PLACEMENT_OPTIONS.TOP
                ? this.computeTopGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea })
                : this.computeBottomGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea });
            this.debug("computeAutoGeometry - Top/bottom tryping to keep same, geometry", geom);
            if (!geom.viewLargerThanDisplayArea.height)
                return geom;
        }
        // Otherwise, find the place that can fit it best (try left/right but default to top/bottom as that will typically have more space
        var arrowSize = this.getArrowSize(PLACEMENT_OPTIONS.LEFT);
        // If it fits on left, choose left
        if (fromRect.x - displayArea.x - arrowSize.width >= requestedContentSize.width) { // We could fit it on the left side
            this.debug("computeAutoGeometry - could fit on left side");
            return this.computeLeftGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea });
        }
        // If it fits on right, choose right
        if (displayArea.x + displayArea.width - (fromRect.x + fromRect.width) - arrowSize.width >= requestedContentSize.width) { // We could fit it on the right side
            this.debug("computeAutoGeometry - could fit on right side");
            return this.computeRightGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea });
        }
        // We could fit it on the top or bottom, need to figure out which is better
        var topSpace = fromRect.y - displayArea.y;
        var bottomSpace = displayArea.y + displayArea.height - (fromRect.y + fromRect.height);
        this.debug("computeAutoGeometry - Top/bottom picking best, top space", topSpace);
        return (topSpace - 50) > bottomSpace ? this.computeTopGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea }) : this.computeBottomGeometry({ requestedContentSize: requestedContentSize, fromRect: fromRect, displayArea: displayArea });
    };
    Popover.prototype.getArrowSize = function (placement) {
        var width = StyleSheet.flatten(this.props.arrowStyle).width;
        if (typeof width !== "number")
            width = DEFAULT_ARROW_SIZE.width;
        var height = StyleSheet.flatten(this.props.arrowStyle).height;
        if (typeof height !== "number")
            height = DEFAULT_ARROW_SIZE.height;
        switch (placement) {
            case PLACEMENT_OPTIONS.LEFT:
            case PLACEMENT_OPTIONS.RIGHT:
                return new Size(height, width);
            default:
                return new Size(width, height);
        }
    };
    Popover.prototype.getArrowDynamicStyle = function () {
        var placement = this.state.placement;
        var _a = this.props, arrowStyle = _a.arrowStyle, popoverStyle = _a.popoverStyle;
        var _b = this.getCalculatedArrowDims(), width = _b.width, height = _b.height;
        var backgroundColor = StyleSheet.flatten(arrowStyle).backgroundColor || StyleSheet.flatten(popoverStyle).backgroundColor || styles.popoverContent.backgroundColor;
        var colors = {};
        switch (placement) {
            case PLACEMENT_OPTIONS.TOP:
                colors = { borderTopColor: backgroundColor };
                break;
            case PLACEMENT_OPTIONS.BOTTOM:
                colors = { borderBottomColor: backgroundColor };
                break;
            case PLACEMENT_OPTIONS.LEFT:
                colors = { borderLeftColor: backgroundColor };
                break;
            case PLACEMENT_OPTIONS.RIGHT:
                colors = { borderRightColor: backgroundColor };
                break;
            default:
        }
        // Create the arrow from a rectangle with the appropriate borderXWidth set
        // A rotation is then applied dependending on the placement
        // Also make it slightly bigger
        // to fix a visual artifact when the popover is animated with a scale
        return __assign({ width: width, height: height, borderTopWidth: height / 2, borderRightWidth: width / 2, borderBottomWidth: height / 2, borderLeftWidth: width / 2 }, colors);
    };
    Popover.prototype.getCalculatedArrowDims = function () {
        var placement = this.state.placement;
        var arrowSize = this.getArrowSize(placement);
        arrowSize.width += 2;
        arrowSize.height = arrowSize.height * 2 + 2;
        return arrowSize;
    };
    Popover.prototype.getBorderRadius = function () {
        if (StyleSheet.flatten(this.props.popoverStyle).borderRadius === 0)
            return 0;
        return StyleSheet.flatten(this.props.popoverStyle).borderRadius || DEFAULT_BORDER_RADIUS;
    };
    Popover.prototype.getArrowTranslateLocation = function (translatePoint) {
        if (translatePoint === void 0) { translatePoint = null; }
        var _a = this.state, anchorPoint = _a.anchorPoint, placement = _a.placement, forcedContentSize = _a.forcedContentSize, viewLargerThanDisplayArea = _a.viewLargerThanDisplayArea, requestedContentSize = _a.requestedContentSize;
        var _b = this.getCalculatedArrowDims(), arrowWidth = _b.width, arrowHeight = _b.height;
        var viewWidth = 0;
        if (viewLargerThanDisplayArea.width && forcedContentSize !== null && forcedContentSize.width)
            viewWidth = forcedContentSize.width;
        else if (requestedContentSize !== null && requestedContentSize.width)
            viewWidth = requestedContentSize.width;
        var viewHeight = 0;
        if (viewLargerThanDisplayArea.height && forcedContentSize !== null && forcedContentSize.height)
            viewHeight = forcedContentSize.height;
        else if (requestedContentSize !== null && requestedContentSize.height)
            viewHeight = requestedContentSize.height;
        var arrowX = anchorPoint.x - arrowWidth / 2;
        var arrowY = anchorPoint.y - arrowHeight / 2;
        // Ensuring that the arrow does not go outside the bounds of the content box during a move
        if (translatePoint) {
            if (placement === PLACEMENT_OPTIONS.LEFT || placement === PLACEMENT_OPTIONS.RIGHT) {
                if (translatePoint.y > (arrowY - this.getBorderRadius()))
                    arrowY = translatePoint.y + this.getBorderRadius();
                else if (viewHeight && translatePoint.y + viewHeight < arrowY + arrowHeight)
                    arrowY = translatePoint.y + viewHeight - arrowHeight - this.getBorderRadius();
            }
            else if (placement === PLACEMENT_OPTIONS.TOP || placement === PLACEMENT_OPTIONS.BOTTOM) {
                if (translatePoint.x > arrowX - this.getBorderRadius())
                    arrowX = translatePoint.x + this.getBorderRadius();
                else if (viewWidth && translatePoint.x + viewWidth < arrowX + arrowWidth)
                    arrowX = translatePoint.x + viewWidth - arrowWidth - this.getBorderRadius();
            }
        }
        return new Point(arrowX, (FIX_SHIFT * 2) /* Temp fix for useNativeDriver issue */ + arrowY);
    };
    Popover.prototype.getTranslateOrigin = function () {
        var _a = this.state, forcedContentSize = _a.forcedContentSize, viewLargerThanDisplayArea = _a.viewLargerThanDisplayArea, requestedContentSize = _a.requestedContentSize, popoverOrigin = _a.popoverOrigin, anchorPoint = _a.anchorPoint;
        var viewWidth = 0;
        if (viewLargerThanDisplayArea.width && forcedContentSize !== null && forcedContentSize.width)
            viewWidth = forcedContentSize.width;
        else if (requestedContentSize !== null && requestedContentSize.width)
            viewWidth = requestedContentSize.width;
        var viewHeight = 0;
        if (viewLargerThanDisplayArea.height && forcedContentSize !== null && forcedContentSize.height)
            viewHeight = forcedContentSize.height;
        else if (requestedContentSize !== null && requestedContentSize.height)
            viewHeight = requestedContentSize.height;
        var popoverCenter = new Point(popoverOrigin.x + (viewWidth / 2), popoverOrigin.y + (viewHeight / 2));
        var shiftHorizantal = anchorPoint.x - popoverCenter.x;
        var shiftVertical = anchorPoint.y - popoverCenter.y;
        this.debug("getTranslateOrigin - popoverOrigin", popoverOrigin);
        this.debug("getTranslateOrigin - popoverSize", { width: viewWidth, height: viewWidth });
        this.debug("getTranslateOrigin - anchorPoint", anchorPoint);
        this.debug("getTranslateOrigin - shift", { hoizontal: shiftHorizantal, vertical: shiftVertical });
        return new Point(popoverOrigin.x + shiftHorizantal, popoverOrigin.y + shiftVertical);
    };
    Popover.prototype.getDisplayArea = function () {
        return this.state.shiftedDisplayArea || this.props.displayArea || this.state.defaultDisplayArea || new Rect(10, 10, Dimensions.get('window').width - 20, Dimensions.get('window').height - 20);
    };
    Popover.prototype.componentDidUpdate = function (prevProps) {
        var _this = this;
        // Make sure a value we care about has actually changed
        var importantProps = ["isVisible", "fromRect", "displayArea", "verticalOffset", "placement"];
        if (!importantProps.reduce(function (acc, key) { return acc || _this.props[key] !== prevProps[key]; }, false))
            return;
        if (this.props.isVisible !== prevProps.isVisible) {
            if (this.props.isVisible) {
                this.debug("componentDidUpdate - isVisible changed, now true");
                // We want to start the show animation only when contentSize is known
                // so that we can have some logic depending on the geometry
                if (!Popover.isShowingInModal) {
                    this.debug("componentDidUpdate - setting visible and awaiting calculations");
                    this.calculateRect().then(function (fromRect) { return _this.setState({ fromRect: fromRect, isAwaitingShow: true, visible: true }); });
                    if (this.props.mode === POPOVER_MODE.RN_MODAL)
                        Popover.isShowingInModal = true;
                }
                else {
                    console.warn(MULTIPLE_POPOVER_WARNING);
                }
            }
            else {
                this.debug("componentDidUpdate - isVisible changed, now false");
                if (this.state.visible) {
                    if (this.state.showing)
                        this.animateOut();
                    else
                        this.animateOutAfterShow = true;
                    this.debug("componentDidUpdate - Hiding popover");
                }
                else {
                    setTimeout(this.props.onCloseStart);
                    setTimeout(this.props.onCloseComplete);
                    this.debug("componentDidUpdate - Popover never shown");
                }
            }
        }
        else if (this.props.isVisible && prevProps.isVisible) {
            this.calculateRect().then(function (newFromRect) {
                var fromRect = _this.state.fromRect;
                var displayArea = _this.props.displayArea;
                if ((fromRect && newFromRect && !Rect.equals(newFromRect, fromRect))
                    || (_this.props.displayArea && !prevProps.displayArea)
                    || (displayArea && prevProps.displayArea && !Rect.equals(displayArea, prevProps.displayArea))
                    || (_this.displayAreaStore && !Rect.equals(_this.getDisplayArea(), _this.displayAreaStore))) {
                    _this.displayAreaStore = _this.getDisplayArea();
                    _this.setState({ fromRect: newFromRect }, function () { return _this.handleGeomChange(); });
                }
            });
        }
    };
    Popover.prototype.calculateRect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var displayAreaOffset, from, initialRect, displayArea, verticalOffset, horizontalOffset, rect;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        displayAreaOffset = this.state.displayAreaOffset;
                        from = this.props.from;
                        initialRect = this.state.fromRect || new Rect(0, 0, 0, 0);
                        displayArea = this.props.displayArea || this.getDisplayArea();
                        if (!from)
                            return [2 /*return*/, null];
                        if (this.props.from instanceof Rect) {
                            return [2 /*return*/, this.props.from];
                        }
                        if (!(from instanceof Function)) return [3 /*break*/, 2];
                        return [4 /*yield*/, waitForChange(function () { return Promise.resolve(from(displayArea)); }, function () { return Promise.resolve(initialRect); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, from(displayArea)];
                    case 2:
                        if (!from.hasOwnProperty('curent')) return [3 /*break*/, 4];
                        verticalOffset = this.props.verticalOffset + (displayAreaOffset ? -1 * displayAreaOffset.y : 0);
                        horizontalOffset = displayAreaOffset ? -1 * displayAreaOffset.x : 0;
                        return [4 /*yield*/, waitForNewRect(this.props.from, initialRect)];
                    case 3:
                        rect = _a.sent();
                        return [2 /*return*/, new Rect(rect.x + horizontalOffset, rect.y + verticalOffset, rect.width, rect.height)];
                    case 4:
                        console.error('Popover "from" prop not a supported type');
                        return [2 /*return*/, null];
                }
            });
        });
    };
    Popover.prototype.handleGeomChange = function (requestedContentSize) {
        var _this = this;
        var _a = this.state, forcedContentSize = _a.forcedContentSize, popoverOrigin = _a.popoverOrigin, animatedValues = _a.animatedValues, lastRequestedContentSize = _a.requestedContentSize;
        if (!requestedContentSize) {
            if (lastRequestedContentSize)
                requestedContentSize = lastRequestedContentSize;
            else
                return;
        }
        this.debug("handleGeomChange - requestedContentSize: ", requestedContentSize);
        // handleGeomChange may be called more than one times before the first has a chance to finish,
        //  so we use updateCount to make sure that we only trigger an animation on the last one
        if (!this.updateCount || this.updateCount < 0)
            this.updateCount = 0;
        this.updateCount++;
        var geom = this.computeGeometry({ requestedContentSize: requestedContentSize });
        if (!Point.equals(geom.popoverOrigin, popoverOrigin) ||
            (!geom.forcedContentSize && forcedContentSize) ||
            (!forcedContentSize && geom.forcedContentSize) ||
            (geom.forcedContentSize && forcedContentSize && !Size.equals(geom.forcedContentSize, forcedContentSize))) {
            this.setState(__assign(__assign({}, geom), { requestedContentSize: requestedContentSize }), function () {
                if (_this.updateCount <= 1) {
                    _this.updateCount--;
                    var moveTo = new Point(geom.popoverOrigin.x, geom.popoverOrigin.y);
                    _this.debug("handleGeomChange - Triggering popover move to", moveTo);
                    _this.animateTo({
                        values: animatedValues,
                        fade: 1,
                        scale: 1,
                        translatePoint: moveTo,
                        easing: Easing.inOut(Easing.quad)
                    });
                }
            });
        }
    };
    Popover.prototype.animateOut = function () {
        var _this = this;
        setTimeout(this.props.onCloseStart);
        this.keyboardDidShowListener && this.keyboardDidShowListener.remove();
        this.keyboardDidHideListener && this.keyboardDidHideListener.remove();
        // Animation callback may or may not get called if animation is cut short, so calling this a bit early for safety
        if (this.props.mode === POPOVER_MODE.RN_MODAL)
            Popover.isShowingInModal = false;
        this.setState({ shiftedDisplayArea: null, showing: false });
        this.animateTo({
            values: this.state.animatedValues,
            fade: 0,
            scale: 0,
            translatePoint: this.getTranslateOrigin(),
            callback: function () {
                var onCloseComplete = function () {
                    // If showing in an RN modal, the onCloseComplete callback will be called from the Modal onDismiss callback (on iOS only)
                    if (_this.props.mode !== POPOVER_MODE.RN_MODAL || !isIOS)
                        _this.props.onCloseComplete();
                };
                if (_this._isMounted)
                    _this.setState({ visible: false, forcedContentSize: null }, onCloseComplete);
                else
                    onCloseComplete();
            },
            easing: Easing.inOut(Easing.quad)
        });
    };
    Popover.prototype.animateIn = function () {
        var _this = this;
        var values = this.state.animatedValues;
        this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow.bind(this));
        this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide.bind(this));
        this.displayAreaStore = this.getDisplayArea();
        // Should grow from anchor point
        var translateStart = this.getTranslateOrigin();
        translateStart.y += (FIX_SHIFT * 2); // Temp fix for useNativeDriver issue
        values.translate.setValue(translateStart);
        var translatePoint = new Point(this.state.popoverOrigin.x, this.state.popoverOrigin.y);
        values.translateArrow.setValue(this.getArrowTranslateLocation(translatePoint));
        this.animateTo({
            values: values,
            fade: 1,
            scale: 1,
            translatePoint: translatePoint,
            easing: Easing.out(Easing.elastic(1)),
            callback: function () {
                if (_this._isMounted) {
                    _this.setState({ showing: true });
                    if (_this.popoverRef)
                        setTimeout(function () { return getRectForRef(_this.popoverRef).then(function (rect) { return _this.debug("animateIn - onOpenComplete - Calculated Popover Rect", rect); }); });
                }
                setTimeout(_this.props.onOpenComplete);
                if (_this.animateOutAfterShow || !_this._isMounted) {
                    _this.animateOut();
                    _this.animateOutAfterShow = false;
                }
            }
        });
    };
    Popover.prototype.animateTo = function (args) {
        var _this = this;
        var fade = args.fade, translatePoint = args.translatePoint, scale = args.scale, callback = args.callback, easing = args.easing, values = args.values;
        var commonConfig = __assign({ duration: 300, easing: easing, useNativeDriver: true }, this.props.animationConfig);
        if (this.animating) {
            setTimeout(function () { return _this.animateTo(args); }, 100);
            return;
        }
        var newArrowLocation = this.getArrowTranslateLocation(translatePoint);
        translatePoint.y = translatePoint.y + (FIX_SHIFT * 2); // Temp fix for useNativeDriver issue
        if (!fade && fade !== 0) {
            console.log("Popover: Fade value is null");
            return;
        }
        if (!translatePoint) {
            console.log("Popover: Translate Point value is null");
            return;
        }
        if (!scale && scale !== 0) {
            console.log("Popover: Scale value is null");
            return;
        }
        this.animating = true;
        Animated.parallel([
            Animated.timing(values.fade, __assign(__assign({}, commonConfig), { toValue: fade })),
            Animated.timing(values.translate, __assign(__assign({}, commonConfig), { toValue: translatePoint })),
            Animated.timing(values.scale, __assign(__assign({}, commonConfig), { toValue: scale })),
            Animated.timing(values.translateArrow, __assign(__assign({}, commonConfig), { toValue: newArrowLocation }))
        ]).start(function () {
            _this.animating = false;
            if (callback)
                callback();
        });
    };
    Popover.prototype.render = function () {
        var _this = this;
        var _a = this.state, animatedValues = _a.animatedValues, forcedContentSize = _a.forcedContentSize, isAwaitingShow = _a.isAwaitingShow;
        var popoverStyle = this.props.popoverStyle;
        var _b = this.getCalculatedArrowDims(), arrowWidth = _b.width, arrowHeight = _b.height;
        var arrowScale = animatedValues.scale.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });
        var arrowViewStyle = __assign(__assign({ position: 'absolute', top: 0 }, (I18nManager.isRTL ? { right: 0 } : { left: 0 })), { width: arrowWidth, height: arrowHeight, transform: [
                { translateX: animatedValues.translateArrow.x },
                { translateY: animatedValues.translateArrow.y },
                { scale: arrowScale },
            ] });
        var arrowInnerStyle = [
            styles.arrow,
            this.getArrowDynamicStyle()
        ];
        // Temp fix for useNativeDriver issue
        var backgroundShift = animatedValues.fade.interpolate({
            inputRange: [0, 0.0001, 1],
            outputRange: [0, FIX_SHIFT, FIX_SHIFT]
        });
        var backgroundStyle = __assign(__assign(__assign({}, styles.background), { transform: [
                { translateY: backgroundShift }
            ] }), StyleSheet.flatten(this.props.backgroundStyle));
        var containerStyle = __assign(__assign({}, styles.container), { opacity: animatedValues.fade });
        var popoverViewStyle = __assign(__assign(__assign(__assign({ maxWidth: (forcedContentSize || { width: null }).width, maxHeight: (forcedContentSize || { height: null }).height, position: 'absolute' }, styles.dropShadow), styles.popoverContent), StyleSheet.flatten(popoverStyle)), { transform: [
                { translateX: animatedValues.translate.x },
                { translateY: animatedValues.translate.y },
                { scale: animatedValues.scale },
                { perspective: 1000 }
            ] });
        var contentView = (React.createElement(View, { pointerEvents: "box-none", style: [styles.container, { left: 0 }], ref: this.containerRef },
            React.createElement(SafeAreaView, { pointerEvents: "none", forceInset: this.props.safeAreaInsets, style: { position: 'absolute', top: FIX_SHIFT, left: 0, right: 0, bottom: 0 } },
                React.createElement(TouchableWithoutFeedback, { style: { flex: 1 }, onLayout: function (evt) { return _this.setDefaultDisplayArea(new Rect(evt.nativeEvent.layout.x + 10, evt.nativeEvent.layout.y + 10, evt.nativeEvent.layout.width - 20, evt.nativeEvent.layout.height - 20)); } },
                    React.createElement(View, { style: { flex: 1 } }))),
            React.createElement(Animated.View, { pointerEvents: "box-none", style: containerStyle },
                this.props.mode !== POPOVER_MODE.TOOLTIP && (React.createElement(TouchableWithoutFeedback, { onPress: this.props.onRequestClose },
                    React.createElement(Animated.View, { style: backgroundStyle }))),
                React.createElement(View, { pointerEvents: "box-none", style: { top: 0, left: 0 } },
                    React.createElement(Animated.View, { style: popoverViewStyle, ref: this.popoverRef, onLayout: function (evt) {
                            var layout = __assign({}, evt.nativeEvent.layout);
                            setTimeout(function () { return _this.measureContent(layout); }, 10);
                        } }, this.props.children),
                    !isAwaitingShow && this.state.placement !== PLACEMENT_OPTIONS.CENTER &&
                        React.createElement(Animated.View, { style: arrowViewStyle },
                            React.createElement(Animated.View, { style: arrowInnerStyle }))))));
        if (this.props.mode === POPOVER_MODE.RN_MODAL) {
            return (React.createElement(Modal, { transparent: true, supportedOrientations: ['portrait', 'portrait-upside-down', 'landscape'], hardwareAccelerated: true, visible: this.state.visible, statusBarTranslucent: this.props.statusBarTranslucent, onShow: this.props.onOpenStart, onDismiss: this.props.onCloseComplete, onRequestClose: this.props.onRequestClose }, contentView));
        }
        else if (this.state.visible) {
            return contentView;
        }
        else {
            return null;
        }
    };
    Popover.propTypes = {
        // display
        isVisible: PropTypes.bool,
        mode: PropTypes.oneOf([POPOVER_MODE.JS_MODAL, POPOVER_MODE.RN_MODAL, POPOVER_MODE.TOOLTIP]),
        // anchor
        from: PropTypes.oneOf([
            PropTypes.func,
            PropTypes.element,
            PropTypes.instanceOf(Rect),
            PropTypes.shape({ current: PropTypes.any }),
            PropTypes.exact({ x: PropTypes.number, y: PropTypes.number, width: PropTypes.number, height: PropTypes.number })
        ]),
        // config
        displayArea: PropTypes.oneOf([PropTypes.instanceOf(Rect), PropTypes.exact({ x: PropTypes.number, y: PropTypes.number, width: PropTypes.number, height: PropTypes.number })]),
        placement: PropTypes.oneOf([PLACEMENT_OPTIONS.LEFT, PLACEMENT_OPTIONS.RIGHT, PLACEMENT_OPTIONS.TOP, PLACEMENT_OPTIONS.BOTTOM, PLACEMENT_OPTIONS.AUTO, PLACEMENT_OPTIONS.CENTER]),
        animationConfig: PropTypes.object,
        verticalOffset: PropTypes.number,
        statusBarTranslucent: PropTypes.bool,
        safeAreaInsets: PropTypes.object,
        // style
        popoverStyle: PropTypes.object,
        arrowStyle: PropTypes.object,
        backgroundStyle: PropTypes.object,
        // lifecycle
        onOpenStart: PropTypes.func,
        onOpenComplete: PropTypes.func,
        onRequestClose: PropTypes.func,
        onCloseStart: PropTypes.func,
        onCloseComplete: PropTypes.func,
        debug: PropTypes.bool
    };
    Popover.defaultProps = {
        mode: POPOVER_MODE.RN_MODAL,
        placement: PLACEMENT_OPTIONS.AUTO,
        verticalOffset: 0,
        popoverStyle: {},
        arrowStyle: {},
        backgroundStyle: {},
        onOpenStart: noop,
        onOpenComplete: noop,
        onRequestClose: noop,
        onCloseStart: noop,
        onCloseComplete: noop,
        debug: false
    };
    Popover.isShowingInModal = false;
    return Popover;
}(Component));
export default Popover;
var styles = StyleSheet.create({
    container: {
        top: -1 * FIX_SHIFT,
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
    contentContainer: {
        flexDirection: 'column',
    },
    popoverContainer: {
        position: 'absolute',
        zIndex: 1000
    },
    popoverContent: {
        backgroundColor: 'white',
        borderBottomColor: '#333438',
        borderRadius: DEFAULT_BORDER_RADIUS,
        overflow: 'hidden'
    },
    selectContainer: {
        backgroundColor: '#f2f2f2',
        position: 'absolute'
    },
    dropShadow: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 2,
        shadowOpacity: 0.8
    },
    arrow: {
        position: 'absolute',
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent'
    }
});
//# sourceMappingURL=Popover.js.map