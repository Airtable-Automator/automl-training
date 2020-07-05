import { BaseClient, ErrorResponse } from './base';
import { DEFAULT_AUTOML_ENDPOINT, UseSettingsHook } from '../settings';
import _ from 'lodash';

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

export type Operation = {
  name: string,
  done?: boolean,
  metadata: {
    "@type": string,
    creationTime: string,
    importDataDetails?: {
    },
    partialFailures?: Array<{
      code: number,
      message: string
    }>
  },
  error?: {
    code: number,
    message: string,
  },
  response?: {
    "@type": string,
    name?: string,
  }
}
export type ActiveOperationsResponse = {
  operations: Array<Operation>
}
export class AutoMLClient extends BaseClient {

  constructor(settings: UseSettingsHook, endpoint?: string) {
    super(settings, endpoint || DEFAULT_AUTOML_ENDPOINT);
  }

  async listDatasets(projectId): Promise<ListDatasetsResponse> {
    return await this._makeRequestGet(`/v1/projects/${projectId}/locations/us-central1/datasets`);
  }

  async createDataset(projectId, nameOfDataset, typeOfClassification): Promise<ListDatasetsResponse | ErrorResponse> {
    const payload = {
      displayName: nameOfDataset,
      imageClassificationDatasetMetadata: {
        classificationType: typeOfClassification
      }
    }
    return await this._makeRequestPost(`/v1/projects/${projectId}/locations/us-central1/datasets`, payload);
  }

  async importDataIntoDataset(projectId: string, datasetId: string, pathToLabels: string) {
    const payload = {
      inputConfig: {
        gcsSource: {
          inputUris: [pathToLabels]
        }
      }
    }
    return await this._makeRequestPost(`/v1/projects/${projectId}/locations/us-central1/datasets/${datasetId}:importData`, payload);
  }

  async operationStatus(projectId: string, operationId: string): Promise<Operation> {
    return await this._makeRequestGet(`/v1/projects/${projectId}/locations/us-central1/operations/${operationId}`);
  }

  async activeOperations(projectId: string): Promise<ActiveOperationsResponse> {
    return await this._makeRequestGet(`/v1/projects/${projectId}/locations/us-central1/operations`);
  }

  async waitForAllActiveOperationsToComplete(projectId: string, refreshInterval: number = 5000) {
    let waitForOps = true;
    while (waitForOps) {
      const allOperations = await this.activeOperations(projectId);
      const activeOps = _.filter(allOperations.operations, function (op) {
        return !op.done;
      });
      waitForOps = activeOps.length !== 0;
      if (waitForOps) {
        await new Promise(r => setTimeout(r, refreshInterval));
      }
    }
  }
}