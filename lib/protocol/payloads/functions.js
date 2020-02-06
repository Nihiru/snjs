import { SFItem } from '@Models';
import remove from 'lodash/remove';
import { CopyPayload } from '@Payloads';
import { extendArray } from '@Lib/utils';

/**
 * Copies payload and assigns it a new uuid.
 * @returns An array of payloads that have changed as a result of copying.
 */
export async function PayloadsByDuplicating({payload, baseCollection, isConflict}) {
  const results = [];
  const override = {
    uuid: await SFItem.GenerateUuid(),
    dirty: true,
    dirtiedDate: null,
    lastSyncBegan: null
  };
  if(isConflict) {
    override.content = {
      conflict_of: payload.uuid
    };
  }
  const copy = CopyPayload({
    payload: payload,
    override: override
  });

  results.push(copy);

  /**
   * Get the payloads that make reference to payload and add the copy.
   */
  const referencing = baseCollection.payloadsThatReferencePayload(payload);
  const updatedReferencing = await PayloadsByUpdatingReferences({
    payloads: referencing,
    add: [{
      uuid: copy.uuid,
      content_type: copy.content_type
    }]
  });
  extendArray(results, updatedReferencing);
  return results;
}

/**
 * Return the payloads that result if you alternated the uuid for the payload.
 * Alternating a UUID involves instructing related items to drop old references of a uuid
 * for the new one.
 * @returns An array of payloads that have changed as a result of copying.
 */
export async function PayloadsByAlternatingUuid({payload, baseCollection}) {
  const results = [];
  /**
  * We need to clone payload and give it a new uuid,
  * then delete item with old uuid from db (cannot modify uuids in our IndexedDB setup)
  */
  const copy = CopyPayload({
    payload: payload,
    override: {
      uuid: await SFItem.GenerateUuid(),
      dirty: true
    }
  });

  results.push(copy);

  /**
   * Get the payloads that make reference to payload and remove
   * payload as a relationship, instead adding the new copy.
   */
  const referencing = baseCollection.payloadsThatReferencePayload(payload);
  const updatedReferencing = await PayloadsByUpdatingReferences({
    payloads: referencing,
    add: [{
      uuid: copy.uuid,
      content_type: copy.content_type
    }],
    removeIds: [
     payload.uuid
    ]
  });

  extendArray(results, updatedReferencing);

  const updatedSelf = CopyPayload({
    payload: payload,
    override: {
      deleted: true,
      /** Do not set as dirty; this item is non-syncable
        and should be immediately discarded */
      dirty: false,
      content: {
        references: []
      }
    }
  });

  results.push(updatedSelf);
  return results;
}

async function PayloadsByUpdatingReferences({payloads, add, removeIds}) {
 const results = [];
 for(const payload of payloads) {
   const references = payload.content.references.slice();
   if(add) {
     for(const reference of add) {
       references.push(reference);
     }
   }
   if(removeIds) {
     for(const id of removeIds) {
       remove(references, {uuid: id});
     }
   }
   const result = CopyPayload({
     payload: payload,
     override: {
       dirty: true,
       content: {
         references: references
       }
     }
   });
   results.push(result);
 }
 return results;
}