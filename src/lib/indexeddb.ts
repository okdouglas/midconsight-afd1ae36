/**
 * IndexedDB Layer for MidconSight
 * Replaces localStorage with robust, versioned database storage
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Permit, ValidationError } from './schema-mapping';

// Database schema version - increment when schema changes
const DB_VERSION = 1;
const DB_NAME = 'MidconSightDB';

// Data models
export interface Dataset {
  id: string;
  name: string;
  uploadedAt: string;
  fileName: string;
  permitCount: number;
  validRows: number;
  skippedRows: number;
  errors: ValidationError[];
  isActive: boolean;
}

export interface Company {
  id: string;
  name: string;
  operatorNumber?: string;
  permitCount: number;
  totalValue: number;
  score: 'hot' | 'warm' | 'cold';
  lastPermitDate: string;
  createdDate: string;
  city?: string;
  state?: string;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  notes?: string;
  createdDate: string;
}

export interface Deal {
  id: string;
  companyId: string;
  name: string;
  stage: 'new_lead' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
  value: number;
  expectedCloseDate: string;
  status: 'open' | 'closed';
  linkedPermitIds: string[];
  notes?: string;
  createdDate: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  date: string;
  companyId?: string;
}

// IndexedDB Schema Definition
interface MidconSightDBSchema extends DBSchema {
  datasets: {
    key: string;
    value: Dataset;
    indexes: { 'by-date': string; 'by-active': number };
  };
  permits: {
    key: string;
    value: Permit;
    indexes: { 
      'by-dataset': string; 
      'by-operator': string; 
      'by-api': string;
      'by-date': string;
    };
  };
  companies: {
    key: string;
    value: Company;
    indexes: { 'by-name': string; 'by-score': string };
  };
  contacts: {
    key: string;
    value: Contact;
    indexes: { 'by-company': string };
  };
  deals: {
    key: string;
    value: Deal;
    indexes: { 'by-company': string; 'by-stage': string };
  };
  activities: {
    key: string;
    value: Activity;
    indexes: { 'by-date': string; 'by-company': string };
  };
}

let dbInstance: IDBPDatabase<MidconSightDBSchema> | null = null;

/**
 * Initialize and open the IndexedDB database
 */
export async function getDB(): Promise<IDBPDatabase<MidconSightDBSchema>> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB<MidconSightDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
      
      // Create datasets store
      if (!db.objectStoreNames.contains('datasets')) {
        const datasetsStore = db.createObjectStore('datasets', { keyPath: 'id' });
        datasetsStore.createIndex('by-date', 'uploadedAt');
        datasetsStore.createIndex('by-active', 'isActive');
      }
      
      // Create permits store
      if (!db.objectStoreNames.contains('permits')) {
        const permitsStore = db.createObjectStore('permits', { keyPath: 'id' });
        permitsStore.createIndex('by-dataset', 'datasetId');
        permitsStore.createIndex('by-operator', 'operator');
        permitsStore.createIndex('by-api', 'api');
        permitsStore.createIndex('by-date', 'dateImported');
      }
      
      // Create companies store
      if (!db.objectStoreNames.contains('companies')) {
        const companiesStore = db.createObjectStore('companies', { keyPath: 'id' });
        companiesStore.createIndex('by-name', 'name');
        companiesStore.createIndex('by-score', 'score');
      }
      
      // Create contacts store
      if (!db.objectStoreNames.contains('contacts')) {
        const contactsStore = db.createObjectStore('contacts', { keyPath: 'id' });
        contactsStore.createIndex('by-company', 'companyId');
      }
      
      // Create deals store
      if (!db.objectStoreNames.contains('deals')) {
        const dealsStore = db.createObjectStore('deals', { keyPath: 'id' });
        dealsStore.createIndex('by-company', 'companyId');
        dealsStore.createIndex('by-stage', 'stage');
      }
      
      // Create activities store
      if (!db.objectStoreNames.contains('activities')) {
        const activitiesStore = db.createObjectStore('activities', { keyPath: 'id' });
        activitiesStore.createIndex('by-date', 'date');
        activitiesStore.createIndex('by-company', 'companyId');
      }
    },
  });
  
  return dbInstance;
}

// ============ DATASET OPERATIONS ============

export async function saveDataset(dataset: Dataset): Promise<void> {
  const db = await getDB();
  await db.put('datasets', dataset);
}

export async function getAllDatasets(): Promise<Dataset[]> {
  const db = await getDB();
  const datasets = await db.getAllFromIndex('datasets', 'by-date');
  return datasets.reverse(); // Most recent first
}

export async function getActiveDataset(): Promise<Dataset | undefined> {
  const db = await getDB();
  const datasets = await db.getAll('datasets');
  return datasets.find(d => d.isActive);
}

