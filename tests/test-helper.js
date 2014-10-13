import resolver from './helpers/resolver';
import {
  setResolver
  } from 'ember-qunit';

if (!Function.prototype.bind) {
  Function.prototype.bind = function (context) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }
    var args = Array.prototype.slice.call(arguments, 1),
      toBind = this,
      Dummy = function () {
      },
      bound = function () {
        return toBind.apply(
            this instanceof Dummy && context ? this : context,
          args.concat(Array.prototype.slice.call(arguments)));
      };
    Dummy.prototype = this.prototype;
    bound.prototype = new Dummy();
    return bound;
  };
}

setResolver(resolver);

document.write('<div id="ember-testing-container"><div id="ember-testing"></div></div>');

QUnit.config.urlConfig.push({ id: 'nocontainer', label: 'Hide container'});
var containerVisibility = QUnit.urlParams.nocontainer ? 'hidden' : 'visible';
document.getElementById('ember-testing-container').style.visibility = containerVisibility;
