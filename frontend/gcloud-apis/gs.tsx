import { BaseClient } from './base';
import { UseSettingsHook, DEFAULT_GS_ENDPOINT } from '../settings';

type ListBucket = {
  defaultEventBasedHold: boolean,
  etag: string,
  id: string,
  kind: string,
  name: string,
}

type ListBucketsResponse = {
  items: Array<ListBucket>,
  kind: string,
}
export class GsClient extends BaseClient {

  constructor(settings: UseSettingsHook, endpoint?: string) {
    super(settings, endpoint || DEFAULT_GS_ENDPOINT);
  }

  async listBuckets(project: string): Promise<ListBucketsResponse> {
    return await this._makeRequestGet('/storage/v1/b?maxResults=1000&project=' + project);
  }
}