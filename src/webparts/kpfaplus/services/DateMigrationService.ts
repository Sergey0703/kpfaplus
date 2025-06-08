// src/webparts/kpfaplus/services/DateMigrationService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from './RemoteSiteService';
import { IRemoteListItemResponse } from './RemoteSiteInterfaces';

// Migration target lists configuration
export interface IListMigrationConfig {
  listName: string;
  displayName: string;
  estimatedCount: number;
  dateFields: IDateFieldConfig[];
}

// Date field configuration for each list
export interface IDateFieldConfig {
  fieldName: string;
  fieldType: 'mainDate' | 'timeField'; // mainDate = normalize to UTC midnight, timeField = preserve time
  description: string;
}

// Migration status for individual lists
export type MigrationStatus = 'notStarted' | 'analyzing' | 'ready' | 'migrating' | 'completed' | 'error';

// Individual list migration state
export interface IListMigrationState {
  listName: string;
  status: MigrationStatus;
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  startTime?: Date;
  endTime?: Date;
  errorMessage?: string;
  previewRecords?: IMigrationPreviewRecord[];
}

// Preview record showing before/after dates
export interface IMigrationPreviewRecord {
  id: string;
  originalDates: Record<string, string>;
  convertedDates: Record<string, string>;
  needsUpdate: boolean;
}

// Migration operation result
export interface IMigrationResult {
  listName: string;
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  duration: number;
  errors: string[];
}

// Batch update result
export interface IBatchUpdateResult {
  batchNumber: number;
  recordsInBatch: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Service for migrating date fields from Ireland timezone to UTC format
 * Handles timezone conversion for SharePoint date fields that were saved in local time
 */
export class DateMigrationService {
  private static _instance: DateMigrationService;
  private _logSource: string = "DateMigrationService";
  private _remoteSiteService: RemoteSiteService;
  private _batchSize: number = 200;

  // Ireland timezone offset (UTC+0 in winter, UTC+1 in summer)
  // Note: We're doing manual conversion assuming local time was stored, so timezone constant not used directly

  // Configuration for all target lists
  private readonly LIST_CONFIGS: IListMigrationConfig[] = [
    {
      listName: 'DaysOfLeaves',
      displayName: 'Days of Leaves',
      estimatedCount: 1500,
      dateFields: [
        { fieldName: 'Date1', fieldType: 'mainDate', description: 'Leave start date' },
        { fieldName: 'Date2', fieldType: 'mainDate', description: 'Leave end date (optional)' }
      ]
    },
    {
      listName: 'StaffRecords',
      displayName: 'Staff Records',
      estimatedCount: 3200,
      dateFields: [
        { fieldName: 'Date', fieldType: 'mainDate', description: 'Record date' },
        { fieldName: 'ShiftDate1', fieldType: 'timeField', description: 'Shift 1 time' },
        { fieldName: 'ShiftDate2', fieldType: 'timeField', description: 'Shift 2 time' },
        { fieldName: 'ShiftDate3', fieldType: 'timeField', description: 'Shift 3 time' },
        { fieldName: 'ShiftDate4', fieldType: 'timeField', description: 'Shift 4 time' }
      ]
    },
    {
      listName: 'WeeklyTimeTables',
      displayName: 'Weekly Time Tables',
      estimatedCount: 1000,
      dateFields: [
        { fieldName: 'MondayStartWork', fieldType: 'timeField', description: 'Monday start time' }, // исправлена опечатка
        { fieldName: 'MondayEndWork', fieldType: 'timeField', description: 'Monday end time' },
        { fieldName: 'TuesdayStartWork', fieldType: 'timeField', description: 'Tuesday start time' },
        { fieldName: 'TuesdayEndWork', fieldType: 'timeField', description: 'Tuesday end time' },
        { fieldName: 'WednesdayStartWork', fieldType: 'timeField', description: 'Wednesday start time' },
        { fieldName: 'WednesdayEndWork', fieldType: 'timeField', description: 'Wednesday end time' },
        { fieldName: 'ThursdayStartWork', fieldType: 'timeField', description: 'Thursday start time' },
        { fieldName: 'ThursdayEndWork', fieldType: 'timeField', description: 'Thursday end time' },
        { fieldName: 'FridayStartWork', fieldType: 'timeField', description: 'Friday start time' },
        { fieldName: 'FridayEndWork', fieldType: 'timeField', description: 'Friday end time' },
        { fieldName: 'SaturdayStartWork', fieldType: 'timeField', description: 'Saturday start time' },
        { fieldName: 'SaturdayEndWork', fieldType: 'timeField', description: 'Saturday end time' },
        { fieldName: 'SundayStartWork', fieldType: 'timeField', description: 'Sunday start time' },
        { fieldName: 'SundayEndWork', fieldType: 'timeField', description: 'Sunday end time' },
        { fieldName: 'StartLunch', fieldType: 'timeField', description: 'Lunch start time' }, // ДОБАВЛЕНО
        { fieldName: 'EndLunch', fieldType: 'timeField', description: 'Lunch end time' } // ДОБАВЛЕНО
      ]
    },
    {
      listName: 'WeeklySchedule',
      displayName: 'Weekly Schedule',
      estimatedCount: 2000,
      dateFields: [
        { fieldName: 'StartDate', fieldType: 'mainDate', description: 'Schedule start date' },
        { fieldName: 'FinishDate', fieldType: 'mainDate', description: 'Schedule finish date' }
      ]
    }
  ];

