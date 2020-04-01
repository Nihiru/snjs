import { PayloadSources } from '@Payloads/sources';
import { PurePayload } from '@Payloads/pure_payload';
import { CreateItemFromPayload } from '@Models/generator';
import { PayloadCollection } from '@Payloads/collection';
import { ConflictStrategies } from '@Payloads/deltas/strategies';
import { CopyPayload } from '@Payloads/generator';
import { PayloadsByDuplicating } from '@Payloads/functions';
import { greaterOfTwoDates, uniqCombineObjArrays } from '@Lib/utils';

export class ConflictDelta {

  private readonly baseCollection: PayloadCollection
  private readonly basePayload: PurePayload
  private readonly applyPayload: PurePayload
  private readonly source: PayloadSources

  constructor(
    baseCollection: PayloadCollection,
    basePayload: PurePayload,
    applyPayload: PurePayload,
    source: PayloadSources
  ) {
    this.baseCollection = baseCollection;
    this.basePayload = basePayload;
    this.applyPayload = applyPayload;
    this.source = source;
  }

  public async resultingCollection() {
    const tmpBaseItem = CreateItemFromPayload(this.basePayload);
    const tmpApplyItem = CreateItemFromPayload(this.applyPayload);
    const strategy = tmpBaseItem.strategyWhenConflictingWithItem(tmpApplyItem);
    const results = await this.payloadsByHandlingStrategy(strategy);
    return new PayloadCollection(results, this.source);
  }

  private async payloadsByHandlingStrategy(strategy: ConflictStrategies) {
    if (strategy === ConflictStrategies.KeepLeft) {
      return [this.basePayload];
    }
    if (strategy === ConflictStrategies.KeepRight) {
      return [this.applyPayload];
    }
    if (strategy === ConflictStrategies.KeepLeftDuplicateRight) {
      const updatedAt = greaterOfTwoDates(
        this.basePayload.updated_at!,
        this.applyPayload.updated_at!
      );
      const leftPayload = CopyPayload(
        this.basePayload,
        {
          updated_at: updatedAt,
          dirty: true
        }
      );
      const rightPayloads = await PayloadsByDuplicating(
        this.applyPayload,
        this.baseCollection,
        true,
      );
      return [leftPayload].concat(rightPayloads);
    }

    if (strategy === ConflictStrategies.DuplicateLeftKeepRight) {
      const leftPayloads = await PayloadsByDuplicating(
        this.basePayload,
        this.baseCollection,
        true,
      );
      const rightPayload = this.applyPayload;
      return leftPayloads.concat([rightPayload]);
    }

    if (strategy === ConflictStrategies.KeepLeftMergeRefs) {
      const refs = uniqCombineObjArrays(
        this.basePayload.contentObject.references,
        this.applyPayload.contentObject.references,
        ['uuid', 'content_type']
      );
      const updatedAt = greaterOfTwoDates(
        this.basePayload.updated_at!,
        this.applyPayload.updated_at!
      );
      const payload = CopyPayload(
        this.basePayload,
        {
          updated_at: updatedAt,
          dirty: true,
          content: { references: refs }
        }
      );
      return [payload];
    }

    throw 'Unhandled strategy';
  }
}
