import { StringMapWrapper } from 'angular2/src/facade/collection';
import { global, isFunction, Math } from 'angular2/src/facade/lang';
import { provide } from 'angular2/src/core/di';
import { createTestInjectorWithRuntimeCompiler, FunctionWithParamTokens } from './test_injector';
import { browserDetection } from './utils';
export { inject } from './test_injector';
export { expect } from './matchers';
export var proxy = (t) => t;
var _global = (typeof window === 'undefined' ? global : window);
export var afterEach = _global.afterEach;
export class AsyncTestCompleter {
    constructor(_done) {
        this._done = _done;
    }
    done() { this._done(); }
}
var jsmBeforeEach = _global.beforeEach;
var jsmDescribe = _global.describe;
var jsmDDescribe = _global.fdescribe;
var jsmXDescribe = _global.xdescribe;
var jsmIt = _global.it;
var jsmIIt = _global.fit;
var jsmXIt = _global.xit;
var runnerStack = [];
var inIt = false;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 500;
var globalTimeOut = browserDetection.isSlow ? 3000 : jasmine.DEFAULT_TIMEOUT_INTERVAL;
var testProviders;
/**
 * Mechanism to run `beforeEach()` functions of Angular tests.
 *
 * Note: Jasmine own `beforeEach` is used by this library to handle DI providers.
 */
class BeforeEachRunner {
    constructor(_parent) {
        this._parent = _parent;
        this._fns = [];
    }
    beforeEach(fn) { this._fns.push(fn); }
    run(injector) {
        if (this._parent)
            this._parent.run(injector);
        this._fns.forEach((fn) => {
            return isFunction(fn) ? fn() : fn.execute(injector);
        });
    }
}
// Reset the test providers before each test
jsmBeforeEach(() => { testProviders = []; });
function _describe(jsmFn, ...args) {
    var parentRunner = runnerStack.length === 0 ? null : runnerStack[runnerStack.length - 1];
    var runner = new BeforeEachRunner(parentRunner);
    runnerStack.push(runner);
    var suite = jsmFn(...args);
    runnerStack.pop();
    return suite;
}
export function describe(...args) {
    return _describe(jsmDescribe, ...args);
}
export function ddescribe(...args) {
    return _describe(jsmDDescribe, ...args);
}
export function xdescribe(...args) {
    return _describe(jsmXDescribe, ...args);
}
export function beforeEach(fn) {
    if (runnerStack.length > 0) {
        // Inside a describe block, beforeEach() uses a BeforeEachRunner
        runnerStack[runnerStack.length - 1].beforeEach(fn);
    }
    else {
        // Top level beforeEach() are delegated to jasmine
        jsmBeforeEach(fn);
    }
}
/**
 * Allows overriding default providers defined in test_injector.js.
 *
 * The given function must return a list of DI providers.
 *
 * Example:
 *
 *   beforeEachProviders(() => [
 *     provide(Compiler, {useClass: MockCompiler}),
 *     provide(SomeToken, {useValue: myValue}),
 *   ]);
 */
export function beforeEachProviders(fn) {
    jsmBeforeEach(() => {
        var providers = fn();
        if (!providers)
            return;
        testProviders = [...testProviders, ...providers];
    });
}
/**
 * @deprecated
 */
