import { useCallback } from 'react';
import { useChartDB } from './use-chartdb';
import { diagramToJSONOutput } from '@/lib/export-import-utils';
import { useStorage } from './use-storage';

const BACKEND_URL = 'http://localhost:3001/api';

export const useCloud = () => {
    const { currentDiagram } = useChartDB();
    const { addDiagram } = useStorage();

    const saveToCloud = useCallback(async () => {
        const json = JSON.parse(diagramToJSONOutput(currentDiagram));
        const response = await fetch(`${BACKEND_URL}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentDiagram.id,
                name: currentDiagram.name,
                json_data: json
            })
        });
        return response.json();
    }, [currentDiagram]);

    const listCloudModels = useCallback(async () => {
        const response = await fetch(`${BACKEND_URL}/models`);
        return response.json();
    }, []);

    const loadFromCloud = useCallback(async (id: string) => {
        const response = await fetch(`${BACKEND_URL}/models/${id}`);
        const data = await response.json();
        await addDiagram({ diagram: data.json_data });
        window.location.href = `#/diagrams/${data.id}`;
        window.location.reload();
    }, [addDiagram]);

    const pushToGit = useCallback(async (commitMsg: string) => {
        const settings = JSON.parse(localStorage.getItem('git_settings') || '{}');
        if (!settings.repoUrl) throw new Error('Git settings not configured');

        const json = JSON.parse(diagramToJSONOutput(currentDiagram));
        const response = await fetch(`${BACKEND_URL}/git/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...settings,
                commitMsg,
                jsonData: json
            })
        });
        return response.json();
    }, [currentDiagram]);

    const updateConfig = useCallback(async (config: any) => {
        await fetch(`${BACKEND_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
    }, []);

    const getConfig = useCallback(async () => {
        const response = await fetch(`${BACKEND_URL}/config`);
        return response.json();
    }, []);

    const updateDiagramFilter = useCallback(async (diagramId: string, filter: any) => {
        await fetch(`${BACKEND_URL}/filters/${diagramId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filter)
        });
    }, []);

    const getDiagramFilter = useCallback(async (diagramId: string) => {
        const response = await fetch(`${BACKEND_URL}/filters/${diagramId}`);
        return response.json();
    }, []);

    const deleteDiagram = useCallback(async (id: string) => {
        await fetch(`${BACKEND_URL}/models/${id}`, { method: 'DELETE' });
    }, []);

    return { saveToCloud, listCloudModels, loadFromCloud, pushToGit, updateConfig, getConfig, updateDiagramFilter, getDiagramFilter, deleteDiagram };
};
