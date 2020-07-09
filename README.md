# automl-training

AutoML Training is an Airtable Block that helps you build custom machine learning models on [AutoML](https://cloud.google.com/automl) from within your Airtable Base.

You can find the demo of this block as part of this [video presentation](https://www.youtube.com/watch?v=vUx2p6dEtt8&list=PLeUD0-i-p8Sn_5GbT6fijjPYd4ipmo1aM&index=5).

## Features
- Create Datasets on AutoML
- Upload images from the base to Cloud Storage
- Import data Dataset into AutoML
- Trigger Image Classification Model training on AutoML

## Caveats
As stated in the [documentation](https://cloud.google.com/vision/automl/docs/before-you-begin), AutoML currently supports only service account based authentication to their APIs. Hence this block would need a service account email address and private key configured before it can be used. As with any block configurations on Airtable, these will be accessible to all the collaborators of the base.

Also because of [Google Cloud's lack of browser support](https://github.com/googleapis/nodejs-dialogflow/issues/405#issuecomment-522745669) for their client SDKs and CORS Headers, you need a proxy running in order to access the Google Cloud Services. We've a ready to use docker container that sets up an nginx with HTTPS Certificates for this purpose. You can check them out at https://github.com/ashwanthkumar/gcloud-proxy-cors.

## License

MIT
