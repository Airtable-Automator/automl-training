import { BaseClient } from './base';
import { UseSettingsHook, DEFAULT_GS_ENDPOINT } from '../settings';

type Project = {
  createdTime: string,
  lifecycleState: string,
  name: string,
  projectId: string,
  projectNumber: string
}
type ListProjectsResponse = {
  projects: Array<Project>
}

export class GsClient extends BaseClient {

  constructor(settings: UseSettingsHook, endpoint?: string) {
    super(settings, endpoint || DEFAULT_GS_ENDPOINT);
  }

  async listBuckets(project: string): Promise<ListProjectsResponse> {
    return await this._makeRequestGet('/storage/v1/b?maxResults=1000&project=' + project);
  }
}