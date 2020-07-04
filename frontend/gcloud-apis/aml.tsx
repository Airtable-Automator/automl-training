import { BaseClient } from './base';
import { DEFAULT_AUTOML_ENDPOINT, UseSettingsHook } from '../settings';

type ImageClassificationDatasetMetadata = {
  classificationType: string
}

type Dataset = {
  name: string,
  displayName: string,
  createdTime: string,
  etag: string,
  exampleCount: number,
  imageClassificationDatasetMetadata: ImageClassificationDatasetMetadata,
}

type ListDatasetsResponse = {
  datasets: Array<Dataset>
}

export class AutoMLClient extends BaseClient {

  constructor(settings: UseSettingsHook, endpoint?: string) {
    super(settings, endpoint || DEFAULT_AUTOML_ENDPOINT);
  }

  async listDatasets(projectId): Promise<ListDatasetsResponse> {
    return await this._makeRequestGet(`/v1/projects/${projectId}/locations/us-central1/datasets`);
  }
}