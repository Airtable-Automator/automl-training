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
} from '@airtable/blocks/ui';
import React, { useState, useEffect } from 'react';
import CSS from 'csstype';
import _ from 'lodash';
import { CloudResourceManagerClient } from './gcloud-apis/crm';
import { useSettings } from './settings';
import { updateState, isNotEmpty } from './utils';
import { SelectOption, SelectOptionValue } from '@airtable/blocks/dist/types/src/ui/select_and_select_buttons_helpers';
import { AutoMLClient } from './gcloud-apis/aml';

const PLACEHOLDER = "__PLACEHOLDER__";

export function ConfigureOrSelectAutoMLProject({ appState, setAppState }) {
  const settings = useSettings();
  const [storagePath, setStoragePath] = useState('');
  const [availableProjects, setAvailableProjects] = useState<Array<SelectOption>>([{ value: PLACEHOLDER, label: "Loading..." }]);
  const [selectedProject, setSelectedProject] = useState<SelectOptionValue>(undefined);

  const [availableDatasets, setAvailableDatasets] = useState<Array<SelectOption>>([{ value: PLACEHOLDER, label: "Loading..." }]);
  const [selectedDataset, setSelectedDataset] = useState<SelectOptionValue>(undefined);

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
        label: dataset.displayName + " (" + dataset.exampleCount + " examples)",
      }
    });
  }

  useEffect(() => {
    if (!_.has(appState, "state.cache.projects")) {
      loadProjects().then(function (response) {
        setAvailableProjects(response);
        updateState(appState, "state.cache.projects", response);
      });
    }
    if (selectedProject && selectedProject !== PLACEHOLDER && !_.has(appState, "state.cache.datasets")) {
      loadDatasets().then(function (response) {
        setAvailableDatasets(response);
        updateState(appState, "state.cache.datasets", response);
      });
    }
  }, [appState, selectedProject])

  const viewport = useViewport();

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0}>
      <Box maxWidth='650px'>
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
            <FormField label={<Text>Choose a Dataset or Create <TextButton onClick={(e) => alert('TBD: Show a dialog to create a new dataset')}>a new one</TextButton>.</Text>}>
              <Select
                options={availableDatasets}
                value={selectedDataset}
                onChange={(value) => { setSelectedDataset(value); }}
              />
            </FormField>
          </Box>
        }

        {selectedDataset && PLACEHOLDER !== selectedDataset &&
          <Box>
            <FormField label="Enter Cloud Storage Bucket Path for the dataset">
              <Input
                value={storagePath}
                onChange={(value) => {
                  setStoragePath(value.target.value);
                }}
              />
            </FormField>
          </Box>
        }

      </Box>
    </Box>
  );
}