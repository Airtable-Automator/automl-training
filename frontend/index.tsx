import {
    Text,
    initializeBlock,
    useViewport,
    useSettingsButton,
    Box,
} from '@airtable/blocks/ui';
import { viewport } from '@airtable/blocks';
import React, { useState, useEffect } from 'react';
import { Welcome } from './Welcome';
import { useSettings } from './settings';
import { ConfigureOrSelectAutoMLProject } from './ConfigureOrSelectAutoMLProject';
import { ChooseSource } from './ChooseSource';
import { ReviewSettings } from './ReviewSettings';
import { PreProcessingView } from './PreProcessingView';
import { useLocalStorage } from './use_local_storage';
import { TrainingView } from './TrainingView';
import { ThankYou } from './ThankYou';

type AppState = {
    index: number,
    state: object,
}

viewport.addMaxFullscreenSize({
    width: 680,
    height: 500,
})

function AutoMLTrainingBlock() {
    const viewport = useViewport();
    const { isValid, message, settings } = useSettings();
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    useSettingsButton(() => {
        // if (!isSettingsVisible) {
        //     viewport.enterFullscreenIfPossible();
        // }
        setIsSettingsVisible(!isSettingsVisible);
    });

    // Open the SettingsForm whenever the settings are not valid
    useEffect(() => {
        if (!isValid) {
            setIsSettingsVisible(true);
        }
    }, [isValid]);

    const [appState, setAppState] = useLocalStorage<AppState>('appState', { index: 1, state: {} });

    if (!isValid || isSettingsVisible) {
        return (<Welcome appState={appState} setAppState={setAppState} setIsSettingsVisible={setIsSettingsVisible} />);
    }

    switch (appState.index) {
        case 1:
            return (<ChooseSource appState={appState} setAppState={setAppState} />);
        case 2:
            return (<ConfigureOrSelectAutoMLProject appState={appState} setAppState={setAppState} />);
        case 3:
            return (<ReviewSettings appState={appState} setAppState={setAppState} />);
        case 4:
            return (<PreProcessingView appState={appState} setAppState={setAppState} />);
        case 5:
            return (<TrainingView appState={appState} setAppState={setAppState} />);
        case 6:
            return (<ThankYou appState={appState} setAppState={setAppState} />);
        default:
            return (<NotFoundPage appState={appState} />);
    }
}

function NotFoundPage({ appState }) {
    return (
        <Text>Invalid App State Index: {appState.index}, State: {JSON.stringify(appState.state)}</Text>
    );
}

initializeBlock(() => <AutoMLTrainingBlock />);
