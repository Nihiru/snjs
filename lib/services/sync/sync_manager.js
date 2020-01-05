import { removeFromIndex, sleep } from '@Lib/utils';
import { SNService } from '@Services/pure_service';
import { SortPayloadsByRecentAndContentPriority } from '@Services/sync/utils';
import { SyncOpStatus } from '@Services/sync/sync_op_status';
import { SyncState } from '@Services/sync/sync_state';
import { AccountDownloader } from '@Services/sync/account/downloader';
import { AccountSyncResponseResolver } from '@Services/sync/account/response_resolver';
import { AccountSyncOperation } from '@Services/sync/account/operation';
import { OfflineSyncOperation } from '@Services/sync/offline/operation';
import * as events from '@Services/sync/events';
import { PayloadCollection } from '@Protocol/payloads';
import { DeltaOutOfSync } from '@Protocol/payloads/deltas';
import {
  SIGNAL_TYPE_RESPONSE,
  SIGNAL_TYPE_STATUS_CHANGED
} from '@Services/sync/signals';
import {
  STORAGE_KEY_LAST_SYNC_TOKEN,
  STORAGE_KEY_PAGINATION_TOKEN
} from '@Protocol/storageKeys';

const DEFAULT_DATABASE_LOAD_BATCH_SIZE  = 100;
const DEFAULT_MAX_DISCORDANCE           = 5;
const DEFAULT_MAJOR_CHANGE_THRESHOLD    = 15;
const INVALID_SESSION_RESPONSE_STATUS   = 401;

const TIMING_STRATEGY_RESOLVE_ON_NEXT = 1;
const TIMING_STRATEGY_FORCE_SPAWN_NEW = 2;

export class SNSyncManager extends SNService {
  constructor({
    sessionManager,
    protocolManager,
    storageManager,
    modelManager,
    apiService,
    interval
  }) {
    super();
    this.sessionManager = sessionManager;
    this.protocolManager = protocolManager;
    this.modelManager = modelManager;
    this.storageManager = storageManager;
    this.apiService = apiService;
    this.interval = interval;

    this.statusObservers = [];
    this.eventObservers = [];
    this.resolveQueue = [];
    this.spawnQueue = [];

    this.majorChangeThreshold = DEFAULT_MAJOR_CHANGE_THRESHOLD;
    this.maxDiscordance = DEFAULT_MAX_DISCORDANCE;
    this.initializeStatus();
    this.initializeState();

    /** Content types appearing first are always mapped first */
    this.localLoadPriorty = [
      'SN|ItemsKey',
      'SN|UserPreferences',
      'SN|Privileges',
      'SN|Component',
      'SN|Theme'
    ];
  }

  initializeStatus() {
    this.status = new SyncOpStatus({
      interval: this.interval,
      receiver: (event) => {
        this.notifyEvent(event);
      }
    });
  }

  initializeState() {
    this.state = new SyncState({
      maxDiscordance: this.maxDiscordance,
      receiver: (event) => {
        if(event === events.SYNC_EVENT_SYNC_DISCORDANCE_CHANGE) {
          if(this.state.syncDiscordance < this.maxDiscordance) {
            this.sync();
          }
        } else if(event === events.SYNC_EVENT_ENTER_OUT_OF_SYNC) {
          this.notifyEvent(events.SYNC_EVENT_ENTER_OUT_OF_SYNC);
        } else if(event === events.SYNC_EVENT_EXIT_OUT_OF_SYNC) {
          this.notifyEvent(events.SYNC_EVENT_EXIT_OUT_OF_SYNC);
        }
      },
    });
  }

  lockSyncing() {
    this.locked = true;
  }

  unlockSyncing() {
    this.locked = false;
  }

  addEventObserver(observer) {
    this.eventObservers.push(observer);
    return observer;
  }

  removeEventObserver(observer) {
    pull(this.eventObservers, observer);
  }

  notifyEvent(syncEvent, data) {
    for(let observer of this.eventObservers) {
      observer.callback(syncEvent, data || {});
    }
  }

