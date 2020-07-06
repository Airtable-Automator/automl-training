import React, { useEffect, useState } from 'react';
import _, { update } from 'lodash';
import { Box, Heading, useViewport, ProgressBar, Text, useBase, useRecords, Icon, Button, Tooltip } from '@airtable/blocks/ui';
import { Table } from '@airtable/blocks/models';
import PQueue from 'p-queue';
import { useSettings } from './settings';
import { GsClient } from './gcloud-apis/gs';
import { AutoMLClient } from './gcloud-apis/aml';
import { useLocalStorage } from './use_local_storage';

const queue = new PQueue({ concurrency: 1 });
const gsPath = (datasetId, name) => {
  return `automl-training9/${datasetId}/${name}`
}

async function uploadImages(gsClient: GsClient, bucket: string, datasetMachineName: string, table: Table, imageFieldName: string, labelFieldName: string, setProgress) {
  const datasetId = _.last(datasetMachineName.split('/'));

  const query = await table.selectRecordsAsync();
  const total = query.records.length;

  const checkAndUpload = async (record, index) => {
    const img = record.getCellValue(imageFieldName);
    console.log(img);
    const label = record.getCellValue(labelFieldName);

    if (img) {
      // value exist in the cell
      const i = img[0]; // we by default pick only the first image
      const fileExt = _.last(i.type.split('/'));
      const responseFromAirtable = await fetch(i.url);
      try {
        const imageAsBlob = await responseFromAirtable.blob();
        const objectExists = await gsClient.objectExist(bucket, gsPath(datasetId, encodeURIComponent(i.id + "." + fileExt)));
        if (!objectExists) {
          console.log("Object not found already on GCS, uploading it now")
          await gsClient.upload(bucket, gsPath(datasetId, encodeURIComponent(i.id + "." + fileExt)), i.type, imageAsBlob);
          await gsClient.patch(bucket, gsPath(datasetId, encodeURIComponent(i.id + "." + fileExt)), { label: label.name });
        } else {
          console.log("Object already in bucket, skipping upload");
        }
      } catch (e) {
        console.log(e);
      }

      const progressSoFar = (index + 1) / total;
      setProgress(progressSoFar);
    }
  }

  query.records.forEach(async function (record, index) {
    await queue.add(() => checkAndUpload(record, index));
  });
  await queue.onEmpty();

  console.log("Upload complete for all the records");

  query.unloadData();
}

async function createLabelsCSV(gsClient: GsClient, bucket: string, datasetMachineName: string, table: Table, imageFieldName: string, labelFieldName: string, setProgress) {
  const datasetId = _.last(datasetMachineName.split('/'));

  const query = await table.selectRecordsAsync();

  const objects = await gsClient.listObjects(bucket, 'automl-training7');
  console.log(objects);
  const labels = objects.items.map(function (obj) {
    return `gs://${bucket}/${obj.name},${obj.metadata.label}`
  }).join('\n')
  console.log(labels);

  const csvAsBlob = new Blob([labels], {
    type: 'text/csv'
  });

  const labelsAlreadyUploaded = await gsClient.objectExist(bucket, gsPath(datasetId, 'label.csv'));
  if (!labelsAlreadyUploaded) {
    await gsClient.upload(bucket, gsPath(datasetId, 'label.csv'), 'text/csv', csvAsBlob);
  }
  setProgress(1.0);

  query.unloadData();
}

async function importDatasetIntoAutoML(automlClient: AutoMLClient, project: string, datasetMachineName: string, bucket: string, table: Table, setProgress, preProcOpId: string, setPreProcOpdId, setErrorMessage) {
  let operationId = preProcOpId;
  if ('' === operationId || !operationId) {
    const datasetId = _.last(datasetMachineName.split('/'));

    try {
      const response = await automlClient.importDataIntoDataset(project, datasetId, `gs://${bucket}/${gsPath(datasetId, 'label.csv')}`);
      console.log("Op from importData response");
      console.log(response);
      operationId = _.last(response.name.split('/'));
    } catch (err) {
      // we get error which represents that an existing import is already running, we can ignore this and move on
    }
  }
  setProgress(0.66);
  const response = await automlClient.waitForActiveOperationToComplete(project, operationId);
  if (response.error) {
    const partialFailures = response.metadata.partialFailures.map(function (err) {
      return err.message;
    }).join('\n');
    setErrorMessage(response.error.message + '\n' + partialFailures);
    //  throw new Error(response.error.message + '\n' + partialFailures);
  } else {
    setProgress(1.0);
  }
}

const STEP_UPLOAD_IMAGE = 'Uploading Images to Cloud Storage';
const CREATE_LABELS_CSV = 'Creating and uploading labels.csv for the Dataset';
const IMPORT_IMAGES_INTO_DATASET = 'Importing Data into Dataset';

