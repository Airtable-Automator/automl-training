import {
  Box,
  FormField,
  Heading,
  Input,
  Button,
  Loader,
  Dialog,
  Text,
  useViewport,
  useGlobalConfig,
  TextButton,
  Select,
  Icon,
} from '@airtable/blocks/ui';
import React, { useState, useEffect } from 'react';
import CSS from 'csstype';
import _ from 'lodash';
import { CloudResourceManagerClient } from './gcloud-apis/crm';
import { ErrorResponse } from './gcloud-apis/base';
import { useSettings } from './settings';
import { updateState, isNotEmpty } from './utils';
import { SelectOption, SelectOptionValue } from '@airtable/blocks/dist/types/src/ui/select_and_select_buttons_helpers';
import { AutoMLClient } from './gcloud-apis/aml';
import { GsClient } from './gcloud-apis/gs';

const PLACEHOLDER = "__PLACEHOLDER__";

export function ConfigureOrSelectAutoMLProject({ appState, setAppState }) {
  const settings = useSettings();
  const [availableProjects, setAvailableProjects] = useState<Array<SelectOption>>([{ value: PLACEHOLDER, label: "Loading..." }]);
  const [selectedProject, setSelectedProject] = useState<SelectOptionValue>(undefined);

  const [availableDatasets, setAvailableDatasets] = useState<Array<SelectOption>>([{ value: PLACEHOLDER, label: "Loading..." }]);
  const [selectedDataset, setSelectedDataset] = useState<SelectOptionValue>(undefined);

  const [availableBuckets, setAvailableBuckets] = useState<Array<SelectOption>>([{ value: PLACEHOLDER, label: "Loading..." }]);
  const [selectedBucket, setSelectedBucket] = useState<SelectOptionValue>(undefined);

  const [showCreateDatasetDialog, setShowCreateDatasetDialog] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetClassificationType, setNewDatasetClassificationType] = useState('MULTICLASS');
  const [createDatasetIsLoading, setCreateDatasetIsLoading] = useState(false);
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');

  const startOver = () => {
    window.localStorage.clear();
    setAppState({ index: 1, state: {} });
  }

  const crmClient = new CloudResourceManagerClient(settings, settings.settings.crmEndpoint);
  const loadProjects = async () => {
    const projects = await crmClient.listProjects();
    return _.map(projects.projects, function (project) {
      return {
        value: project.projectId,
        label: project.name,
        disabled: project.lifecycleState !== "ACTIVE",
      }
    });
  }

  const amlClient = new AutoMLClient(settings, settings.settings.automlEndpoint);
  const loadDatasets = async () => {
    const datasets = await amlClient.listDatasets(selectedProject);
    return _.map(datasets.datasets, function (dataset) {
      return {
        value: dataset.name,
        label: dataset.displayName + " (" + (dataset.exampleCount || 0) + " examples)",
      }
    });
  }
  const createDataset = async () => {
    setCreateDatasetIsLoading(true);
    try {
      const response = await amlClient.createDataset(selectedProject, newDatasetName, newDatasetClassificationType);
      setCreateDatasetIsLoading(false);
      setShowCreateDatasetDialog(false);
      setNewDatasetName('');
      const updatedAppState = updateState(appState, "state.cache.datasets", []);
      setAppState(updatedAppState);
    } catch (errorResponse) {
      setCreateDatasetIsLoading(false);
      setDialogErrorMessage(errorResponse.error.message);
    }
  }

  const gsClient = new GsClient(settings, settings.settings.gsEndpoint);
  const loadBuckets = async () => {
    const buckets = await gsClient.listBuckets(selectedProject as string);
    return _.map(buckets.items, function (bucket) {
      return {
        value: bucket.id,
        label: bucket.name,
        disabled: !(bucket.location === "US-CENTRAL1" && bucket.locationType === "region"),
      }
    });
  }

  useEffect(() => {
    const cachedProjects = _.get(appState, "state.cache.projects");
    if (!cachedProjects) {
      loadProjects().then(function (response) {
        setAvailableProjects(response);
        updateState(appState, "state.cache.projects", response);
      });
    }

    if (_.size(cachedProjects) > 0) {
      setAvailableProjects(cachedProjects);
    }

    const cachedDatasets = _.get(appState, "state.cache.datasets", []);
    if (selectedProject && selectedProject !== PLACEHOLDER && !(_.size(cachedDatasets) > 0)) {
      loadDatasets().then(function (response) {
        setAvailableDatasets(response);
        updateState(appState, "state.cache.datasets", response);
      });
    }
    if (_.size(cachedDatasets) > 0) {
      setAvailableDatasets(cachedDatasets);
    }

    const cachedBuckets = _.get(appState, "state.cache.buckets", []);
    if (selectedProject && selectedProject !== PLACEHOLDER && !(_.size(cachedBuckets) > 0)) {
      loadBuckets().then(function (response) {
        setAvailableBuckets(response);
        updateState(appState, "state.cache.buckets", response);
      });
    }
    if (_.size(cachedBuckets) > 0) {
      setAvailableBuckets(cachedBuckets);
    }
  }, [appState, selectedProject])

  const viewport = useViewport();

  const isValid = isNotEmpty(selectedProject as string) && isNotEmpty(selectedDataset as string) && isNotEmpty(selectedBucket as string);

  const next = (e) => {
    e.preventDefault();
    const selectedDatasetOption = _.find(availableDatasets, function (dataset) {
      return dataset.value === selectedDataset;
    });
    const updatedAppState = { ...appState };
    // console.log(updatedAppState);
    updatedAppState.index = updatedAppState.index + 1;
    updatedAppState.state.automl = {
      project: selectedProject,
      dataset: {
        id: selectedDatasetOption.value,
        name: selectedDatasetOption.label
      },
      bucket: selectedBucket,
    }
    // console.log(JSON.stringify(updatedAppState));
    setAppState(updatedAppState);
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0}>
      <Box maxWidth='580px'>
        <Box paddingBottom='10px'>
          <Heading size='xlarge'>Configure AutoML Settings</Heading>
        </Box>

        <Box>
          <FormField label="Choose an AutoML Project">
            <Select
              options={availableProjects}
              value={selectedProject}
              onChange={(value) => { setSelectedProject(value); }}
            />
          </FormField>
        </Box>

        {selectedProject && PLACEHOLDER !== selectedProject &&
          <Box>
            <FormField label={<Text>Choose a Dataset or Create <TextButton onClick={(e) => setShowCreateDatasetDialog(true)}>a new one</TextButton>.</Text>}>
              <Select
                options={availableDatasets}
                value={selectedDataset}
                onChange={(value) => { setSelectedDataset(value); }}
              />
            </FormField>
          </Box>
        }

        {showCreateDatasetDialog &&
          <Dialog onClose={() => setShowCreateDatasetDialog(false)} width="320px">
            <Dialog.CloseButton />
            <Heading>Create Dataset</Heading>
            <Box>
              <FormField label="Name of the new Dataset">
                <Input
                  value={newDatasetName}
                  disabled={createDatasetIsLoading}
                  onChange={(value) => {
                    setNewDatasetName(value.target.value);
                  }}
                />
              </FormField>
            </Box>

            <Box>
              <FormField label="Classification Type">
                <Select
                  options={[
                    { value: "MULTICLASS", label: "MULTICLASS" },
                    { value: "MULTILABEL", label: "MULTILABEL" },
                  ]}
                  value={newDatasetClassificationType}
                  disabled={createDatasetIsLoading}
                  onChange={(value) => {
                    setNewDatasetClassificationType(value as string);
                  }}
                />
              </FormField>
            </Box>

            <Box>
              {
                dialogErrorMessage !== "" && <Text paddingBottom='5px' textColor='red'>Note: {dialogErrorMessage}</Text>
              }

            </Box>

            <Box display='flex' justifyContent='space-between'>
              <Button icon={createDatasetIsLoading ? <Loader /> : <></>} variant='primary' onClick={createDataset}>Create</Button>
              <Button onClick={() => setShowCreateDatasetDialog(false)}>Cancel</Button>
            </Box>
          </Dialog>
        }

        {selectedDataset && PLACEHOLDER !== selectedDataset &&
          <Box>
            <FormField label="Choose Cloud Storage Bucket for the dataset">
              <Select
                options={availableBuckets}
                value={selectedBucket}
                onChange={(value) => { setSelectedBucket(value); }}
              />
            </FormField>
          </Box>
        }

        <Box display='flex' justifyContent='space-evenly'>
          {isValid &&
            <Button variant="primary" onClick={next}>Review Settings</Button>
          }
          <Button
            variant='danger'
            icon='redo'
            onClick={startOver}>
            Start Over
            </Button>
        </Box>
      </Box>
    </Box>
  );
}