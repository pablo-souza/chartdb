import React, { useCallback, useMemo } from 'react';
import type { StorageContext } from './storage-context';
import { storageContext } from './storage-context';
import Dexie, { type EntityTable } from 'dexie';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { determineCardinalities } from '@/lib/domain/db-relationship';
import type { ChartDBConfig } from '@/lib/domain/config';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { Note } from '@/lib/domain/note';
import { useCloud } from '@/hooks/use-cloud';
import { diagramToJSONOutput } from '@/lib/export-import-utils';

export const StorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const cloud = useCloud();
    const db = useMemo(() => {
        const dexieDB = new Dexie('ChartDB') as Dexie & {
            diagrams: EntityTable<Diagram, 'id'>;
            db_tables: EntityTable<DBTable & { diagramId: string }, 'id'>;
            db_relationships: EntityTable<DBRelationship & { diagramId: string }, 'id'>;
            db_dependencies: EntityTable<DBDependency & { diagramId: string }, 'id'>;
            areas: EntityTable<Area & { diagramId: string }, 'id'>;
            db_custom_types: EntityTable<DBCustomType & { diagramId: string }, 'id'>;
            notes: EntityTable<Note & { diagramId: string }, 'id'>;
            config: EntityTable<ChartDBConfig & { id: number }, 'id'>;
            diagram_filters: EntityTable<DiagramFilter & { diagramId: string }, 'diagramId'>;
        };

        dexieDB.version(13).stores({
            diagrams: '++id, name, databaseType, databaseEdition, createdAt, updatedAt',
            db_tables: '++id, diagramId, name, schema, x, y, fields, indexes, color, createdAt, width, comment, isView, isMaterializedView, order',
            db_relationships: '++id, diagramId, name, sourceSchema, sourceTableId, targetSchema, targetTableId, sourceFieldId, targetFieldId, type, createdAt',
            db_dependencies: '++id, diagramId, schema, tableId, dependentSchema, dependentTableId, createdAt',
            areas: '++id, diagramId, name, x, y, width, height, color',
            db_custom_types: '++id, diagramId, schema, type, kind, values, fields',
            config: '++id, defaultDiagramId',
            diagram_filters: 'diagramId, tableIds, schemasIds',
            notes: '++id, diagramId, content, x, y, width, height, color',
        });

        return dexieDB;
    }, []);

    const getConfig: StorageContext['getConfig'] = useCallback(async () => {
        try {
            const cloudConfig = await cloud.getConfig();
            if (cloudConfig) await db.config.put({ id: 1, defaultDiagramId: cloudConfig.default_diagram_id });
        } catch (e) { console.error(e); }
        return await db.config.get(1);
    }, [db, cloud]);

    const updateConfig: StorageContext['updateConfig'] = useCallback(async (config) => {
        await db.config.update(1, config);
        try { await cloud.updateConfig({ defaultDiagramId: config.defaultDiagramId }); } catch (e) { console.error(e); }
    }, [db, cloud]);

    const getDiagramFilter: StorageContext['getDiagramFilter'] = useCallback(async (diagramId) => {
        try {
            const cloudFilter = await cloud.getDiagramFilter(diagramId);
            if (cloudFilter) await db.diagram_filters.put({ diagramId, ...cloudFilter });
        } catch (e) { console.error(e); }
        return await db.diagram_filters.get({ diagramId });
    }, [db, cloud]);

    const updateDiagramFilter: StorageContext['updateDiagramFilter'] = useCallback(async (diagramId, filter) => {
        await db.diagram_filters.put({ diagramId, ...filter });
        try { await cloud.updateDiagramFilter(diagramId, filter); } catch (e) { console.error(e); }
    }, [db, cloud]);

    const deleteDiagramFilter: StorageContext['deleteDiagramFilter'] = useCallback(async (diagramId) => {
        await db.diagram_filters.where({ diagramId }).delete();
    }, [db]);

    // Métodos auxiliares permanecem locais para performance (IndexedDB como Cache)
    // Mas as operações de Diagrama sincronizam o JSON completo
    const addTable: StorageContext['addTable'] = useCallback(async ({ diagramId, table }) => { await db.db_tables.add({ ...table, diagramId }); }, [db]);
    const getTable: StorageContext['getTable'] = useCallback(async ({ id, diagramId }) => { return await db.db_tables.get({ id, diagramId }); }, [db]);
    const deleteDiagramTables: StorageContext['deleteDiagramTables'] = useCallback(async (diagramId) => { await db.db_tables.where('diagramId').equals(diagramId).delete(); }, [db]);
    const updateTable: StorageContext['updateTable'] = useCallback(async ({ id, attributes }) => { await db.db_tables.update(id, attributes); }, [db]);
    const putTable: StorageContext['putTable'] = useCallback(async ({ diagramId, table }) => { await db.db_tables.put({ ...table, diagramId }); }, [db]);
    const deleteTable: StorageContext['deleteTable'] = useCallback(async ({ id, diagramId }) => { await db.db_tables.where({ id, diagramId }).delete(); }, [db]);
    const listTables: StorageContext['listTables'] = useCallback(async (diagramId) => { return await db.db_tables.where('diagramId').equals(diagramId).toArray(); }, [db]);

    const addRelationship: StorageContext['addRelationship'] = useCallback(async ({ diagramId, relationship }) => { await db.db_relationships.add({ ...relationship, diagramId }); }, [db]);
    const deleteDiagramRelationships: StorageContext['deleteDiagramRelationships'] = useCallback(async (diagramId) => { await db.db_relationships.where('diagramId').equals(diagramId).delete(); }, [db]);
    const getRelationship: StorageContext['getRelationship'] = useCallback(async ({ id, diagramId }) => { return await db.db_relationships.get({ id, diagramId }); }, [db]);
    const updateRelationship: StorageContext['updateRelationship'] = useCallback(async ({ id, attributes }) => { await db.db_relationships.update(id, attributes); }, [db]);
    const deleteRelationship: StorageContext['deleteRelationship'] = useCallback(async ({ id, diagramId }) => { await db.db_relationships.where({ id, diagramId }).delete(); }, [db]);
    const listRelationships: StorageContext['listRelationships'] = useCallback(async (diagramId) => { return (await db.db_relationships.where('diagramId').equals(diagramId).toArray()).sort((a, b) => a.name.localeCompare(b.name)); }, [db]);

    const addDependency: StorageContext['addDependency'] = useCallback(async ({ diagramId, dependency }) => { await db.db_dependencies.add({ ...dependency, diagramId }); }, [db]);
    const getDependency: StorageContext['getDependency'] = useCallback(async ({ diagramId, id }) => { return await db.db_dependencies.get({ id, diagramId }); }, [db]);
    const updateDependency: StorageContext['updateDependency'] = useCallback(async ({ id, attributes }) => { await db.db_dependencies.update(id, attributes); }, [db]);
    const deleteDependency: StorageContext['deleteDependency'] = useCallback(async ({ diagramId, id }) => { await db.db_dependencies.where({ id, diagramId }).delete(); }, [db]);
    const listDependencies: StorageContext['listDependencies'] = useCallback(async (diagramId) => { return await db.db_dependencies.where('diagramId').equals(diagramId).toArray(); }, [db]);
    const deleteDiagramDependencies: StorageContext['deleteDiagramDependencies'] = useCallback(async (diagramId) => { await db.db_dependencies.where('diagramId').equals(diagramId).delete(); }, [db]);

    const addArea: StorageContext['addArea'] = useCallback(async ({ area, diagramId }) => { await db.areas.add({ ...area, diagramId }); }, [db]);
    const getArea: StorageContext['getArea'] = useCallback(async ({ diagramId, id }) => { return await db.areas.get({ id, diagramId }); }, [db]);
    const updateArea: StorageContext['updateArea'] = useCallback(async ({ id, attributes }) => { await db.areas.update(id, attributes); }, [db]);
    const deleteArea: StorageContext['deleteArea'] = useCallback(async ({ diagramId, id }) => { await db.areas.where({ id, diagramId }).delete(); }, [db]);
    const listAreas: StorageContext['listAreas'] = useCallback(async (diagramId) => { return await db.areas.where('diagramId').equals(diagramId).toArray(); }, [db]);
    const deleteDiagramAreas: StorageContext['deleteDiagramAreas'] = useCallback(async (diagramId) => { await db.areas.where('diagramId').equals(diagramId).delete(); }, [db]);

    const addCustomType: StorageContext['addCustomType'] = useCallback(async ({ diagramId, customType }) => { await db.db_custom_types.add({ ...customType, diagramId }); }, [db]);
    const getCustomType: StorageContext['getCustomType'] = useCallback(async ({ diagramId, id }) => { return await db.db_custom_types.get({ id, diagramId }); }, [db]);
    const updateCustomType: StorageContext['updateCustomType'] = useCallback(async ({ id, attributes }) => { await db.db_custom_types.update(id, attributes); }, [db]);
    const deleteCustomType: StorageContext['deleteCustomType'] = useCallback(async ({ diagramId, id }) => { await db.db_custom_types.where({ id, diagramId }).delete(); }, [db]);
    const listCustomTypes: StorageContext['listCustomTypes'] = useCallback(async (diagramId) => { return (await db.db_custom_types.where('diagramId').equals(diagramId).toArray()).sort((a, b) => a.name.localeCompare(b.name)); }, [db]);
    const deleteDiagramCustomTypes: StorageContext['deleteDiagramCustomTypes'] = useCallback(async (diagramId) => { await db.db_custom_types.where('diagramId').equals(diagramId).delete(); }, [db]);

    const addNote: StorageContext['addNote'] = useCallback(async ({ note, diagramId }) => { await db.notes.add({ ...note, diagramId }); }, [db]);
    const getNote: StorageContext['getNote'] = useCallback(async ({ diagramId, id }) => { return await db.notes.get({ id, diagramId }); }, [db]);
    const updateNote: StorageContext['updateNote'] = useCallback(async ({ id, attributes }) => { await db.notes.update(id, attributes); }, [db]);
    const deleteNote: StorageContext['deleteNote'] = useCallback(async ({ diagramId, id }) => { await db.notes.where({ id, diagramId }).delete(); }, [db]);
    const listNotes: StorageContext['listNotes'] = useCallback(async (diagramId) => { return await db.notes.where('diagramId').equals(diagramId).toArray(); }, [db]);
    const deleteDiagramNotes: StorageContext['deleteDiagramNotes'] = useCallback(async (diagramId) => { await db.notes.where('diagramId').equals(diagramId).delete(); }, [db]);

    const addDiagram: StorageContext['addDiagram'] = useCallback(async ({ diagram }) => {
        await db.diagrams.add(diagram);
        if (diagram.tables) await Promise.all(diagram.tables.map(t => addTable({ diagramId: diagram.id, table: t })));
        if (diagram.relationships) await Promise.all(diagram.relationships.map(r => addRelationship({ diagramId: diagram.id, relationship: r })));
        if (diagram.dependencies) await Promise.all(diagram.dependencies.map(d => addDependency({ diagramId: diagram.id, dependency: d })));
        if (diagram.areas) await Promise.all(diagram.areas.map(a => addArea({ diagramId: diagram.id, area: a })));
        if (diagram.customTypes) await Promise.all(diagram.customTypes.map(c => addCustomType({ diagramId: diagram.id, customType: c })));
        if (diagram.notes) await Promise.all(diagram.notes.map(n => addNote({ diagramId: diagram.id, note: n })));
        
        try {
            await cloud.saveToCloud(); // Sincroniza o novo diagrama
        } catch (e) { console.error(e); }
    }, [db, addTable, addRelationship, addDependency, addArea, addCustomType, addNote, cloud]);

    const listDiagrams: StorageContext['listDiagrams'] = useCallback(async (options) => {
        try {
            const cloudModels = await cloud.listCloudModels();
            // Opcional: mesclar ou atualizar local com remoto
        } catch (e) { console.error(e); }
        const diagrams = await db.diagrams.toArray();
        if (options?.includeTables) await Promise.all(diagrams.map(async d => { d.tables = await listTables(d.id); }));
        return diagrams;
    }, [db, cloud, listTables]);

    const getDiagram: StorageContext['getDiagram'] = useCallback(async (id, options) => {
        const diagram = await db.diagrams.get(id);
        if (!diagram) return undefined;
        if (options?.includeTables) diagram.tables = await listTables(id);
        if (options?.includeRelationships) diagram.relationships = await listRelationships(id);
        if (options?.includeDependencies) diagram.dependencies = await listDependencies(id);
        if (options?.includeAreas) diagram.areas = await listAreas(id);
        if (options?.includeCustomTypes) diagram.customTypes = await listCustomTypes(id);
        if (options?.includeNotes) diagram.notes = await listNotes(id);
        return diagram;
    }, [db, listTables, listRelationships, listDependencies, listAreas, listCustomTypes, listNotes]);

    const updateDiagram: StorageContext['updateDiagram'] = useCallback(async ({ id, attributes }) => {
        await db.diagrams.update(id, attributes);
        try {
            const fullDiagram = await getDiagram(id, {
                includeTables: true, includeRelationships: true, includeDependencies: true,
                includeAreas: true, includeCustomTypes: true, includeNotes: true
            });
            if (fullDiagram) await cloud.saveToCloud();
        } catch (e) { console.error(e); }
    }, [db, getDiagram, cloud]);

    const deleteDiagram: StorageContext['deleteDiagram'] = useCallback(async (id) => {
        await Promise.all([
            db.diagrams.delete(id),
            deleteDiagramTables(id),
            deleteDiagramRelationships(id),
            deleteDiagramDependencies(id),
            deleteDiagramAreas(id),
            deleteDiagramCustomTypes(id),
            deleteDiagramNotes(id),
            deleteDiagramFilter(id)
        ]);
        try { await cloud.deleteDiagram(id); } catch (e) { console.error(e); }
    }, [db, deleteDiagramTables, deleteDiagramRelationships, deleteDiagramDependencies, deleteDiagramAreas, deleteDiagramCustomTypes, deleteDiagramNotes, deleteDiagramFilter, cloud]);

    return (
        <storageContext.Provider value={{
            getConfig, updateConfig, addDiagram, listDiagrams, getDiagram, updateDiagram, deleteDiagram,
            addTable, getTable, updateTable, putTable, deleteTable, listTables,
            addRelationship, getRelationship, updateRelationship, deleteRelationship, listRelationships,
            deleteDiagramTables, deleteDiagramRelationships,
            addDependency, getDependency, updateDependency, deleteDependency, listDependencies, deleteDiagramDependencies,
            addArea, getArea, updateArea, deleteArea, listAreas, deleteDiagramAreas,
            addCustomType, getCustomType, updateCustomType, deleteCustomType, listCustomTypes, deleteDiagramCustomTypes,
            addNote, getNote, updateNote, deleteNote, listNotes, deleteDiagramNotes,
            getDiagramFilter, updateDiagramFilter, deleteDiagramFilter,
        }}>
            {children}
        </storageContext.Provider>
    );
};
