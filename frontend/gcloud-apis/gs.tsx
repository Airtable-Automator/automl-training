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

  async upload(bucket: string, name: string, contentType: string, blobData: Blob) {
    return await this._upload(`/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}`, blobData, contentType);
  }

  async objectExist(bucket, name: string) {
    const response = await this._makeRequestGet(`/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`);
    return "storage#object" === response.kind;
  }

  protected async _upload(resource: string, blob: Blob, contentType: string) {
    const accessToken = await this.accessToken();

    const response = await fetch(`${this.endpoint}${resource}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Bearer ${accessToken}`
      },
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      body: blob,
    });

    return this.handleResponse(response);
  }

}