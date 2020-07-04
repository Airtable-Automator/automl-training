import {
  useGlobalConfig,
} from '@airtable/blocks/ui';
export const GCLOUD_SVC_EMAIL = "gcloudServiceEmail";
export const GCLOUD_SVC_PRIVATE_KEY = "gcloudServicePrivateKey";
export const GCLOUD_AUTOML_PROXY = "gcloudAutomlProxy";
export const GCLOUD_GS_PROXY = "gcloudGsProxy";

export const DEFAULT_AUTOML_PROXY = 'https://automl2.ashwanthkumar.in';
export const DEFAULT_GS_PROXY = 'https://gs.ashwanthkumar.in';

const isEmpty = (input: string) => (!input || input === "")
const isNotEmpty = (input: string) => !isEmpty(input)

export function useSettings() {
  const globalConfig = useGlobalConfig();

  const svcEmail = globalConfig.get(GCLOUD_SVC_EMAIL) as string;
  const svcKey = globalConfig.get(GCLOUD_SVC_PRIVATE_KEY) as string;
  const automlProxy = globalConfig.get(GCLOUD_AUTOML_PROXY) as string;
  const gsProxy = globalConfig.get(GCLOUD_GS_PROXY) as string;

  const settings = {
    svcEmail,
    svcKey,
    automlProxy,
    gsProxy,
  };

  if (isEmpty(svcEmail) || isEmpty(svcKey) || isEmpty(automlProxy) || isEmpty(gsProxy)) {
    return {
      isValid: false,
      message: 'Settings are invalid, please configure them once again',
      settings,
    };
  }
  return {
    isValid: true,
    settings,
  };
}