  addStatusObserver(observer) {
    this.statusObservers.push(observer);
    return observer;
  }

  removeStatusObserver(observer) {
    pull(this.statusObservers, observer);
  }

  statusDidChange() {
    this.statusObservers.forEach((observer) => {
      observer.callback(this.SyncOpStatus);
    })
  }

  isOutOfSync() {
    return this.state.isOutOfSync();
  }

  async getDatabasePayloads() {
    const rawPayloads = await this.storageManager.getAllRawPayloads();
    return rawPayloads;
  }

  async loadDatabasePayloads(rawPayloads) {
    if(this.databaseLoaded) {
      throw 'Attempting to initialize already initialized local database.';
    }

    const unsortedPayloads = rawPayloads.map((rawPayload) => {
      return CreatePayloadFromAnyObject({
        object: rawPayload
      })
    })
    const payloads = SortPayloadsByRecentAndContentPriority(
      unsortedPayloads,
      this.localLoadPriorty
    );

    /** Map in batches to give interface a chance to update */
    const payloadCount = payloads.length;
    const batchSize = DEFAULT_DATABASE_LOAD_BATCH_SIZE;
    const numBatches = Math.ceil(payloadCount/batchSize);

    for(let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      const currentPosition = batchIndex * batchSize;
      const batch = payloads.slice(currentPosition, currentPosition + batchSize);
      const decrypted = await this.protocolManager.payloadsByDecryptingPayloads({
        payloads: batch
      })
      await this.modelManager.mapPayloadsToLocalItems({
        payloads: payloads,
        source: PAYLOAD_SOURCE_LOCAL_RETRIEVED
      });
      this.notifyEvent(
        events.SYNC_EVENT_LOCAL_DATA_INCREMENTAL_LOAD
      );
      this.status.setLocalDataLoadStatus({
        current: current,
        total: payloadCount
      })
    }
    this.databaseLoaded = true;
    this.notifyEvent(
      events.SYNC_EVENT_LOCAL_DATA_LOADED
    );
  }

  async setLastSyncToken(token) {
    this.syncToken = token;
    return this.storageManager.setValue(STORAGE_KEY_LAST_SYNC_TOKEN, token);
  }

  async setPaginationToken(token) {
    this.cursorToken = token;
    if(token) {
      return this.storageManager.setValue(STORAGE_KEY_PAGINATION_TOKEN, token);
    } else {
      return await this.storageManager.removeValue(STORAGE_KEY_PAGINATION_TOKEN);
    }
  }

  async getLastSyncToken() {
    if(!this.syncToken) {
      this.syncToken = await this.storageManager.getValue(STORAGE_KEY_LAST_SYNC_TOKEN);
    }
    return this.syncToken;
  }

  async getPaginationToken() {
    if(!this.cursorToken) {
      this.cursorToken = await this.storageManager.getValue(STORAGE_KEY_PAGINATION_TOKEN);
    }
    return this.cursorToken;
  }

  async clearSyncPositionTokens() {
    this.syncToken = null;
    this.cursorToken = null;
    await this.storageManager.removeValue(STORAGE_KEY_LAST_SYNC_TOKEN);
    await this.storageManager.removeValue(STORAGE_KEY_PAGINATION_TOKEN);
  }

  async popItemsNeedingSync() {
    const items = this.modelManager.getDirtyItems();
    /**
     * Reset dirty counter to 0, since we're about to sync it.
     * Anyone marking the item dirty after this will cause it so sync again.
     */
    for(const item of items) {
      item.dirtyCount = 0;
    }
    return items;
  }

