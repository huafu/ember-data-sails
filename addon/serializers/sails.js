import Ember from 'ember';
import DS from 'ember-data';
import WithLogger from '../mixins/with-logger';
import SailsSocketAdapter from 'ember-data-sails/adapters/sails-socket';

const { $, computed, get } = Ember;
const { pluralize } = Ember.String;


function blueprintsWrapMethod(method) {
  return function () {
    return (get(this, 'useSailsEmberBlueprints') ? this._super : method).apply(this, arguments);
  };
}


/**
 * @class SailsSerializer
 * @extends DS.RESTSerializer
 */
const SailsSerializer = DS.RESTSerializer.extend(WithLogger, {
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
  normalizeArrayResponse: blueprintsWrapMethod(function (store, primaryType, payload) {
    let newPayload = {};
    newPayload[pluralize(primaryType.modelName)] = payload;
    return this._super(store, primaryType, newPayload);
  }),

  /**
   * @since 0.0.11
   * @method extractSingle
   * @inheritDoc
   */
  normalizeSingleResponse: blueprintsWrapMethod(function (store, primaryType, payload, recordId) {
    if (payload === null) {
      return this._super.apply(this, arguments);
    }
    let newPayload = {};
    newPayload[pluralize(primaryType.modelName)] = [payload];
    return this._super(store, primaryType, newPayload, recordId);
  }),

  /**
   * @since 0.0.11
   * @method extractDeleteRecord
   * @inheritDoc
   */
  normalizeDeleteRecordResponse: blueprintsWrapMethod(function (store, type, payload, id, requestType) {
    return this._super(store, type, null, id, requestType);
  }),

  /**
   * @since 0.0.11
   * @method serializeIntoHash
   * @inheritDoc
   */
  serializeIntoHash: blueprintsWrapMethod(function (data, type, record, options) {
    if (Object.keys(data).length > 0) {
      this.error(
        `trying to serialize multiple records in one hash for type ${type.modelName}`,
        data
      );
      throw new Error('Sails does not accept putting multiple records in one hash');
    }
    const json = this.serialize(record, options);
    $.extend(data, json);
  }),

  /**
   * @since 0.0.11
   * @method normalize
   * @inheritDoc
   */
  normalize: blueprintsWrapMethod(function (type, hash, prop) {
    const normalized = this._super(type, hash, prop);
    return this._extractEmbeddedRecords(this, this.store, type, normalized);
  }),

	/**
	 * @since 0.0.15
	 * @method extract
	 * @inheritDoc
	 */
	normalizeResponse: function (store, primaryModelClass/*, payload, id, requestType*/) {
		// this is the only place we have access to the store, so that we can get the adapter and check
		// if it is an instance of sails socket adapter, and so register for events if necessary on that
		// model. We keep a cache here to avoid too many calls
		if (!this._modelsUsingSailsSocketAdapter) {
			this._modelsUsingSailsSocketAdapter = Object.create(null);
		}
		const modelName = primaryModelClass.modelName;
		if (this._modelsUsingSailsSocketAdapter[modelName] === undefined) {
			const adapter = store.adapterFor(modelName);
			this._modelsUsingSailsSocketAdapter[modelName] = adapter instanceof SailsSocketAdapter;
			adapter._listenToSocket(modelName);
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
  _extractEmbeddedRecords: function (serializer, store, type, hash) {
    type.eachRelationship((key, rel) => {
      const modelName = rel.type.modelName;
      const data = hash[key];
      if (data) {
        if (rel.kind === 'belongsTo') {
          if (Ember.typeOf(hash[key]) === 'object') {
            this.debug(`found 1 embedded ${modelName} record:`, hash[key]);
            delete hash[key];
	          store.push(rel.type, serializer.normalize(rel.type, data, null));
            hash[key] = data.id;
          }
        }
        else if (rel.kind === 'hasMany') {
          hash[key] = data.map(function (item) {
            if (Ember.typeOf(item) === 'object') {
              this.debug(`found 1 embedded ${modelName} record:`, item);
              store.push(rel.type, serializer.normalize(rel.type, item, null));
              return item.id;
            }
            return item;
          });
        }
        else {
          this.warn(`unknown relationship kind ${rel.kind}:`, rel);
          throw new Error('Unknown relationship kind ' + rel.kind);
        }
      }
    });
    return hash;
  }
});

export default SailsSerializer;