  private constructor(context: WebPartContext) {
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("DateMigrationService initialized for Ireland timezone migration");
  }

  public static getInstance(context: WebPartContext): DateMigrationService {
    if (!DateMigrationService._instance) {
      DateMigrationService._instance = new DateMigrationService(context);
    }
    return DateMigrationService._instance;
  }

  /**
   * Gets the list of all available migration targets
   */
  public getAvailableLists(): IListMigrationConfig[] {
    return [...this.LIST_CONFIGS];
  }

  /**
   * Analyzes a specific list to count records that need migration
   */
  public async analyzeList(listName: string): Promise<IListMigrationState> {
    try {
      this.logInfo(`Analyzing list: ${listName}`);
      
      const config = this.LIST_CONFIGS.find(c => c.listName === listName);
      if (!config) {
        throw new Error(`Unknown list: ${listName}`);
      }

      // Get all items from the list (no filter - we want ALL records)
      const items = await this._remoteSiteService.getListItems(
        listName,
        true, // expandFields
        undefined, // no filter - get everything
        undefined // no sorting - avoid field name issues
      );

      this.logInfo(`Retrieved ${items.length} records from ${listName} for analysis`);

      // Generate preview for first 5 records that need updates
      const previewRecords: IMigrationPreviewRecord[] = [];

      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const item = items[i];
        const preview = this.createPreviewRecord(item, config);
        
        if (preview.needsUpdate) {
          previewRecords.push(preview);
        }
      }

      // For this migration, assume ALL records need updating since we want consistent UTC format
      // Note: We don't need to track recordsNeedingUpdate as we process all records

      return {
        listName,
        status: 'ready',
        totalRecords: items.length,
        processedRecords: 0,
        errorCount: 0,
        previewRecords
      };

    } catch (error) {
      this.logError(`Error analyzing list ${listName}: ${error}`);
      return {
        listName,
        status: 'error',
        totalRecords: 0,
        processedRecords: 0,
        errorCount: 1,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Migrates all records in a specific list
   */
  public async migrateList(
    listName: string, 
    onProgress?: (state: IListMigrationState) => void
  ): Promise<IMigrationResult> {
    const startTime = new Date();
    this.logInfo(`Starting migration for list: ${listName}`);

    try {
      const config = this.LIST_CONFIGS.find(c => c.listName === listName);
      if (!config) {
        throw new Error(`Unknown list: ${listName}`);
      }

      // Initial state
      const state: IListMigrationState = {
        listName,
        status: 'migrating',
        totalRecords: 0,
        processedRecords: 0,
        errorCount: 0,
        startTime
      };

      // Get all items
      const items = await this._remoteSiteService.getListItems(
        listName,
        true,
        undefined,
        undefined // no sorting - avoid field name issues
      );

      state.totalRecords = items.length;
      onProgress?.(state);

      this.logInfo(`Retrieved ${items.length} records from ${listName} for migration`);

      // Process in batches
      const errors: string[] = [];
      let successCount = 0;
      let totalProcessed = 0;

      for (let i = 0; i < items.length; i += this._batchSize) {
        const batch = items.slice(i, i + this._batchSize);
        const batchNumber = Math.floor(i / this._batchSize) + 1;
        
        this.logInfo(`Processing batch ${batchNumber}: records ${i + 1}-${Math.min(i + this._batchSize, items.length)}`);

        try {
          const batchResult = await this.processBatch(batch, config);
          successCount += batchResult.successCount;
          totalProcessed += batchResult.recordsInBatch;
          
          if (batchResult.errors.length > 0) {
            errors.push(...batchResult.errors);
            state.errorCount += batchResult.errorCount;
          }

          // Update progress
          state.processedRecords = totalProcessed;
          onProgress?.(state);

          this.logInfo(`Batch ${batchNumber} completed: ${batchResult.successCount}/${batchResult.recordsInBatch} successful`);

          // Small delay between batches to avoid throttling
          await this.delay(100);

        } catch (batchError) {
          const errorMsg = `Batch ${batchNumber} failed: ${batchError}`;
          this.logError(errorMsg);
          errors.push(errorMsg);
          state.errorCount += batch.length;
          totalProcessed += batch.length;
          state.processedRecords = totalProcessed;
          onProgress?.(state);
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Final state
      state.status = errors.length === 0 ? 'completed' : 'error';
      state.endTime = endTime;
      state.errorMessage = errors.length > 0 ? `${errors.length} errors occurred` : undefined;
      onProgress?.(state);

      const result: IMigrationResult = {
        listName,
        success: errors.length === 0,
        totalProcessed,
        successCount,
        errorCount: errors.length,
        duration,
        errors
      };

      this.logInfo(`Migration completed for ${listName}: ${successCount}/${totalProcessed} successful in ${duration}ms`);
      return result;

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      this.logError(`Migration failed for ${listName}: ${error}`);
      
      return {
        listName,
        success: false,
        totalProcessed: 0,
        successCount: 0,
        errorCount: 1,
        duration,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Processes a batch of records
   */
  private async processBatch(
    items: IRemoteListItemResponse[], 
    config: IListMigrationConfig
  ): Promise<IBatchUpdateResult> {
    const batchResult: IBatchUpdateResult = {
      batchNumber: 0,
      recordsInBatch: items.length,
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    for (const item of items) {
      try {
        const updateData = this.convertItemDates(item, config);
        
        if (Object.keys(updateData).length > 0) {
          const success = await this._remoteSiteService.updateListItem(
            config.listName,
            parseInt(item.id),
            updateData
          );

          if (success) {
            batchResult.successCount++;
          } else {
            batchResult.errorCount++;
            batchResult.errors.push(`Failed to update item ${item.id}`);
          }
        } else {
          // No updates needed - count as success
          batchResult.successCount++;
        }

      } catch (error) {
        batchResult.errorCount++;
        const errorMsg = `Error updating item ${item.id}: ${error}`;
        batchResult.errors.push(errorMsg);
        this.logError(errorMsg);
      }
    }

    return batchResult;
  }

  /**
   * Creates a preview record showing original and converted dates
   */
  private createPreviewRecord(
    item: IRemoteListItemResponse, 
    config: IListMigrationConfig
  ): IMigrationPreviewRecord {
    const originalDates: Record<string, string> = {};
    const convertedDates: Record<string, string> = {};
    let needsUpdate = false;

    const fields = item.fields || {};

    for (const dateField of config.dateFields) {
      const fieldValue = fields[dateField.fieldName];
      
      if (fieldValue && typeof fieldValue === 'string') {
        originalDates[dateField.fieldName] = fieldValue;
        
        try {
          const converted = this.convertDateField(fieldValue, dateField.fieldType);
          convertedDates[dateField.fieldName] = converted;
          
          // Check if conversion would change the value
          if (converted !== fieldValue) {
            needsUpdate = true;
          }
        } catch (error) {
          convertedDates[dateField.fieldName] = `Error: ${error}`;
          needsUpdate = true;
        }
      }
    }

    return {
      id: item.id,
      originalDates,
      convertedDates,
      needsUpdate
    };
  }

  /**
   * Converts date fields for a single item
   */
  private convertItemDates(
    item: IRemoteListItemResponse, 
    config: IListMigrationConfig
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};
    const fields = item.fields || {};

    for (const dateField of config.dateFields) {
      const fieldValue = fields[dateField.fieldName];
      
      if (fieldValue && typeof fieldValue === 'string') {
        try {
          const converted = this.convertDateField(fieldValue, dateField.fieldType);
          updateData[dateField.fieldName] = converted;
        } catch (error) {
          this.logError(`Error converting ${dateField.fieldName} for item ${item.id}: ${error}`);
        }
      }
    }

    return updateData;
  }

  /**
   * Converts a single date field from Ireland timezone to UTC
   */
  private convertDateField(dateValue: string, fieldType: 'mainDate' | 'timeField'): string {
    try {
      const originalDate = new Date(dateValue);
      
      if (isNaN(originalDate.getTime())) {
        throw new Error(`Invalid date format: ${dateValue}`);
      }

      if (fieldType === 'mainDate') {
        // For main dates: normalize to UTC midnight on the same calendar date
        const year = originalDate.getFullYear();
        const month = originalDate.getMonth();
        const day = originalDate.getDate();
        
        const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        return utcDate.toISOString();
        
      } else {
        // For time fields: preserve the time but use 2025-01-01 as base date in UTC
        const hours = originalDate.getHours();
        const minutes = originalDate.getMinutes();
        const seconds = originalDate.getSeconds();
        
        const utcTimeDate = new Date(Date.UTC(2025, 0, 1, hours, minutes, seconds, 0));
        return utcTimeDate.toISOString();
      }
      
    } catch (error) {
      throw new Error(`Date conversion failed for '${dateValue}': ${error}`);
    }
  }

  /**
   * Utility method for adding delays between operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sets the batch size for processing
   */
  public setBatchSize(size: number): void {
    if (size > 0 && size <= 500) {
      this._batchSize = size;
      this.logInfo(`Batch size set to ${size}`);
    } else {
      this.logError(`Invalid batch size: ${size}. Must be between 1 and 500.`);
    }
  }

  /**
   * Gets current batch size
   */
  public getBatchSize(): number {
    return this._batchSize;
  }

  /**
   * Logs info messages
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * Logs error messages  
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}