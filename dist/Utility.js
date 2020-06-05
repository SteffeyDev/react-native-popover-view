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
import { NativeModules, findNodeHandle } from 'react-native';
var Point = /** @class */ (function () {
    function Point(x, y) {
        this.x = x;
        this.y = y;
    }
    Point.equals = function (a, b) {
        return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
    };
    return Point;
}());
export { Point };
var Size = /** @class */ (function () {
    function Size(width, height) {
        this.width = width;
        this.height = height;
    }
    Size.equals = function (a, b) {
        return (Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height));
    };
    return Size;
}());
export { Size };
var Rect = /** @class */ (function () {
    function Rect(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    Rect.equals = function (a, b) {
        return (Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height));
    };
    return Rect;
}());
export { Rect };
export function getRectForRef(ref) {
    return new Promise(function (resolve) {
        NativeModules.UIManager.measure(findNodeHandle(ref), function (_x, _y, width, height, x, y) {
            resolve(new Rect(x, y, width, height));
        });
    });
}
export function waitForChange(getFirst, getSecond) {
    return __awaiter(this, void 0, void 0, function () {
        var count, first, second;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    count = 0;
                    _a.label = 1;
                case 1: return [4 /*yield*/, getFirst()];
                case 2:
                    first = _a.sent();
                    return [4 /*yield*/, getSecond()];
                case 3:
                    second = _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                case 4:
                    _a.sent();
                    count++;
                    if (count++ > 20)
                        throw new Error();
                    _a.label = 5;
                case 5:
                    if (first !== second) return [3 /*break*/, 1];
                    _a.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
export function waitForNewRect(ref, initialRect) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitForChange(function () { return getRectForRef(ref); }, function () { return Promise.resolve(initialRect); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, getRectForRef(ref)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function sizeChanged(a, b) {
    if (!a || !b)
        return false;
    return (Math.round(a.width) !== Math.round(b.width) || Math.round(a.height) !== Math.round(b.height));
}
export function rectChanged(a, b) {
    if (!a || !b)
        return false;
    return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y) || Math.round(a.width) !== Math.round(b.width) || Math.round(a.height) !== Math.round(b.height));
}
export function pointChanged(a, b) {
    return (Math.round(a.x) !== Math.round(b.x) || Math.round(a.y) !== Math.round(b.y));
}
//# sourceMappingURL=Utility.js.map