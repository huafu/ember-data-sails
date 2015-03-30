import SailsRestAdapter from 'ember-data-sails/adapters/sails-rest';
import Ember from 'ember';
import {
  module,
  test
  } from 'qunit';
import QUnit from 'qunit';

var RSVP = Ember.RSVP;
var run = Ember.run;
var bind = run.bind;


module('SailsRestAdapter', {
  subject: function (obj) {
    return run(SailsRestAdapter, 'create', obj || {});
  }
});

var CSRF_PROPERTY = '_csrf';
var CSRF_VALUE = 'abcdefgh012345';
var URL = '/some/dummy/url';
function addCsrf(obj) {
  if (!obj) {
    obj = {};
  }
  obj[CSRF_PROPERTY] = CSRF_VALUE;
  return obj;
}



test('it has correct URL for the CSRF token', function(assert) {
  assert.expect(6);

  var adapter = this.subject();

  assert.equal(adapter.get('csrfTokenUrl'), '/csrfToken', 'default URL should be correct');

  run(adapter, 'set', 'host', 'https://example.com');
  assert.equal(adapter.get('csrfTokenUrl'), 'https://example.com/csrfToken', 'URL should be correct with `host` set');

  run(adapter, 'set', 'namespace', 'api');
  assert.equal(adapter.get('csrfTokenUrl'), 'https://example.com/csrfToken', 'URL should be correct with `host` and `namespace` set, absolute path');

  run(adapter, 'set', 'csrfTokenPath', 'csrfToken');
  assert.equal(adapter.get('csrfTokenUrl'), 'https://example.com/api/csrfToken', 'URL should be correct with `host` and `namespace` set, relative path');

  run(adapter, 'set', 'host', null);
  assert.equal(adapter.get('csrfTokenUrl'), '/api/csrfToken', 'URL should be correct with `namespace` set, relative path');

  run(adapter, 'set', 'csrfTokenPath', '/csrfToken');
  assert.equal(adapter.get('csrfTokenUrl'), '/csrfToken', 'URL should be correct with `namespace` set, absolute path');
});
