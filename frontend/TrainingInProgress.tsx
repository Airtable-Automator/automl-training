import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { Box, Heading, useViewport, ProgressBar, useBase, useRecords } from '@airtable/blocks/ui';
import { Table } from '@airtable/blocks/models';
import PQueue from 'p-queue';
import { useSettings } from './settings';
import { GsClient } from './gcloud-apis/gs';

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
      console.log("fetched the image from airtable");
      const imageAsBlob = await responseFromAirtable.blob();
      console.log("Attempting to upload file to " + bucket);
      console.log(imageAsBlob.size);
      console.log(i);
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

export function TrainingInProgress({ appState, setAppState }) {
  const settings = useSettings();
  const viewport = useViewport();
  const [currentStep, setCurrentStep] = useState('Initializing');
  const [progress, setProgress] = useState(0.0);
  const base = useBase();

  const sourceTable = base.getTableByNameIfExists(appState.state.source.table);
  const gsClient = new GsClient(settings, settings.settings.gsEndpoint);

  useEffect(() => {
    const trainingState = _.get(appState, "state.training");
    if (!trainingState) {
      let updatedAppState = _.set(appState, "state.training.stage", 1);
      setAppState(updatedAppState);
      // start the training progress
      console.log("Starting to upload images to Cloud Storage");
      setCurrentStep('Uploading Images to Cloud Storage');
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
            setCurrentStep('Uploading labels for Training');
            setProgress(0.0);
          }).catch(function (err) {
            console.error(err);
          });

        case 2:
          setProgress(0.01);
        // create a CSV and upload it to GCS
      }
    }
  }, [appState, currentStep, progress])

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0} className='review-settings'>
      <Box maxWidth='650px'>
        <Box paddingBottom='10px' display='flex' alignItems='center' justifyContent='center'>
          <Heading size='xlarge'>Training In Progress</Heading>
        </Box>

        <Box>
          <Heading size='xsmall'>{currentStep}</Heading>
          <ProgressBar progress={progress} />
        </Box>
      </Box>
    </Box>
  );
}