  /**
   * Mark all items as dirty and needing sync, then persist to storage.
   * @param alternateUuids  In the case of signing in and merging local data, we alternate UUIDs
   *                        to avoid overwriting data a user may retrieve that has the same UUID.
   *                        Alternating here forces us to to create duplicates of the items instead.
   */
  async markAllItemsAsNeedingSync({alternateUuids}) {
    if(alternateUUIDs) {
      /** Make a copy of the array, as alternating uuid will affect array */
      const items = this.modelManager.allNondummyItems.filter((item) => {
        return !item.errorDecrypting
      }).slice();
      for(const item of items) {
        await this.modelManager.alternateUUIDForItem(item);
      }
    }

    const items = this.modelManager.allNondummyItems;
    const payloads = items.map((item) => {
      return CreatePayloadFromAnyObject({
        object: item,
        override: {
          dirty: true
        }
      })
    })
    await this.persistPayloads({
      decryptedPayloads: payloads
    })
  }

  /**
   * Return the payloads that need local persistence, before beginning a sync.
   * This way, if the application is closed before a sync request completes,
   * pending data will be saved to disk, and synced the next time the app opens.
   */
  async popPayloadsNeedingPreSyncSave(from) {
    const lastPreSyncSave = this.state.lastPreSyncSaveDate;
    if(!lastPreSyncSave) {
      return from;
    }
    const payloads = from.filter((candidate) => {
      return candidate.dirtiedDate > lastPreSyncSave;
    })
    this.state.setLastPresaveSyncDate(new Date());
    return payloads;
  }

  timingStrategyResolveOnNext() {
    return new Promise((resolve, reject) => {
      this.resolveQueue.push(resolve);
    });
  }

  timingStrategyForceSpawnNew() {
    return new Promise((resolve, reject) => {
      this.spawnQueue.push({resolve, reject});
    });
  }

  /**
   * For timing strategy TIMING_STRATEGY_FORCE_SPAWN_NEW, we will execute a whole sync request
   * and pop it from the queue.
   */
  popSpawnQueue() {
    if(this.spawnQueue.length === 0) {
      return null;
    }
    const promise = this.spawnQueue[0];
    removeFromIndex(this.spawnQueue, 0);
    return this.sync().then(() => {
      promise.resolve();
    }).catch(() => {
      promise.reject();
    })
  }

  /**
   * @param timingStrategy  TIMING_STRATEGY_RESOLVE_ON_NEXT | Default
   *                        Promise will be resolved on the next sync requests after the current one completes.
   *                        If there is no scheduled sync request, one will be scheduled.
   *
   *                        TIMING_STRATEGY_FORCE_SPAWN_NEW
   *                        A new sync request is guarenteed to be generated for your request, no matter how long it takes.
   *                        Promise will be resolved whenever this sync request is processed in the serial queue.

   * @param checkIntegrity  Whether the server should compute and return an integrity hash.
   */
  async sync({timingStrategy, checkIntegrity} = {}) {
    if(this.locked) {
      this.log('Sync Locked');
      return;
    }

    const items = await this.popItemsNeedingSync();
    const decryptedPayloads = items.map((item) => {
      return CreatePayloadFromAnyObject({
        object: item
      })
    });

    const payloadsNeedingSave = await this.popPayloadsNeedingPreSyncSave(decryptedPayloads);
    const needsSaveEncrypted = await this.protocolManager.payloadsByEncryptingPayloads({
      payloads: payloadsNeedingSave,
      intent: ENCRYPTION_INTENT_LOCAL_STORAGE_PREFER_ENCRYPTED
    });
    await this.persistPayloads({
      encryptedPayloads: needsSaveEncrypted
    });

    /** The resolve queue before we add any new elements to it below */
    const inTimeResolveQueue = this.resolveQueue.slice();

    const useStrategy = (
      isNullOrUndefined(timingStrategy)
      ? TIMING_STRATEGY_RESOLVE_ON_NEXT
      : TIMING_STRATEGY_FORCE_SPAWN_NEW
    );
    const syncInProgress = this.currentOperation;
    const databaseLoaded = this.databaseLoaded;
    if(syncInProgress || !databaseLoaded) {
      this.log(
        syncInProgress ?
        'Attempting to sync while existing sync in progress.' :
        'Attempting to sync before local database has loaded.'
      );
      if(useStrategy === TIMING_STRATEGY_RESOLVE_ON_NEXT) {
        return this.timingStrategyResolveOnNext();
      } else if(useStrategy === TIMING_STRATEGY_FORCE_SPAWN_NEW) {
        return this.timingStrategyForceSpawnNew();
      } else {
        throw `Unhandled timing strategy ${strategy}`;
      }
    }

    const online = await this.sessionManager.online();
    const encryptedPayloads = await this.protocolManager.payloadsByEncryptingPayloads({
      payloads: decryptedPayloads,
      intent: online ? ENCRYPTION_INTENT_SYNC : ENCRYPTION_INTENT_LOCAL_STORAGE_PREFER_ENCRYPTED
    });

    this.status.setDidBegin();
    let operation;
    if(online) {
      operation = await this.syncOnlineOperation({
        payloads: encryptedPayloads,
        checkIntegrity: checkIntegrity
      });
    } else {
      operation = await this.syncOfflineOperation({
        payloads: encryptedPayloads
      });
    }
    this.currentOperation = operation;
    await operation.run();
    this.currentOperation = null;

    this.status.setDidEnd();

    /**
     * For timing strategy TIMING_STRATEGY_RESOLVE_ON_NEXT.
     * Execute any callbacks pulled before this sync request began.
     */
    for(const callback of inTimeResolveQueue) {
      callback.resolve();
    }
    subtractFromArray(this.resolveQueue, inTimeResolveQueue);
    if(!this.popSpawnQueue() && this.resolveQueue.length > 0) {
      this.sync();
    }
  }


