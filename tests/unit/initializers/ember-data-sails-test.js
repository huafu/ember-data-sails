import Application from '@ember/application';
import {run} from '@ember/runloop';
import {module, test} from 'qunit';
import {initialize} from 'ember-data-sails/initializers/ember-data-sails';
import destroyApp from '../../helpers/destroy-app';

module('EmberDataSailsInitializer', {
	beforeEach() {
		run(() => {
			this.application = Application.create();
			this.application.deferReadiness();
		});
	},
	afterEach() {
		destroyApp(this.application);
	}
});


test('it setups injections of the socket service', function (assert) {
	initialize(this.application);
	assert.ok(true);
});