export async function setActiveDataset(datasetId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('datasets', 'readwrite');
  const store = tx.objectStore('datasets');
  
  // Deactivate all datasets
  const allDatasets = await store.getAll();
  for (const dataset of allDatasets) {
    if (dataset.isActive) {
      dataset.isActive = false;
      await store.put(dataset);
    }
  }
  
  // Activate the selected dataset
  const targetDataset = await store.get(datasetId);
  if (targetDataset) {
    targetDataset.isActive = true;
    await store.put(targetDataset);
  }
  
  await tx.done;
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const db = await getDB();
  
  // Delete the dataset and all its permits in a transaction
  const tx = db.transaction(['datasets', 'permits'], 'readwrite');
  
  // Delete permits associated with this dataset
  const permitsStore = tx.objectStore('permits');
  const permitIndex = permitsStore.index('by-dataset');
  const permits = await permitIndex.getAllKeys(datasetId);
  for (const key of permits) {
    await permitsStore.delete(key);
  }
  
  // Delete the dataset itself
  await tx.objectStore('datasets').delete(datasetId);
  
  await tx.done;
}

// ============ PERMIT OPERATIONS ============

export async function savePermits(permits: Permit[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('permits', 'readwrite');
  const store = tx.objectStore('permits');
  
  for (const permit of permits) {
    await store.put(permit);
  }
  
  await tx.done;
}

export async function getPermitsByDataset(datasetId: string): Promise<Permit[]> {
  const db = await getDB();
  return db.getAllFromIndex('permits', 'by-dataset', datasetId);
}

export async function getAllPermitsFromActiveDataset(): Promise<Permit[]> {
  const activeDataset = await getActiveDataset();
  if (!activeDataset) return [];
  return getPermitsByDataset(activeDataset.id);
}

export async function getPermitByApi(api: string): Promise<Permit | undefined> {
  const db = await getDB();
  const permits = await db.getAllFromIndex('permits', 'by-api', api);
  return permits[0];
}

// ============ COMPANY OPERATIONS ============

export async function saveCompany(company: Company): Promise<void> {
  const db = await getDB();
  await db.put('companies', company);
}

export async function saveCompanies(companies: Company[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('companies', 'readwrite');
  const store = tx.objectStore('companies');
  
  for (const company of companies) {
    await store.put(company);
  }
  
  await tx.done;
}

export async function getAllCompanies(): Promise<Company[]> {
  const db = await getDB();
  return db.getAll('companies');
}

export async function getCompanyByName(name: string): Promise<Company | undefined> {
  const db = await getDB();
  const companies = await db.getAllFromIndex('companies', 'by-name', name);
  return companies[0];
}

export async function getCompanyById(id: string): Promise<Company | undefined> {
  const db = await getDB();
  return db.get('companies', id);
}

// ============ CONTACT OPERATIONS ============

export async function saveContact(contact: Contact): Promise<void> {
  const db = await getDB();
  await db.put('contacts', contact);
}

export async function getContactsByCompany(companyId: string): Promise<Contact[]> {
  const db = await getDB();
  return db.getAllFromIndex('contacts', 'by-company', companyId);
}

export async function getAllContacts(): Promise<Contact[]> {
  const db = await getDB();
  return db.getAll('contacts');
}

// ============ DEAL OPERATIONS ============

export async function saveDeal(deal: Deal): Promise<void> {
  const db = await getDB();
  await db.put('deals', deal);
}

export async function getAllDeals(): Promise<Deal[]> {
  const db = await getDB();
  return db.getAll('deals');
}

export async function getDealsByCompany(companyId: string): Promise<Deal[]> {
  const db = await getDB();
  return db.getAllFromIndex('deals', 'by-company', companyId);
}

export async function getDealsByStage(stage: Deal['stage']): Promise<Deal[]> {
  const db = await getDB();
  return db.getAllFromIndex('deals', 'by-stage', stage);
}

// ============ ACTIVITY OPERATIONS ============

export async function saveActivity(activity: Activity): Promise<void> {
  const db = await getDB();
  await db.put('activities', activity);
}

export async function getRecentActivities(limit: number = 50): Promise<Activity[]> {
  const db = await getDB();
  const activities = await db.getAllFromIndex('activities', 'by-date');
  return activities.reverse().slice(0, limit);
}

export async function getActivitiesByCompany(companyId: string): Promise<Activity[]> {
  const db = await getDB();
  return db.getAllFromIndex('activities', 'by-company', companyId);
}

// ============ UTILITY OPERATIONS ============

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['datasets', 'permits', 'companies', 'contacts', 'deals', 'activities'],
    'readwrite'
  );
  
  await tx.objectStore('datasets').clear();
  await tx.objectStore('permits').clear();
  await tx.objectStore('companies').clear();
  await tx.objectStore('contacts').clear();
  await tx.objectStore('deals').clear();
  await tx.objectStore('activities').clear();
  
  await tx.done;
}

/**
 * Export all data as JSON for backup
 */
export async function exportAllData(): Promise<object> {
  const db = await getDB();
  
  return {
    datasets: await db.getAll('datasets'),
    permits: await db.getAll('permits'),
    companies: await db.getAll('companies'),
    contacts: await db.getAll('contacts'),
    deals: await db.getAll('deals'),
    activities: await db.getAll('activities'),
    exportedAt: new Date().toISOString()
  };
}
