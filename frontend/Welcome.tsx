import {
  Box,
  Text,
  Link,
  FormField,
  Input,
  InputSynced,
  useViewport,
  useGlobalConfig,
  useSynced,
  Heading,
  Button,
  Icon,
  Loader,
} from '@airtable/blocks/ui';

import React, { useState, useEffect } from 'react';
import { GCLOUD_SVC_EMAIL, GCLOUD_SVC_PRIVATE_KEY, GCLOUD_AUTOML_PROXY, GCLOUD_GS_PROXY, DEFAULT_AUTOML_PROXY, DEFAULT_GS_PROXY } from './settings';
import GlobalConfig from '@airtable/blocks/dist/types/src/global_config';
import { GoogleToken } from 'gtoken';
import CSS from 'csstype';

async function checkForDefaultProxyUrls(globalConfig: GlobalConfig) {
  const autoMLProxy = globalConfig.get(GCLOUD_AUTOML_PROXY) as string;
  const gsProxy = globalConfig.get(GCLOUD_GS_PROXY) as string;

  if (!autoMLProxy || autoMLProxy === "") {
    await globalConfig.setAsync(GCLOUD_AUTOML_PROXY, DEFAULT_AUTOML_PROXY)
  }

  if (!gsProxy || gsProxy === "") {
    await globalConfig.setAsync(GCLOUD_GS_PROXY, DEFAULT_GS_PROXY)
  }
}

export function Welcome({ appState, setAppState, setIsSettingsVisible }) {
  const globalConfig = useGlobalConfig();

  const svcPrivateKeyStye: CSS.Properties = {
    paddingLeft: '10px',
    paddingRight: '10px',
    borderRadius: '3px',
    boxSizing: 'border-box',
    fontFamily: "-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol'",
    backgroundColor: 'hsl(0, 0%, 95%)',
    color: 'hsl(0, 0%, 20%)',
    fontWeight: 400,
    border: 'none',
    outline: 'none',
  }

  useEffect(() => {
    // Set the default AUTOML_PROXY and GS_PROXY if not set already
    checkForDefaultProxyUrls(globalConfig);
  }, [globalConfig]);

  const [isLoading, setLoading] = useState(false);
  const [svcPrivateKey, setSvcPrivateKey, canSetSvcPrivateKey] = useSynced(GCLOUD_SVC_PRIVATE_KEY);
  const [errorMessage, setErrorMessage] = useState("");

  const viewport = useViewport();
  const validateSettings = async (e) => {
    e.preventDefault();
    setLoading(true);

    const email = globalConfig.get(GCLOUD_SVC_EMAIL) as string;
    const key = globalConfig.get(GCLOUD_SVC_PRIVATE_KEY) as string;
    console.log("Email: " + email);
    console.log("Key: " + key);
    const gtoken = new GoogleToken({
      email: email,
      key: key,
      scope: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    try {
      const _ = await gtoken.getToken();
      // validation success
      setLoading(false);
      setIsSettingsVisible(false);
    } catch (e) {
      setLoading(false);
      // validation failed
      setErrorMessage(e.message);
    }
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" border="default" flexDirection="column" width={viewport.size.width} height={viewport.size.height} padding={0}>
      <Box maxWidth='650px'>
        <Box paddingBottom='10px'>
          <Heading size="xlarge">Welcome to AutoML Model Training Block</Heading>
        </Box>

        <Box paddingBottom='10px'>
          <Text variant="paragraph" size="xlarge">
            To use this block, we need the following information in order to connect to your Google Cloud Service Account.
          </Text>
          <Heading size="xsmall">
            Note: These values will be accessible to everyone who has access to this base.
          </Heading>
        </Box>
        <form onSubmit={validateSettings}>
          <Box>
            <FormField label="Service Account Email">
              <InputSynced required={true} globalConfigKey={GCLOUD_SVC_EMAIL} />
            </FormField>
          </Box>

          <Box>
            <FormField label="Service Account Private Key">
              {/* <InputSynced required={true} globalConfigKey={GCLOUD_SVC_PRIVATE_KEY} /> */}
              <textarea
                id='svcPrivateKey'
                value={svcPrivateKey as string || ""}
                rows={15}
                style={svcPrivateKeyStye}
                onChange={(e) => {
                  setSvcPrivateKey(e.target.value);
                }}></textarea>
            </FormField>
          </Box>

          <Box>
            <FormField label={"AutoML CORS Proxy URL (Default: " + DEFAULT_AUTOML_PROXY + ")"}>
              <InputSynced type='url' required={true} globalConfigKey={GCLOUD_AUTOML_PROXY} />
            </FormField>
          </Box>

          <Box>
            <FormField label={"Cloud Storage CORS Proxy URL (Default: " + DEFAULT_GS_PROXY + ")"}>
              <InputSynced type='url' required={true} globalConfigKey={GCLOUD_GS_PROXY} />
            </FormField>
          </Box>

          <Box>
            {
              errorMessage !== "" && <Text paddingBottom='5px' textColor='red'>Note: {errorMessage}</Text>
            }
            <Button icon={isLoading && <Loader /> || <Icon name='premium' fillColor='yellow' />} variant="primary" disabled={isLoading} onClick={validateSettings}>Validate Settings</Button>
          </Box>

        </form>
      </Box>
    </Box>
  );
}
