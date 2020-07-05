import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { Box, Heading, useViewport, ProgressBar, Text, useBase, useRecords, Icon, Button } from '@airtable/blocks/ui';
import { Table } from '@airtable/blocks/models';
import PQueue from 'p-queue';
import { useSettings } from './settings';
import { GsClient } from './gcloud-apis/gs';
import { AutoMLClient } from './gcloud-apis/aml';

const queue = new PQueue({ concurrency: 1 });

async function uploadImages(gsClient: GsClient, bucket: string, table: Table, imageFieldName: string, setProgress) {
  const query = await table.selectRecordsAsync();
  const total = query.records.length;

  const checkAndUpload = async (record, index) => {
    const img = record.getCellValue(imageFieldName);
    console.log(img);

    if (img) {
      // value exist in the cell
      const i = img[0]; // we by default pick only the first image
      const responseFromAirtable = await fetch(i.url);
      // console.log("fetched the image from airtable");
      const imageAsBlob = await responseFromAirtable.blob();
      // console.log("Attempting to upload file to " + bucket);
      // console.log(imageAsBlob.size);
      // console.log(i);
      const objectExists = await gsClient.objectExist(bucket, `automl-training/${table.name}/${encodeURIComponent(i.filename)}`);
      if (!objectExists) {
        console.log("Object not found already on GCS, uploading it now")
        await gsClient.upload(bucket, `automl-training/${table.name}/${encodeURIComponent(i.filename)}`, i.type, imageAsBlob);
      } else {
        console.log("Object already in bucket, skipping upload");
      }

      const progressSoFar = (index + 1) / total;
      setProgress(progressSoFar);
    }

    console.log("Upload complete for all the records");
  }

  const promises = query.records.map(async function (record, index) {
    await queue.add(() => checkAndUpload(record, index));
  });

  await Promise.all(promises);
  query.unloadData();
}

async function createLabelsCSV(gsClient: GsClient, bucket: string, table: Table, imageFieldName: string, labelFieldName: string, setProgress) {
  const query = await table.selectRecordsAsync();
  const total = query.records.length;

  const labels = query.records.map(function (record, index) {
    const img = record.getCellValue(imageFieldName);
    console.log(img);

    const label = record.getCellValue(labelFieldName);
    console.log(label);

    if (img) {
      const i = img[0];
      return `gs://${bucket}/automl-training/${table.name}/${encodeURIComponent(i.filename)},${label.name}`
    }
  }).join('\n');
  console.log(labels);
  const csvAsBlob = new Blob([labels], {
    type: 'text/csv'
  });

  // TODO: May be we need to check if the file exists already?
  const labelsAlreadyUploaded = await gsClient.objectExist(bucket, `automl-training/${table.name}/labels2.csv`)
  if (!labelsAlreadyUploaded) {
    await gsClient.upload(bucket, `automl-training/${table.name}/labels2.csv`, 'text/csv', csvAsBlob);
  }
  setProgress(1.0);

  query.unloadData();
}

async function importDatasetIntoAutoML(automlClient: AutoMLClient, project: string, datasetMachineName: string, bucket: string, table: Table, setProgress) {
  const datasetId = _.last(datasetMachineName.split('/'));

  try {
    await automlClient.importDataIntoDataset(project, datasetId, `gs://${bucket}/automl-training/${table.name}/labels2.csv`);
  } catch (err) {
    // we get error which represents that an existing import is already running, we can ignore this and move on
  }
  setProgress(0.66);
  await automlClient.waitForAllActiveOperationsToComplete(project);
  setProgress(1.0);
}

async function startModelTraining(automlClient: AutoMLClient, project: string, datasetMachineName: string, bucket: string, table: Table, setProgress) {

}

const STEP_UPLOAD_IMAGE = 'Uploading Images to Cloud Storage';
const CREATE_LABELS_CSV = 'Creating and uploading labels.csv for the Dataset';
const IMPORT_IMAGES_INTO_DATASET = 'Importing Data into Dataset';