  /**
   * @private
   */
  async syncOnlineOperation({payloads, checkIntegrity}) {
    this.log('Syncing online user');
    const operation = new AccountSyncOperation({
      apiService: this.apiService,
      payloads: payloads,
      checkIntegrity: checkIntegrity,
      lastSyncToken: await this.getLastSyncToken(),
      paginationToken: await this.getPaginationToken(),
      receiver: async (signal, type) => {
        if(type === SIGNAL_TYPE_RESPONSE) {
          const response = signal;
          if(response.hasError) {
            await this.handleErrorServerResponse({operation, response});
          } else {
            await this.handleSuccessServerResponse({operation, response});
          }
        } else if(type === SIGNAL_TYPE_STATUS_CHANGED) {
          await this.handleStatusChange({operation});
        }
      }
    })
    return operation;
  }

  async syncOfflineOperation({payloads}) {
    const operation = new OfflineSyncOperation({
      payloads: payloads,
      receiver: async (signal, type) => {
        if(type === SIGNAL_TYPE_RESPONSE) {
          await this.handleOfflineResponse(signal);
        } else if(type === SIGNAL_TYPE_STATUS_CHANGED) {
          await this.handleStatusChange({operation});
        }
      }
    })
    return operation;
  }

  async handleStatusChange({operation}) {
    const pendingUploadCount = operaiton.pendingUploadCount();
    const totalUploadCount = operation.totalUploadCount();
    const completedUploadCount = totalUploadCount - pendingUploadCount;
    this.status.setUploadStatus({
      completed: completedUploadCount,
      total: totalUploadCount
    });
  }

  async handleOfflineResponse(response) {
    const payloads = response.payloads;
    await this.persistPayloads({
      encryptedPayloads: payloads
    });
    await this.modelManager.mapPayloadsToLocalItems({
      payloads: payloads,
      source: PAYLOAD_SOURCE_LOCAL_SAVED
    })
    this.notifyEvent(events.SYNC_EVENT_FULL_SYNC_COMPLETED);
  }

  async handleErrorServerResponse({operation, response}) {
    this.log('Sync Error', response);
    if(response.status === INVALID_SESSION_RESPONSE_STATUS) {
      this.notifyEvent(events.SYNC_EVENT_INVALID_SESSION);
    }

    this.status.setError(response.error);
    this.notifyEvent(events.SYNC_EVENT_SYNC_ERROR, response.error);
  }

