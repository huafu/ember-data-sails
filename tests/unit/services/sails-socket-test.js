import {
  moduleFor,
  test
  } from 'ember-qunit';
import ioMock from '../../helpers/io-mock';

var subject;

moduleFor('service:sails-socket', 'SailsSocketService', {
  // Specify the other units that are required for this test.
  //needs: ['initializer:sails-socket-service'],
  setup:    function () {
    ioMock.mockSetup();
    subject = this.subject.bind(this);
  },
  teardown: function () {
    ioMock.mockTeardown();
  }
});


asyncTest('it waits for object to be ready', function () {
  var service = subject();
  expect(3);
  strictEqual(service.get('isInitialized'), false, 'the service should not be initialized at start');
  ioMock.mockConnect(10);
  service.on('didInitialize', function () {
    ok(true, 'the didInitialize event should have been triggered');
  });
  setTimeout(function () {
    start();
    strictEqual(service.get('isInitialized'), true, 'the service should have been initialized');
  }, 100);
});


asyncTest('it performs request once connected only', function () {
  var calls = [], service = subject();
  expect(2);
  ioMock.mockRequest('get', '/toto', null, {name: 'toto'}, null, function () {
    calls.push('request');
  });
  service.on('didConnect', function () {
    calls.push('didConnect');
  });
  service.on('didInitialize', function () {
    calls.push('didInitialize');
  });
  service.call('get', '/toto', null).then(function (response) {
    calls.push('response');
    deepEqual(response, {name: 'toto'}, 'the response should be correct');
  });
  setTimeout(function () {
    start();
    deepEqual(calls, ['didInitialize', 'didConnect', 'request', 'response'], 'the calls should have been made in correct order');
  }, 100);
  ioMock.mockConnect(10);
});