export function PreProcessingView({ appState, setAppState }) {
  const settings = useSettings();
  const viewport = useViewport();
  const base = useBase();
  const [completedSteps, setCompletedSteps] = useLocalStorage('preProcessing.completedSteps', []);
  const [currentStep, setCurrentStep] = useLocalStorage('preProcessing.currentStep', 'Initializing' as string);
  const [progress, setProgress] = useLocalStorage('preProcessing.progress', 0.0 as number);
  const [preProcOpId, setPreProcOpId] = useLocalStorage('preProcessing.opId', '');
  const [errorMessage, setErrorMessage] = useState('');

  const sourceTable = base.getTableByNameIfExists(appState.state.source.table);
  const gsClient = new GsClient(settings, settings.settings.gsEndpoint);
  const automlClient = new AutoMLClient(settings, settings.settings.automlEndpoint);

  const startTraining = () => {
    const updatedAppState = { ...appState };
    updatedAppState.index = 5;
    setAppState(updatedAppState);
  }

  const restartPreProcessing = () => {
    const updatedAppState = { ...appState };
    delete updatedAppState.state['training'];
    setAppState(updatedAppState);
    setCompletedSteps([]);
    setProgress(0.0);
    setCurrentStep('Restarting');
  }

  useEffect(() => {
    const trainingState = _.get(appState, "state.training");
    if (!trainingState) {
      let updatedAppState = _.set(appState, "state.training.stage", 1);
      setAppState(updatedAppState);
      // start the training progress
      console.log(STEP_UPLOAD_IMAGE);
      setCurrentStep(STEP_UPLOAD_IMAGE);
      setProgress(0.0);
    }

    if (trainingState && 0.0 === progress) {
      switch (trainingState.stage) {
        case 1:
          // we need to start uploading
          setProgress(0.01);
          uploadImages(gsClient, appState.state.automl.bucket, appState.state.automl.dataset.id, sourceTable, appState.state.source.imageField, appState.state.source.labelField, setProgress).then(function (res) {
            let updatedAppState = _.set(appState, "state.training.stage", 2);
            setAppState(updatedAppState);
            setCompletedSteps(_.concat(completedSteps, { name: STEP_UPLOAD_IMAGE, status: true }));
            setProgress(0.0);
          }).catch(function (err) {
            console.error(err);
            setCompletedSteps(_.concat(completedSteps, { name: STEP_UPLOAD_IMAGE, status: false }));
          });
          return;

        case 2:
          setCurrentStep(CREATE_LABELS_CSV);
          setProgress(0.01);
          // create a CSV and upload it to GCS
          createLabelsCSV(gsClient, appState.state.automl.bucket, appState.state.automl.dataset.id, sourceTable, appState.state.source.imageField, appState.state.source.labelField, setProgress).then(function (res) {
            console.log("Created Labels on GCS. Next step, import the dataset into AutoML");
            let updatedAppState = _.set(appState, "state.training.stage", 3);
            setAppState(updatedAppState);
            setCompletedSteps(_.concat(completedSteps, { name: CREATE_LABELS_CSV, status: true }));

            setProgress(0.0);
          }).catch(function (err) {
            console.error(err);
            setCompletedSteps(_.concat(completedSteps, { name: CREATE_LABELS_CSV, status: false }));
          });
          return;

        case 3:
          setCurrentStep(IMPORT_IMAGES_INTO_DATASET);
          setProgress(0.01);
          importDatasetIntoAutoML(automlClient, appState.state.automl.project, appState.state.automl.dataset.id, appState.state.automl.bucket, sourceTable, setProgress, preProcOpId, setPreProcOpId, setErrorMessage).then(function (res) {
            console.log("Imported Dataset into AutoML. Next step, Start training the model on AutoML");
            let updatedAppState = _.set(appState, "state.training.stage", 4);
            setAppState(updatedAppState);

            setCompletedSteps(_.concat(completedSteps, { name: IMPORT_IMAGES_INTO_DATASET, status: true }));
          }).catch(function (err) {
            setCompletedSteps(_.concat(completedSteps, { name: IMPORT_IMAGES_INTO_DATASET, status: false, error: err.message }));
            console.error(err);
          });
          return;
      }
    }
  }, [appState, currentStep, progress]);

  const tail = _.last(completedSteps);

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0} className='review-settings'>
      <Box maxWidth='650px'>
        <Box paddingBottom='10px' display='flex' alignItems='center' justifyContent='center'>
          <Heading size='xlarge'>Pre-Processing
            {(!tail || (tail && tail.status)) && completedSteps.length < 3 && " In Progress"}
            {tail && !tail.status && " Failed"}
            {completedSteps.length == 3 && " Completed"}
          </Heading>
        </Box>

        <Box>
          <Box display='flex'>
            <Heading size='xsmall'>{currentStep}</Heading>
          </Box>
          <ProgressBar progress={progress} />
          <Box>
            {
              completedSteps.map(function (value, index) {
                const iconOnSuccess = <Icon name='check' fillColor='green' />
                const iconOnError = <Tooltip
                  content={errorMessage}
                  placementX={Tooltip.placements.CENTER}
                  placementY={Tooltip.placements.BOTTOM}>
                  <Icon name='x' fillColor='red'></Icon>
                </Tooltip>

                return (
                  <Box display='flex' key={index}>
                    <Text textColor='#909090'>{index + 1}. {value.name} {value.status && iconOnSuccess} {!value.status && iconOnError}</Text>
                  </Box>
                );
              })
            }
          </Box>

          {
            tail && !tail.status &&
            <Box padding='20px'>
              <Box><em>{tail.name}</em> has failed, please restart Pre-processing</Box>
              <Button variant='primary' onClick={restartPreProcessing}>Restart Pre-processing</Button>
            </Box>
          }

          {
            tail && tail.status && completedSteps.length == 3 &&
            <Box padding='20px'>
              <Button variant='primary' onClick={startTraining}>Proceed to Training</Button>
            </Box>
          }
        </Box>
      </Box>
    </Box>
  );
}