  async handleSuccessServerResponse({operation, response}) {
    if(this._simulate_latency) { await sleep(this._simulate_latency.latency) }
    this.log('Sync Response', response);
    this.setLastSyncToken(response.lastSyncToken);
    this.setPaginationToken(response.paginationToken);
    this.status.clearError();

    const decryptedPayloads = [];
    for(const payload of response.allProcessedPayloads) {
      decryptedPayloads.push(
        await this.protocolManager.payloadByDecryptingPayload({payload})
      );
    }
    const masterCollection = this.modelManager.getMasterCollection();
    const resolver = new AccountSyncResponseResolver({
      response: response,
      decryptedResponsePayloads: decryptedPayloads,
      payloadsSavedOrSaving: operation.payloadsSavedOrSaving,
      masterCollection: masterCollection,
    });

    const collections = await resolver.collectionsByProcessingResponse();
    for(const collection of collections) {
      await this.modelManager.mapCollectionToLocalItems({
        collection: collection
      });
      await this.persistPayloads({
        decryptedPayloads: collection.allPayloads
      });
    }

    if(response.checkIntegrity) {
      const clientHash = await this.protocolManager.computeDataIntegrityHash();
      this.state.setIntegrityHashes({
        clientHash: clientHash,
        serverHash: response.integrityHash
      })
    }
    this.notifyEvent(
      events.SYNC_EVENT_SINGLE_SYNC_COMPLETED
    );

    if(resolver.needsMoreSync) {
      this.sync();
    }
  }

  async handleSyncOperationCompletion({operation}) {
    if(operation.numberOfItemsInvolved >= this.majorChangeThreshold ) {
      this.notifyEvent(events.SYNC_EVENT_MAJOR_DATA_CHANGE);
    }
    this.status.reset();
    this.notifyEvent(events.SYNC_EVENT_FULL_SYNC_COMPLETED);
  }

  async persistPayloads({encryptedPayloads, decryptedPayloads}) {
    const newlyEncrypted = (decryptedPayloads || []).map(async (payload) => {
      return await this.protocolManager.payloadByEncryptingPayload({
        payload: payload,
        intent: ENCRYPTION_INTENT_LOCAL_STORAGE_PREFER_ENCRYPTED
      })
    })

    const allPayloads = (encryptedPayloads || []).concat(newlyEncrypted);
    await this.storageManager.savePayloads(allPayloads);
  }

  async handleSignOut() {
    this.state.reset();
    this.SyncOpStatus.reset();
    this.resolveQueue = [];
    this.spawnQueue = [];
    await this.clearSyncPositionTokens();
  }

  /** Downloads all items and maps to lcoal items to attempt resolve out-of-sync state */
  async resolveOutOfSync() {
    const payloads = await AccountDownloader.downloadAllPayloads({
      apiService: this.apiService,
      protocolManager: this.protocolManager,
      customEvent: "resolve-out-of-sync"
    });

    const delta = new DeltaOutOfSync({
      baseCollection: this.modelManager.getMasterCollection(),
      applyCollection: new PayloadCollection({
        payloads: payloads,
        source: PAYLOAD_SOURCE_REMOTE_RETRIEVED
      })
    });

    const collection = await delta.resultingCollection();
    await this.modelManager.mapCollectionToLocalItems({
      collection: collection
    });
    await this.persistPayloads({
      decryptedPayloads: collection.payloads
    });
    return this.sync({checkIntegrity: true});
  }

  stateless_downloadAllItems({contentType, customEvent} = {}) {
    return AccountDownloader.downloadAllPayloads({
      apiService: this.apiService,
      protocolManager: this.protocolManager,
      contentType: contentType,
      customEvent: customEvent
    }).then((allPayloads) => {
      return allPayloads.map((payload) => {
        return CreateItemFromPayload(payload);
      });
    })
  }

  /** @unit_testing */
  beginLatencySimulator(latency) {
    this.latency_sim = {
      latency: latency || 1000,
      enabled: true
    }
  }

  /** @unit_testing */
  endLatencySimulator() {
    this.latency_sim = null;
  }
}