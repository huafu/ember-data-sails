import Ember from 'ember';
import DS from 'ember-data';
import WithLogger from '../mixins/with-logger';
import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';


var $ = Ember.$;
var EmberString = Ember.String;
var fmt = EmberString.fmt;
var pluralize = EmberString.pluralize;
var computed = Ember.computed;


function blueprintsWrapMethod(method) {
  return function () {
    return (this.get('useSailsEmberBlueprints') ? this._super : method).apply(this, arguments);
  };
}


/**
 * @class SailsSerializer
 * @extends DS.RESTSerializer
 */
var SailsSerializer = DS.RESTSerializer.extend(WithLogger, {
  /**
   * The config of the addon will be set here by the initializer
   * @since 0.0.17
   * @property config
   * @type Object
   */
  config: {},

  /**
   * Whether to use `sails-generate-ember-blueprints` or not
   * @since 0.0.15
   * @property useSailsEmberBlueprints
   * @type Boolean
   */
  useSailsEmberBlueprints: computed.readOnly('config.useSailsEmberBlueprints'),

  /**
   * @since 0.0.11
   * @method extractArray
   * @inheritDoc
   */
  extractArray: blueprintsWrapMethod(function (store, primaryType, payload) {
    var newPayload = {};
    newPayload[pluralize(primaryType.modelName)] = payload;
    return this._super(store, primaryType, newPayload);
  }),

  /**
   * @since 0.0.11
   * @method extractSingle
   * @inheritDoc
   */
  extractSingle: blueprintsWrapMethod(function (store, primaryType, payload, recordId) {
    var newPayload;
    if (payload === null) {
      return this._super.apply(this, arguments);
    }
    newPayload = {};
    newPayload[pluralize(primaryType.modelName)] = [payload];
    return this._super(store, primaryType, newPayload, recordId);
  }),

  /**
   * @since 0.0.11
   * @method extractDeleteRecord
   * @inheritDoc
   */
  extractDeleteRecord: blueprintsWrapMethod(function (store, type, payload, id, requestType) {
    return this._super(store, type, null, id, requestType);
  }),

  /**
   * @since 0.0.11
   * @method serializeIntoHash
   * @inheritDoc
   */
  serializeIntoHash: blueprintsWrapMethod(function (data, type, record, options) {
    var json;
    if (Ember.keys(data).length > 0) {
      this.error(
        fmt('trying to serialize multiple records in one hash for type %@', type.modelName),
        data
      );
      throw new Error('Sails does not accept putting multiple records in one hash');
    }
    json = this.serialize(record, options);
    $.extend(data, json);
  }),

  /**
   * @since 0.0.11
   * @method normalize
   * @inheritDoc
   */
  normalize: blueprintsWrapMethod(function (type, hash, prop) {
    var normalized;
    normalized = this._super(type, hash, prop);
    return this._extractEmbeddedRecords(type, normalized);
  }),

  /**
   * @since 0.0.15
   * @method extract
   * @inheritDoc
   */
  extract: function (store, type/*, payload, id, requestType*/) {
    var adapter, modelName, isUsingSocketAdapter;
    // this is the only place we have access to the store, so that we can get the adapter and check
    // if it is an instance of sails socket adapter, and so register for events if necessary on that
    // model. We keep a cache here to avoid too many calls
    if (!this._modelsUsingSailsSocketAdapter) {
      this._modelsUsingSailsSocketAdapter = Object.create(null);
    }
    modelName = type.modelName;
    if (this._modelsUsingSailsSocketAdapter[modelName] === undefined) {
      adapter = store.adapterFor(type);
      this._modelsUsingSailsSocketAdapter[modelName] = isUsingSocketAdapter = adapter instanceof SailsSocketAdapter;
      if (isUsingSocketAdapter) {
        adapter._listenToSocket(modelName);
      }
    }
    return this._super.apply(this, arguments);
  },


  /**
   * Extract the embedded records and create them
   *
   * @since 0.0.11
   * @method _extractEmbeddedRecords
   * @param {subclass of DS.Model} type
   * @param {Object} hash
   * @returns {Object}
   * @private
   */
  _extractEmbeddedRecords: function (type, hash) {
    var self = this, serializer, store = this.store;
    type.eachRelationship(function (key, rel) {
      var data, modelName;
      modelName = rel.type.modelName;
      if ((data = hash[key])) {
        if (rel.kind === 'belongsTo') {
          if (Ember.typeOf(hash[key]) === 'object') {
            self.debug(fmt('found 1 embedded %@ record:', modelName), hash[key]);
            delete hash[key];
            serializer = store.serializerFor(modelName);
            self.store.push(rel.type, serializer.normalize(rel.type, data, null));
            hash[key] = data.id;
          }
        }
        else if (rel.kind === 'hasMany') {
          serializer = store.serializerFor(modelName);
          hash[key] = data.map(function (item) {
            if (Ember.typeOf(item) === 'object') {
              self.debug(fmt('found 1 embedded %@ record:', modelName), item);
              self.store.push(rel.type, serializer.normalize(rel.type, item, null));
              return item.id;
            }
            return item;
          });
        }
        else {
          self.warn(fmt('unknown relationship kind %@:', rel.kind), rel);
          throw new Error('Unknown relationship kind ' + rel.kind);
        }
      }
    });
    return hash;
  }
});

export default SailsSerializer;