export function beforeEachBindings(fn) {
    beforeEachProviders(fn);
}
function _it(jsmFn, name, testFn, testTimeOut) {
    var runner = runnerStack[runnerStack.length - 1];
    var timeOut = Math.max(globalTimeOut, testTimeOut);
    if (testFn instanceof FunctionWithParamTokens) {
        // The test case uses inject(). ie `it('test', inject([AsyncTestCompleter], (async) => { ...
        // }));`
        if (testFn.hasToken(AsyncTestCompleter)) {
            jsmFn(name, (done) => {
                var completerProvider = provide(AsyncTestCompleter, {
                    useFactory: () => {
                        // Mark the test as async when an AsyncTestCompleter is injected in an it()
                        if (!inIt)
                            throw new Error('AsyncTestCompleter can only be injected in an "it()"');
                        return new AsyncTestCompleter(done);
                    }
                });
                var injector = createTestInjectorWithRuntimeCompiler([...testProviders, completerProvider]);
                runner.run(injector);
                inIt = true;
                testFn.execute(injector);
                inIt = false;
            }, timeOut);
        }
        else {
            jsmFn(name, () => {
                var injector = createTestInjectorWithRuntimeCompiler(testProviders);
                runner.run(injector);
                testFn.execute(injector);
            }, timeOut);
        }
    }
    else {
        // The test case doesn't use inject(). ie `it('test', (done) => { ... }));`
        if (testFn.length === 0) {
            jsmFn(name, () => {
                var injector = createTestInjectorWithRuntimeCompiler(testProviders);
                runner.run(injector);
                testFn();
            }, timeOut);
        }
        else {
            jsmFn(name, (done) => {
                var injector = createTestInjectorWithRuntimeCompiler(testProviders);
                runner.run(injector);
                testFn(done);
            }, timeOut);
        }
    }
}
export function it(name, fn, timeOut = null) {
    return _it(jsmIt, name, fn, timeOut);
}
export function xit(name, fn, timeOut = null) {
    return _it(jsmXIt, name, fn, timeOut);
}
export function iit(name, fn, timeOut = null) {
    return _it(jsmIIt, name, fn, timeOut);
}
export class SpyObject {
    constructor(type = null) {
        if (type) {
            for (var prop in type.prototype) {
                var m = null;
                try {
                    m = type.prototype[prop];
                }
                catch (e) {
                }
                if (typeof m === 'function') {
                    this.spy(prop);
                }
            }
        }
    }
    // Noop so that SpyObject has the same interface as in Dart
    noSuchMethod(args) { }
    spy(name) {
        if (!this[name]) {
            this[name] = this._createGuinnessCompatibleSpy(name);
        }
        return this[name];
    }
    prop(name, value) { this[name] = value; }
    static stub(object = null, config = null, overrides = null) {
        if (!(object instanceof SpyObject)) {
            overrides = config;
            config = object;
            object = new SpyObject();
        }
        var m = StringMapWrapper.merge(config, overrides);
        StringMapWrapper.forEach(m, (value, key) => { object.spy(key).andReturn(value); });
        return object;
    }
    /** @internal */
    _createGuinnessCompatibleSpy(name) {
        var newSpy = jasmine.createSpy(name);
        newSpy.andCallFake = newSpy.and.callFake;
        newSpy.andReturn = newSpy.and.returnValue;
        newSpy.reset = newSpy.calls.reset;
        // revisit return null here (previously needed for rtts_assert).
        newSpy.and.returnValue(null);
        return newSpy;
    }
}
export function isInInnerZone() {
    return global.zone._innerZone === true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZ19pbnRlcm5hbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFuZ3VsYXIyL3NyYy90ZXN0aW5nL3Rlc3RpbmdfaW50ZXJuYWwudHMiXSwibmFtZXMiOlsiQXN5bmNUZXN0Q29tcGxldGVyIiwiQXN5bmNUZXN0Q29tcGxldGVyLmNvbnN0cnVjdG9yIiwiQXN5bmNUZXN0Q29tcGxldGVyLmRvbmUiLCJCZWZvcmVFYWNoUnVubmVyIiwiQmVmb3JlRWFjaFJ1bm5lci5jb25zdHJ1Y3RvciIsIkJlZm9yZUVhY2hSdW5uZXIuYmVmb3JlRWFjaCIsIkJlZm9yZUVhY2hSdW5uZXIucnVuIiwiX2Rlc2NyaWJlIiwiZGVzY3JpYmUiLCJkZGVzY3JpYmUiLCJ4ZGVzY3JpYmUiLCJiZWZvcmVFYWNoIiwiYmVmb3JlRWFjaFByb3ZpZGVycyIsImJlZm9yZUVhY2hCaW5kaW5ncyIsIl9pdCIsIml0IiwieGl0IiwiaWl0IiwiU3B5T2JqZWN0IiwiU3B5T2JqZWN0LmNvbnN0cnVjdG9yIiwiU3B5T2JqZWN0Lm5vU3VjaE1ldGhvZCIsIlNweU9iamVjdC5zcHkiLCJTcHlPYmplY3QucHJvcCIsIlNweU9iamVjdC5zdHViIiwiU3B5T2JqZWN0Ll9jcmVhdGVHdWlubmVzc0NvbXBhdGlibGVTcHkiLCJpc0luSW5uZXJab25lIl0sIm1hcHBpbmdzIjoiT0FDTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sZ0NBQWdDO09BQ3hELEVBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsTUFBTSwwQkFBMEI7T0FHMUQsRUFBQyxPQUFPLEVBQUMsTUFBTSxzQkFBc0I7T0FFckMsRUFDTCxxQ0FBcUMsRUFDckMsdUJBQXVCLEVBRXhCLE1BQU0saUJBQWlCO09BQ2pCLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxTQUFTO0FBRXhDLFNBQVEsTUFBTSxRQUFPLGlCQUFpQixDQUFDO0FBRXZDLFNBQVEsTUFBTSxRQUFtQixZQUFZLENBQUM7QUFFOUMsV0FBVyxLQUFLLEdBQW1C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QSxJQUFJQSxDQUFDQSxHQUFHQSxnQkFBZ0JBLENBQUNBLEtBQUtBLENBQUNBLE1BQU1BLEVBQUVBLFNBQVNBLENBQUNBLENBQUNBO1FBQ2xEQSxnQkFBZ0JBLENBQUNBLE9BQU9BLENBQUNBLENBQUNBLEVBQUVBLENBQUNBLEtBQUtBLEVBQUVBLEdBQUdBLE9BQU9BLE1BQU1BLENBQUNBLEdBQUdBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ25GQSxNQUFNQSxDQUFDQSxNQUFNQSxDQUFDQTtJQUNoQkEsQ0FBQ0E7SUFFREwsZ0JBQWdCQTtJQUNoQkEsNEJBQTRCQSxDQUFDQSxJQUFJQTtRQUMvQk0sSUFBSUEsTUFBTUEsR0FBOEJBLE9BQU9BLENBQUNBLFNBQVNBLENBQUNBLElBQUlBLENBQUNBLENBQUNBO1FBQ2hFQSxNQUFNQSxDQUFDQSxXQUFXQSxHQUFRQSxNQUFNQSxDQUFDQSxHQUFHQSxDQUFDQSxRQUFRQSxDQUFDQTtRQUM5Q0EsTUFBTUEsQ0FBQ0EsU0FBU0EsR0FBUUEsTUFBTUEsQ0FBQ0EsR0FBR0EsQ0FBQ0EsV0FBV0EsQ0FBQ0E7UUFDL0NBLE1BQU1BLENBQUNBLEtBQUtBLEdBQVFBLE1BQU1BLENBQUNBLEtBQUtBLENBQUNBLEtBQUtBLENBQUNBO1FBQ3ZDQSxnRUFBZ0VBO1FBQ2hFQSxNQUFNQSxDQUFDQSxHQUFHQSxDQUFDQSxXQUFXQSxDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUM3QkEsTUFBTUEsQ0FBQ0EsTUFBTUEsQ0FBQ0E7SUFDaEJBLENBQUNBO0FBQ0hOLENBQUNBO0FBRUQ7SUFDRU8sTUFBTUEsQ0FBY0EsTUFBTUEsQ0FBQ0EsSUFBS0EsQ0FBQ0EsVUFBVUEsS0FBS0EsSUFBSUEsQ0FBQ0E7QUFDdkRBLENBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtET019IGZyb20gJ2FuZ3VsYXIyL3NyYy9wbGF0Zm9ybS9kb20vZG9tX2FkYXB0ZXInO1xuaW1wb3J0IHtTdHJpbmdNYXBXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtnbG9iYWwsIGlzRnVuY3Rpb24sIE1hdGh9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvbGFuZyc7XG5pbXBvcnQge05nWm9uZVpvbmV9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL3pvbmUvbmdfem9uZSc7XG5cbmltcG9ydCB7cHJvdmlkZX0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvZGknO1xuXG5pbXBvcnQge1xuICBjcmVhdGVUZXN0SW5qZWN0b3JXaXRoUnVudGltZUNvbXBpbGVyLFxuICBGdW5jdGlvbldpdGhQYXJhbVRva2VucyxcbiAgaW5qZWN0XG59IGZyb20gJy4vdGVzdF9pbmplY3Rvcic7XG5pbXBvcnQge2Jyb3dzZXJEZXRlY3Rpb259IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQge2luamVjdH0gZnJvbSAnLi90ZXN0X2luamVjdG9yJztcblxuZXhwb3J0IHtleHBlY3QsIE5nTWF0Y2hlcnN9IGZyb20gJy4vbWF0Y2hlcnMnO1xuXG5leHBvcnQgdmFyIHByb3h5OiBDbGFzc0RlY29yYXRvciA9ICh0KSA9PiB0O1xuXG52YXIgX2dsb2JhbDogamFzbWluZS5HbG9iYWxQb2xsdXRlciA9IDxhbnk+KHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDogd2luZG93KTtcblxuZXhwb3J0IHZhciBhZnRlckVhY2g6IEZ1bmN0aW9uID0gX2dsb2JhbC5hZnRlckVhY2g7XG5cbmV4cG9ydCB0eXBlIFN5bmNUZXN0Rm4gPSAoKSA9PiB2b2lkO1xudHlwZSBBc3luY1Rlc3RGbiA9IChkb25lOiAoKSA9PiB2b2lkKSA9PiB2b2lkO1xudHlwZSBBbnlUZXN0Rm4gPSBTeW5jVGVzdEZuIHwgQXN5bmNUZXN0Rm47XG5cbmV4cG9ydCBjbGFzcyBBc3luY1Rlc3RDb21wbGV0ZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9kb25lOiBGdW5jdGlvbikge31cblxuICBkb25lKCk6IHZvaWQgeyB0aGlzLl9kb25lKCk7IH1cbn1cblxudmFyIGpzbUJlZm9yZUVhY2ggPSBfZ2xvYmFsLmJlZm9yZUVhY2g7XG52YXIganNtRGVzY3JpYmUgPSBfZ2xvYmFsLmRlc2NyaWJlO1xudmFyIGpzbUREZXNjcmliZSA9IF9nbG9iYWwuZmRlc2NyaWJlO1xudmFyIGpzbVhEZXNjcmliZSA9IF9nbG9iYWwueGRlc2NyaWJlO1xudmFyIGpzbUl0ID0gX2dsb2JhbC5pdDtcbnZhciBqc21JSXQgPSBfZ2xvYmFsLmZpdDtcbnZhciBqc21YSXQgPSBfZ2xvYmFsLnhpdDtcblxudmFyIHJ1bm5lclN0YWNrID0gW107XG52YXIgaW5JdCA9IGZhbHNlO1xuamFzbWluZS5ERUZBVUxUX1RJTUVPVVRfSU5URVJWQUwgPSA1MDA7XG52YXIgZ2xvYmFsVGltZU91dCA9IGJyb3dzZXJEZXRlY3Rpb24uaXNTbG93ID8gMzAwMCA6IGphc21pbmUuREVGQVVMVF9USU1FT1VUX0lOVEVSVkFMO1xuXG52YXIgdGVzdFByb3ZpZGVycztcblxuLyoqXG4gKiBNZWNoYW5pc20gdG8gcnVuIGBiZWZvcmVFYWNoKClgIGZ1bmN0aW9ucyBvZiBBbmd1bGFyIHRlc3RzLlxuICpcbiAqIE5vdGU6IEphc21pbmUgb3duIGBiZWZvcmVFYWNoYCBpcyB1c2VkIGJ5IHRoaXMgbGlicmFyeSB0byBoYW5kbGUgREkgcHJvdmlkZXJzLlxuICovXG5jbGFzcyBCZWZvcmVFYWNoUnVubmVyIHtcbiAgcHJpdmF0ZSBfZm5zOiBBcnJheTxGdW5jdGlvbldpdGhQYXJhbVRva2VucyB8IFN5bmNUZXN0Rm4+ID0gW107XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfcGFyZW50OiBCZWZvcmVFYWNoUnVubmVyKSB7fVxuXG4gIGJlZm9yZUVhY2goZm46IEZ1bmN0aW9uV2l0aFBhcmFtVG9rZW5zIHwgU3luY1Rlc3RGbik6IHZvaWQgeyB0aGlzLl9mbnMucHVzaChmbik7IH1cblxuICBydW4oaW5qZWN0b3IpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5fcGFyZW50KSB0aGlzLl9wYXJlbnQucnVuKGluamVjdG9yKTtcbiAgICB0aGlzLl9mbnMuZm9yRWFjaCgoZm4pID0+IHtcbiAgICAgIHJldHVybiBpc0Z1bmN0aW9uKGZuKSA/ICg8U3luY1Rlc3RGbj5mbikoKSA6ICg8RnVuY3Rpb25XaXRoUGFyYW1Ub2tlbnM+Zm4pLmV4ZWN1dGUoaW5qZWN0b3IpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFJlc2V0IHRoZSB0ZXN0IHByb3ZpZGVycyBiZWZvcmUgZWFjaCB0ZXN0XG5qc21CZWZvcmVFYWNoKCgpID0+IHsgdGVzdFByb3ZpZGVycyA9IFtdOyB9KTtcblxuZnVuY3Rpb24gX2Rlc2NyaWJlKGpzbUZuLCAuLi5hcmdzKSB7XG4gIHZhciBwYXJlbnRSdW5uZXIgPSBydW5uZXJTdGFjay5sZW5ndGggPT09IDAgPyBudWxsIDogcnVubmVyU3RhY2tbcnVubmVyU3RhY2subGVuZ3RoIC0gMV07XG4gIHZhciBydW5uZXIgPSBuZXcgQmVmb3JlRWFjaFJ1bm5lcihwYXJlbnRSdW5uZXIpO1xuICBydW5uZXJTdGFjay5wdXNoKHJ1bm5lcik7XG4gIHZhciBzdWl0ZSA9IGpzbUZuKC4uLmFyZ3MpO1xuICBydW5uZXJTdGFjay5wb3AoKTtcbiAgcmV0dXJuIHN1aXRlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVzY3JpYmUoLi4uYXJncyk6IHZvaWQge1xuICByZXR1cm4gX2Rlc2NyaWJlKGpzbURlc2NyaWJlLCAuLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRkZXNjcmliZSguLi5hcmdzKTogdm9pZCB7XG4gIHJldHVybiBfZGVzY3JpYmUoanNtRERlc2NyaWJlLCAuLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHhkZXNjcmliZSguLi5hcmdzKTogdm9pZCB7XG4gIHJldHVybiBfZGVzY3JpYmUoanNtWERlc2NyaWJlLCAuLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJlZm9yZUVhY2goZm46IEZ1bmN0aW9uV2l0aFBhcmFtVG9rZW5zIHwgU3luY1Rlc3RGbik6IHZvaWQge1xuICBpZiAocnVubmVyU3RhY2subGVuZ3RoID4gMCkge1xuICAgIC8vIEluc2lkZSBhIGRlc2NyaWJlIGJsb2NrLCBiZWZvcmVFYWNoKCkgdXNlcyBhIEJlZm9yZUVhY2hSdW5uZXJcbiAgICBydW5uZXJTdGFja1tydW5uZXJTdGFjay5sZW5ndGggLSAxXS5iZWZvcmVFYWNoKGZuKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUb3AgbGV2ZWwgYmVmb3JlRWFjaCgpIGFyZSBkZWxlZ2F0ZWQgdG8gamFzbWluZVxuICAgIGpzbUJlZm9yZUVhY2goPFN5bmNUZXN0Rm4+Zm4pO1xuICB9XG59XG5cbi8qKlxuICogQWxsb3dzIG92ZXJyaWRpbmcgZGVmYXVsdCBwcm92aWRlcnMgZGVmaW5lZCBpbiB0ZXN0X2luamVjdG9yLmpzLlxuICpcbiAqIFRoZSBnaXZlbiBmdW5jdGlvbiBtdXN0IHJldHVybiBhIGxpc3Qgb2YgREkgcHJvdmlkZXJzLlxuICpcbiAqIEV4YW1wbGU6XG4gKlxuICogICBiZWZvcmVFYWNoUHJvdmlkZXJzKCgpID0+IFtcbiAqICAgICBwcm92aWRlKENvbXBpbGVyLCB7dXNlQ2xhc3M6IE1vY2tDb21waWxlcn0pLFxuICogICAgIHByb3ZpZGUoU29tZVRva2VuLCB7dXNlVmFsdWU6IG15VmFsdWV9KSxcbiAqICAgXSk7XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiZWZvcmVFYWNoUHJvdmlkZXJzKGZuKTogdm9pZCB7XG4gIGpzbUJlZm9yZUVhY2goKCkgPT4ge1xuICAgIHZhciBwcm92aWRlcnMgPSBmbigpO1xuICAgIGlmICghcHJvdmlkZXJzKSByZXR1cm47XG4gICAgdGVzdFByb3ZpZGVycyA9IFsuLi50ZXN0UHJvdmlkZXJzLCAuLi5wcm92aWRlcnNdO1xuICB9KTtcbn1cblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gYmVmb3JlRWFjaEJpbmRpbmdzKGZuKTogdm9pZCB7XG4gIGJlZm9yZUVhY2hQcm92aWRlcnMoZm4pO1xufVxuXG5mdW5jdGlvbiBfaXQoanNtRm46IEZ1bmN0aW9uLCBuYW1lOiBzdHJpbmcsIHRlc3RGbjogRnVuY3Rpb25XaXRoUGFyYW1Ub2tlbnMgfCBBbnlUZXN0Rm4sXG4gICAgICAgICAgICAgdGVzdFRpbWVPdXQ6IG51bWJlcik6IHZvaWQge1xuICB2YXIgcnVubmVyID0gcnVubmVyU3RhY2tbcnVubmVyU3RhY2subGVuZ3RoIC0gMV07XG4gIHZhciB0aW1lT3V0ID0gTWF0aC5tYXgoZ2xvYmFsVGltZU91dCwgdGVzdFRpbWVPdXQpO1xuXG4gIGlmICh0ZXN0Rm4gaW5zdGFuY2VvZiBGdW5jdGlvbldpdGhQYXJhbVRva2Vucykge1xuICAgIC8vIFRoZSB0ZXN0IGNhc2UgdXNlcyBpbmplY3QoKS4gaWUgYGl0KCd0ZXN0JywgaW5qZWN0KFtBc3luY1Rlc3RDb21wbGV0ZXJdLCAoYXN5bmMpID0+IHsgLi4uXG4gICAgLy8gfSkpO2BcblxuICAgIGlmICh0ZXN0Rm4uaGFzVG9rZW4oQXN5bmNUZXN0Q29tcGxldGVyKSkge1xuICAgICAganNtRm4obmFtZSwgKGRvbmUpID0+IHtcbiAgICAgICAgdmFyIGNvbXBsZXRlclByb3ZpZGVyID0gcHJvdmlkZShBc3luY1Rlc3RDb21wbGV0ZXIsIHtcbiAgICAgICAgICB1c2VGYWN0b3J5OiAoKSA9PiB7XG4gICAgICAgICAgICAvLyBNYXJrIHRoZSB0ZXN0IGFzIGFzeW5jIHdoZW4gYW4gQXN5bmNUZXN0Q29tcGxldGVyIGlzIGluamVjdGVkIGluIGFuIGl0KClcbiAgICAgICAgICAgIGlmICghaW5JdCkgdGhyb3cgbmV3IEVycm9yKCdBc3luY1Rlc3RDb21wbGV0ZXIgY2FuIG9ubHkgYmUgaW5qZWN0ZWQgaW4gYW4gXCJpdCgpXCInKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQXN5bmNUZXN0Q29tcGxldGVyKGRvbmUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGluamVjdG9yID0gY3JlYXRlVGVzdEluamVjdG9yV2l0aFJ1bnRpbWVDb21waWxlcihbLi4udGVzdFByb3ZpZGVycywgY29tcGxldGVyUHJvdmlkZXJdKTtcbiAgICAgICAgcnVubmVyLnJ1bihpbmplY3Rvcik7XG5cbiAgICAgICAgaW5JdCA9IHRydWU7XG4gICAgICAgIHRlc3RGbi5leGVjdXRlKGluamVjdG9yKTtcbiAgICAgICAgaW5JdCA9IGZhbHNlO1xuICAgICAgfSwgdGltZU91dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGpzbUZuKG5hbWUsICgpID0+IHtcbiAgICAgICAgdmFyIGluamVjdG9yID0gY3JlYXRlVGVzdEluamVjdG9yV2l0aFJ1bnRpbWVDb21waWxlcih0ZXN0UHJvdmlkZXJzKTtcbiAgICAgICAgcnVubmVyLnJ1bihpbmplY3Rvcik7XG4gICAgICAgIHRlc3RGbi5leGVjdXRlKGluamVjdG9yKTtcbiAgICAgIH0sIHRpbWVPdXQpO1xuICAgIH1cblxuICB9IGVsc2Uge1xuICAgIC8vIFRoZSB0ZXN0IGNhc2UgZG9lc24ndCB1c2UgaW5qZWN0KCkuIGllIGBpdCgndGVzdCcsIChkb25lKSA9PiB7IC4uLiB9KSk7YFxuXG4gICAgaWYgKCg8YW55PnRlc3RGbikubGVuZ3RoID09PSAwKSB7XG4gICAgICBqc21GbihuYW1lLCAoKSA9PiB7XG4gICAgICAgIHZhciBpbmplY3RvciA9IGNyZWF0ZVRlc3RJbmplY3RvcldpdGhSdW50aW1lQ29tcGlsZXIodGVzdFByb3ZpZGVycyk7XG4gICAgICAgIHJ1bm5lci5ydW4oaW5qZWN0b3IpO1xuICAgICAgICAoPFN5bmNUZXN0Rm4+dGVzdEZuKSgpO1xuICAgICAgfSwgdGltZU91dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGpzbUZuKG5hbWUsIChkb25lKSA9PiB7XG4gICAgICAgIHZhciBpbmplY3RvciA9IGNyZWF0ZVRlc3RJbmplY3RvcldpdGhSdW50aW1lQ29tcGlsZXIodGVzdFByb3ZpZGVycyk7XG4gICAgICAgIHJ1bm5lci5ydW4oaW5qZWN0b3IpO1xuICAgICAgICAoPEFzeW5jVGVzdEZuPnRlc3RGbikoZG9uZSk7XG4gICAgICB9LCB0aW1lT3V0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGl0KG5hbWUsIGZuLCB0aW1lT3V0ID0gbnVsbCk6IHZvaWQge1xuICByZXR1cm4gX2l0KGpzbUl0LCBuYW1lLCBmbiwgdGltZU91dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB4aXQobmFtZSwgZm4sIHRpbWVPdXQgPSBudWxsKTogdm9pZCB7XG4gIHJldHVybiBfaXQoanNtWEl0LCBuYW1lLCBmbiwgdGltZU91dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpaXQobmFtZSwgZm4sIHRpbWVPdXQgPSBudWxsKTogdm9pZCB7XG4gIHJldHVybiBfaXQoanNtSUl0LCBuYW1lLCBmbiwgdGltZU91dCk7XG59XG5cblxuZXhwb3J0IGludGVyZmFjZSBHdWluZXNzQ29tcGF0aWJsZVNweSBleHRlbmRzIGphc21pbmUuU3B5IHtcbiAgLyoqIEJ5IGNoYWluaW5nIHRoZSBzcHkgd2l0aCBhbmQucmV0dXJuVmFsdWUsIGFsbCBjYWxscyB0byB0aGUgZnVuY3Rpb24gd2lsbCByZXR1cm4gYSBzcGVjaWZpY1xuICAgKiB2YWx1ZS4gKi9cbiAgYW5kUmV0dXJuKHZhbDogYW55KTogdm9pZDtcbiAgLyoqIEJ5IGNoYWluaW5nIHRoZSBzcHkgd2l0aCBhbmQuY2FsbEZha2UsIGFsbCBjYWxscyB0byB0aGUgc3B5IHdpbGwgZGVsZWdhdGUgdG8gdGhlIHN1cHBsaWVkXG4gICAqIGZ1bmN0aW9uLiAqL1xuICBhbmRDYWxsRmFrZShmbjogRnVuY3Rpb24pOiBHdWluZXNzQ29tcGF0aWJsZVNweTtcbiAgLyoqIHJlbW92ZXMgYWxsIHJlY29yZGVkIGNhbGxzICovXG4gIHJlc2V0KCk7XG59XG5cbmV4cG9ydCBjbGFzcyBTcHlPYmplY3Qge1xuICBjb25zdHJ1Y3Rvcih0eXBlID0gbnVsbCkge1xuICAgIGlmICh0eXBlKSB7XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGUucHJvdG90eXBlKSB7XG4gICAgICAgIHZhciBtID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtID0gdHlwZS5wcm90b3R5cGVbcHJvcF07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBBcyB3ZSBhcmUgY3JlYXRpbmcgc3B5cyBmb3IgYWJzdHJhY3QgY2xhc3NlcyxcbiAgICAgICAgICAvLyB0aGVzZSBjbGFzc2VzIG1pZ2h0IGhhdmUgZ2V0dGVycyB0aGF0IHRocm93IHdoZW4gdGhleSBhcmUgYWNjZXNzZWQuXG4gICAgICAgICAgLy8gQXMgd2UgYXJlIG9ubHkgYXV0byBjcmVhdGluZyBzcHlzIGZvciBtZXRob2RzLCB0aGlzXG4gICAgICAgICAgLy8gc2hvdWxkIG5vdCBtYXR0ZXIuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBtID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5zcHkocHJvcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy8gTm9vcCBzbyB0aGF0IFNweU9iamVjdCBoYXMgdGhlIHNhbWUgaW50ZXJmYWNlIGFzIGluIERhcnRcbiAgbm9TdWNoTWV0aG9kKGFyZ3MpIHt9XG5cbiAgc3B5KG5hbWUpIHtcbiAgICBpZiAoIXRoaXNbbmFtZV0pIHtcbiAgICAgIHRoaXNbbmFtZV0gPSB0aGlzLl9jcmVhdGVHdWlubmVzc0NvbXBhdGlibGVTcHkobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzW25hbWVdO1xuICB9XG5cbiAgcHJvcChuYW1lLCB2YWx1ZSkgeyB0aGlzW25hbWVdID0gdmFsdWU7IH1cblxuICBzdGF0aWMgc3R1YihvYmplY3QgPSBudWxsLCBjb25maWcgPSBudWxsLCBvdmVycmlkZXMgPSBudWxsKSB7XG4gICAgaWYgKCEob2JqZWN0IGluc3RhbmNlb2YgU3B5T2JqZWN0KSkge1xuICAgICAgb3ZlcnJpZGVzID0gY29uZmlnO1xuICAgICAgY29uZmlnID0gb2JqZWN0O1xuICAgICAgb2JqZWN0ID0gbmV3IFNweU9iamVjdCgpO1xuICAgIH1cblxuICAgIHZhciBtID0gU3RyaW5nTWFwV3JhcHBlci5tZXJnZShjb25maWcsIG92ZXJyaWRlcyk7XG4gICAgU3RyaW5nTWFwV3JhcHBlci5mb3JFYWNoKG0sICh2YWx1ZSwga2V5KSA9PiB7IG9iamVjdC5zcHkoa2V5KS5hbmRSZXR1cm4odmFsdWUpOyB9KTtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfY3JlYXRlR3Vpbm5lc3NDb21wYXRpYmxlU3B5KG5hbWUpOiBHdWluZXNzQ29tcGF0aWJsZVNweSB7XG4gICAgdmFyIG5ld1NweTogR3VpbmVzc0NvbXBhdGlibGVTcHkgPSA8YW55Pmphc21pbmUuY3JlYXRlU3B5KG5hbWUpO1xuICAgIG5ld1NweS5hbmRDYWxsRmFrZSA9IDxhbnk+bmV3U3B5LmFuZC5jYWxsRmFrZTtcbiAgICBuZXdTcHkuYW5kUmV0dXJuID0gPGFueT5uZXdTcHkuYW5kLnJldHVyblZhbHVlO1xuICAgIG5ld1NweS5yZXNldCA9IDxhbnk+bmV3U3B5LmNhbGxzLnJlc2V0O1xuICAgIC8vIHJldmlzaXQgcmV0dXJuIG51bGwgaGVyZSAocHJldmlvdXNseSBuZWVkZWQgZm9yIHJ0dHNfYXNzZXJ0KS5cbiAgICBuZXdTcHkuYW5kLnJldHVyblZhbHVlKG51bGwpO1xuICAgIHJldHVybiBuZXdTcHk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5Jbm5lclpvbmUoKTogYm9vbGVhbiB7XG4gIHJldHVybiAoPE5nWm9uZVpvbmU+Z2xvYmFsLnpvbmUpLl9pbm5lclpvbmUgPT09IHRydWU7XG59XG4iXX0=