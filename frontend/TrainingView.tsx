import { Box, Heading, useViewport, ProgressBar, Text, useBase, useRecords, Icon, Button, FormField, Input, Loader } from '@airtable/blocks/ui';
import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { useLocalStorage } from './use_local_storage';
import { useSettings } from './settings';
import { AutoMLClient } from './gcloud-apis/aml';

async function createModel(automlClient: AutoMLClient, modelName: string, datasetMachineName: string, projectId: string, trainingBudget: number, trainingOpId: string, setTrainingOpId, setErrorMessage) {
  setErrorMessage('');
  let operationId = trainingOpId;
  if ('' === operationId || !operationId) {
    const datasetId = _.last(datasetMachineName.split('/'));
    // console.log(datasetId);
    try {
      const response = await automlClient.createModel(projectId, datasetId, modelName, trainingBudget);
      operationId = _.last(response.name.split('/'));
      // console.log(operationId);
      setTrainingOpId(operationId);
    } catch (e) {
      console.error(e);
      setErrorMessage(e.error.message);
      return false;
    }
  } else {
    // console.log("Found an existing Operation for Model Training, so using that to track progress: " + operationId);
  }
  if ('' !== operationId) {
    try {
      await automlClient.waitForActiveOperationToComplete(projectId, operationId);
      return true;
    } catch (e) {
      console.log(e);
      setErrorMessage(e.error.message);
      return false;
    }
  }
}

export function TrainingView({ appState, setAppState }) {
  const viewport = useViewport();
  const settings = useSettings();
  const [modelName, setModelName] = useLocalStorage('training.modelName', '' as string);
  const [trainingBudget, setTrainingBudget] = useLocalStorage('training.budget', 8 as number);
  const [isLoading, setLoading] = useState(false);
  const [trainingOpId, setTrainingOpId] = useLocalStorage('training.opId', '');
  const [errorMessage, setErrorMessage] = useState('');
  const automlClient = new AutoMLClient(settings, settings.settings.automlEndpoint);
  // start tracking for progress if we already have a trackingId
  (async () => {
    if (trainingOpId && trainingOpId !== '' && !isLoading) {
      setLoading(true);
      const isSuccessful = await createModel(automlClient, modelName, appState.state.automl.dataset.id, appState.state.automl.project, trainingBudget, trainingOpId, setTrainingOpId, setErrorMessage);
      setLoading(false);
      setTrainingOpId('');
      if (isSuccessful) {
        completeModelTraining();
      }
    }
  })();

  const completeModelTraining = () => {
    if (errorMessage && '' !== errorMessage) {
      const updatedAppState = { ...appState };
      updatedAppState.index = 6;
      const withModelName = _.set(updatedAppState, "state.train.modelName", modelName);
      setAppState(withModelName);
    }
  }

  const startTraining = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    const isSuccessful = await createModel(automlClient, modelName, appState.state.automl.dataset.id, appState.state.automl.project, trainingBudget, trainingOpId, setTrainingOpId, setErrorMessage);
    setLoading(false);
    setTrainingOpId('');
    if (isSuccessful) {
      // Model Created, take the user to Thank you Page
      completeModelTraining();
    }
  }

  const startOver = () => {
    window.localStorage.clear();
    setAppState({ index: 1, state: {} });
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0} className='review-settings'>
      <form onSubmit={startTraining}>
        <Box width='500px'>
          <Box paddingBottom='10px' display='flex' alignItems='center' justifyContent='center'>
            <Heading size='xlarge'>Train a new Model</Heading>
          </Box>

          {errorMessage !== '' && <Box>
            <Text textColor='red'><Icon name='warning' fillColor='red' />{errorMessage}</Text>
          </Box>}

          <Box>
            <FormField label="Model Name">
              <Input disabled={isLoading} value={modelName} onChange={e => setModelName(e.target.value)} />
            </FormField>
          </Box>

          <Box>
            <FormField label="Training Budget (Number of Node Hours)">
              <Input disabled={isLoading} type='number' min={1} value={trainingBudget.toString()} onChange={e => setTrainingBudget(parseInt(e.target.value))} />
            </FormField>
          </Box>

          <Box display='flex' justifyContent='space-evenly'>
            <Button
              variant='primary'
              disabled={!modelName || modelName === "" || isLoading}
              icon={isLoading ? <Loader /> : undefined}
              onClick={startTraining}>
              {!isLoading && "Build Model"}
              {isLoading && "Model Buliding in Progress"}
            </Button>
            <Button
              variant='danger'
              disabled={isLoading}
              icon='redo'
              onClick={startOver}>
              Start Over
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
}