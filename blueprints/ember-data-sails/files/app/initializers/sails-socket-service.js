/*
 * required for sails-socket adapter
 *
 * setup injections to have access to `SailsSocketService` through `sailsSocket` property on
 * controllers, routes and adapters
 */

import SailsSocketServiceInitializer from 'ember-data-sails/initializers/sails-socket-service';

export default SailsSocketServiceInitializer;
