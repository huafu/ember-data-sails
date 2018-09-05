import { module } from 'qunit';
import { setupTest } from 'ember-qunit';
import ioMock from '../../helpers/io-mock';


module('SailsSocketService', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    // Specify the other units that are required for this test.
    //needs: ['initializer:ember-data-sails'],
    this.setup = function () {
		ioMock.mockSetup();
	};

    this.teardown = function () {
		ioMock.mockTeardown();
	};
  });
});