export function PreProcessingView({ appState, setAppState }) {
  const settings = useSettings();
  const viewport = useViewport();
  const [currentStep, setCurrentStep] = useState('Initializing');
  const [progress, setProgress] = useState(0.0);
  const base = useBase();
  const [completedSteps, setCompletedSteps] = useState([]);

  const sourceTable = base.getTableByNameIfExists(appState.state.source.table);
  const gsClient = new GsClient(settings, settings.settings.gsEndpoint);
  const automlClient = new AutoMLClient(settings, settings.settings.automlEndpoint);

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
          uploadImages(gsClient, appState.state.automl.bucket, sourceTable, appState.state.source.imageField, setProgress).then(function (res) {
            let updatedAppState = _.set(appState, "state.training.stage", 2);
            setAppState(updatedAppState);
            setCurrentStep(CREATE_LABELS_CSV);
            setCompletedSteps(_.concat(completedSteps, { name: STEP_UPLOAD_IMAGE, status: true }));
            setProgress(0.0);
          }).catch(function (err) {
            console.error(err);
            setCompletedSteps(_.concat(completedSteps, { name: STEP_UPLOAD_IMAGE, status: false }));
          });
          return;

        case 2:
          setProgress(0.01);
          // create a CSV and upload it to GCS
          createLabelsCSV(gsClient, appState.state.automl.bucket, sourceTable, appState.state.source.imageField, appState.state.source.labelField, setProgress).then(function (res) {
            console.log("Created Labels on GCS. Next step, import the dataset into AutoML");
            let updatedAppState = _.set(appState, "state.training.stage", 3);
            setAppState(updatedAppState);

            setCurrentStep(IMPORT_IMAGES_INTO_DATASET);
            setCompletedSteps(_.concat(completedSteps, { name: CREATE_LABELS_CSV, status: true }));
            setProgress(0.0);
          }).catch(function (err) {
            console.error(err);
            setCompletedSteps(_.concat(completedSteps, { name: CREATE_LABELS_CSV, status: false }));
          });
          return;

        case 3:
          setProgress(0.01);
          importDatasetIntoAutoML(automlClient, appState.state.automl.project, appState.state.automl.dataset.id, appState.state.automl.bucket, sourceTable, setProgress).then(function (res) {
            console.log("Imported Dataset into AutoML. Next step, Start training the model on AutoML");
            let updatedAppState = _.set(appState, "state.training.stage", 4);
            setAppState(updatedAppState);

            setCompletedSteps(_.concat(completedSteps, { name: IMPORT_IMAGES_INTO_DATASET, status: true }));
          }).catch(function (err) {
            setCompletedSteps(_.concat(completedSteps, { name: IMPORT_IMAGES_INTO_DATASET, status: false }));
            console.error(err);
          });
          return;
        // Start Training on AutoML
      }
    }
  }, [appState, currentStep, progress]);

  const tail = _.last(completedSteps);

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0} className='review-settings'>
      <Box maxWidth='650px'>
        <Box paddingBottom='10px' display='flex' alignItems='center' justifyContent='center'>
          <Heading size='xlarge'>Pre-Processing
            {(!tail || (tail && tail.status)) && " In Progress"}
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
                return (
                  <Box display='flex' key={index}>
                    <Text textColor='#909090'>{index + 1}. {value.name} <Icon name={value.status ? 'check' : 'x'} fillColor={value.status ? 'green' : 'red'} /></Text>
                  </Box>
                );
              })
            }
          </Box>

          {
            tail && !tail.status &&
            <Box padding='20px'>
              <Box><em>{tail.name}</em> has failed, please restart Pre-processing</Box>
              <Button variant='primary'>Restart Pre-processing</Button>
            </Box>
          }

          {
            tail && tail.status && completedSteps.length == 3 &&
            <Box padding='20px'>
              <Button variant='primary'>Proceed to Training</Button>
            </Box>
          }
        </Box>
      </Box>
    </Box>
  );
}