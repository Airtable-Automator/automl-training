import { GoogleToken } from 'gtoken';
import { Settings, UseSettingsHook } from '../settings';

export abstract class BaseClient {
  protected endpoint: string;
  protected gtoken: GoogleToken = undefined;

  private settings: UseSettingsHook;
  private existingSettingsHash = -1;

  constructor(settings: UseSettingsHook, endpoint: string) {
    this.endpoint = endpoint;
    this.settings = settings;
  }

  protected async _makeRequestGet(resource) {
    // at this point the gtoken should be valid with a access token
    const accessToken = await this.accessToken();
    console.log(accessToken);

    const response = await fetch(`${this.endpoint}${resource}`, {
      credentials: 'include',
      headers: {
        //'Content-Type': 'application/json',
        'Accept': '*/*',
        'Authorization': `Bearer ${accessToken}`
      },
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });

    return response.json();
  }

  private async accessToken(): Promise<string> {
    const settings = this.settings;
    if (!settings.isValid) {
      throw new Error("Can't create gToken, settings are invalid. Error - " + settings.message);
    }

    const newSettingsHash = JSON.stringify(settings).hashCode();

    // Refresh the token when gToken is not defined or when settings change since the last time we created GoogleToken instance
    if (!this.gtoken || newSettingsHash !== this.existingSettingsHash) {
      this.gtoken = new GoogleToken({
        email: settings.settings.svcEmail,
        key: settings.settings.svcKey,
        scope: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const _ = await this.gtoken.getToken();
      this.existingSettingsHash = JSON.stringify(settings.settings).hashCode();
    }

    if (this.gtoken.hasExpired) {
      this.gtoken.getToken();
    }

    return this.gtoken.accessToken;
  }
}