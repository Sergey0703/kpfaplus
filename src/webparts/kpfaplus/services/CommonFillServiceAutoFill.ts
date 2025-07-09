// src/webparts/kpfaplus/services/CommonFillServiceAutoFill.ts - Auto-Fill Operations (Part 3/4)
// МОДУЛЬ: Автозаполнение с прогрессом, КОРОТКИЙ И СФОКУСИРОВАННЫЙ
import { MessageBarType } from '@fluentui/react';
import { IFillParams, DialogType } from './CommonFillValidation';
import { CommonFillGeneration } from './CommonFillGeneration';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { CommonFillServiceValidation } from './CommonFillServiceValidation';

// Import types from main service
import { IAutoFillResult, IPerformFillParams } from './CommonFillService';

// Progress interface for auto-fill
export interface IAutoFillProgress {
  isActive: boolean;
  currentStaffName: string;
  nextStaffName?: string;
  completed: number;
  total: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  isPaused: boolean;
  remainingPauseTime: number;
  startTime: number;
  elapsedTime: number;
  isProcessing: boolean;
}

// Batch result interface
export interface IAutoFillBatchResult {
  totalProcessed: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  executionTime: number;
  results: Array<{
    staffId: string;
    staffName: string;
    success: boolean;
    message: string;
    createdRecords?: number;
    skipReason?: string;
  }>;
}

export class CommonFillServiceAutoFill {
  private validationModule: CommonFillServiceValidation;
  private generationService: CommonFillGeneration;
  private dateUtils: CommonFillDateUtils;

  constructor(
    validationModule: CommonFillServiceValidation,
    generationService: CommonFillGeneration,
    dateUtils: CommonFillDateUtils
  ) {
    this.validationModule = validationModule;
    this.generationService = generationService;
    this.dateUtils = dateUtils;
    console.log('[CommonFillServiceAutoFill] Auto-fill module initialized with Date-only support');
  }

  // Main auto-fill method
  public async performAutoFillOperation(params: IFillParams): Promise<IAutoFillResult> {
    console.log('[CommonFillServiceAutoFill] Performing auto-fill for:', {
      staffMember: params.staffMember.name,
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)
    });

    try {
      // Check eligibility
      const eligibilityCheck = await this.validationModule.checkAutoFillEligibility(params);
      
      if (!eligibilityCheck.eligible) {
        return {
          success: false,
          message: eligibilityCheck.reason || 'Auto-fill not eligible',
          messageType: eligibilityCheck.hasProcessedRecords ? MessageBarType.warning : MessageBarType.error,
          skipped: true,
          skipReason: eligibilityCheck.reason,
          logResult: eligibilityCheck.hasProcessedRecords ? 3 : 1
        };
      }

      // Create perform params
      const performParams: IPerformFillParams = await this.createPerformFillParams(params, eligibilityCheck.contractId!);

      // Execute auto-fill
      const fillResult = await this.executeAutoFillOperation(performParams);

      return {
        success: fillResult.success,
        message: fillResult.message,
        messageType: fillResult.messageType,
        createdRecordsCount: fillResult.createdRecordsCount,
        skipped: false,
        logResult: fillResult.success ? 2 : 1
      };

    } catch (error) {
      return {
        success: false,
        message: `Error in auto-fill operation: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        skipped: false,
        logResult: 1
      };
    }
  }

  // Batch auto-fill with progress tracking
  public async performBatchAutoFill(
    staffList: Array<{ params: IFillParams; staffMember: { id: string; name: string; employeeId: string; autoSchedule: boolean } }>,
    progressCallback?: (progress: IAutoFillProgress) => void,
    pauseDelay: number = 3000
  ): Promise<IAutoFillBatchResult> {
    const startTime = Date.now();
    const autoScheduleStaff = staffList.filter(item => item.staffMember.autoSchedule);
    
    if (autoScheduleStaff.length === 0) {
      return {
        totalProcessed: 0,
        successCount: 0,
        skippedCount: 0,
        errorCount: 0,
        executionTime: Date.now() - startTime,
        results: []
      };
    }

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: IAutoFillBatchResult['results'] = [];

    // Initialize progress
    const progress: IAutoFillProgress = {
      isActive: true,
      currentStaffName: autoScheduleStaff[0].staffMember.name,
      nextStaffName: autoScheduleStaff.length > 1 ? autoScheduleStaff[1].staffMember.name : undefined,
      completed: 0,
      total: autoScheduleStaff.length,
      successCount: 0,
      skippedCount: 0,
      errorCount: 0,
      isPaused: false,
      remainingPauseTime: 0,
      startTime: startTime,
      elapsedTime: 0,
      isProcessing: false
    };

    // Process each staff member
    for (let i = 0; i < autoScheduleStaff.length; i++) {
      const { params, staffMember } = autoScheduleStaff[i];
      const nextStaff = i < autoScheduleStaff.length - 1 ? autoScheduleStaff[i + 1] : undefined;
      
      // Update progress - start processing
      progress.currentStaffName = staffMember.name;
      progress.nextStaffName = nextStaff?.staffMember.name;
      progress.isProcessing = true;
      progress.elapsedTime = Date.now() - startTime;
      
      if (progressCallback) {
        progressCallback({ ...progress });
      }
      
      try {
        const result = await this.performAutoFillOperation(params);
        
        if (result.success) {
          successCount++;
          results.push({
            staffId: staffMember.id,
            staffName: staffMember.name,
            success: true,
            message: result.message,
            createdRecords: result.createdRecordsCount
          });
        } else {
          if (result.skipped) {
            skippedCount++;
            results.push({
              staffId: staffMember.id,
              staffName: staffMember.name,
              success: false,
              message: result.message,
              skipReason: result.skipReason
            });
          } else {
            errorCount++;
            results.push({
              staffId: staffMember.id,
              staffName: staffMember.name,
              success: false,
              message: result.message
            });
          }
        }
        
        // Update counters
        progress.completed = i + 1;
        progress.successCount = successCount;
        progress.skippedCount = skippedCount;
        progress.errorCount = errorCount;
        progress.isProcessing = false;
        progress.elapsedTime = Date.now() - startTime;
        
        if (progressCallback) {
          progressCallback({ ...progress });
        }
        
      } catch (error) {
        errorCount++;
        results.push({
          staffId: staffMember.id,
          staffName: staffMember.name,
          success: false,
          message: error instanceof Error ? error.message : String(error)
        });
        
        progress.completed = i + 1;
        progress.errorCount = errorCount;
        progress.isProcessing = false;
        progress.elapsedTime = Date.now() - startTime;
        
        if (progressCallback) {
          progressCallback({ ...progress });
        }
      }

      // Pause between operations
      if (i < autoScheduleStaff.length - 1 && pauseDelay > 0) {
        progress.isPaused = true;
        progress.remainingPauseTime = pauseDelay;
        
        if (progressCallback) {
          progressCallback({ ...progress });
        }
        
        // Animated countdown
        const pauseStart = Date.now();
        while (Date.now() - pauseStart < pauseDelay) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const remaining = Math.max(0, pauseDelay - (Date.now() - pauseStart));
          progress.remainingPauseTime = remaining;
          progress.elapsedTime = Date.now() - startTime;
          
          if (progressCallback) {
            progressCallback({ ...progress });
          }
          
          if (remaining <= 0) break;
        }
        
        progress.isPaused = false;
      }
    }

    // Complete progress
    progress.isActive = false;
    progress.currentStaffName = 'Completed';
    progress.elapsedTime = Date.now() - startTime;
    
    if (progressCallback) {
      progressCallback({ ...progress });
    }

    return {
      totalProcessed: autoScheduleStaff.length,
      successCount,
      skippedCount,
      errorCount,
      executionTime: Date.now() - startTime,
      results
    };
  }

  // Quick validation check
  public async quickAutoFillCheck(params: IFillParams): Promise<{
    eligible: boolean;
    reason: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
  }> {
    try {
      // Check AutoSchedule
      const autoScheduleEnabled = params.staffMember.autoSchedule || false;
      if (!autoScheduleEnabled) {
        return {
          eligible: false,
          reason: 'Auto Schedule is disabled for this staff member',
          severity: 'ERROR'
        };
      }

      // Use validation module for detailed check
      const eligibilityCheck = await this.validationModule.checkAutoFillEligibility(params);
      
      if (!eligibilityCheck.eligible) {
        const severity = eligibilityCheck.hasProcessedRecords ? 'WARNING' : 'ERROR';
        return {
          eligible: false,
          reason: eligibilityCheck.reason || 'Auto-fill not eligible',
          severity
        };
      }

      // All checks passed
      return {
        eligible: true,
        reason: 'Ready for auto-fill operation',
        severity: 'INFO'
      };

    } catch (error) {
      return {
        eligible: false,
        reason: `Error during quick check: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'ERROR'
      };
    }
  }

  // Private helper methods
  private async createPerformFillParams(params: IFillParams, contractId: string): Promise<IPerformFillParams> {
    const scheduleLogicResult = await this.validationModule.checkScheduleForFill(params);
    const replaceExisting = scheduleLogicResult.dialogConfig?.type === DialogType.UnprocessedRecordsReplace;

    return {
      ...params,
      contractId,
      replaceExisting
    };
  }

  private async executeAutoFillOperation(performParams: IPerformFillParams): Promise<{
    success: boolean;
    message: string;
    messageType: MessageBarType;
    createdRecordsCount?: number;
  }> {
    try {
      // Delete existing records if needed
      if (performParams.replaceExisting) {
        // Get existing records that need to be deleted
        const existingRecordsCheck = await this.validationModule.validationService.checkExistingRecords(performParams);
        
        if (existingRecordsCheck.hasExistingRecords && existingRecordsCheck.existingRecords && existingRecordsCheck.existingRecords.length > 0) {
          const deleteSuccess = await this.validationModule.validationService.deleteExistingRecords(existingRecordsCheck.existingRecords);
          if (!deleteSuccess) {
            return {
              success: false,
              message: 'Failed to delete existing records before auto-fill',
              messageType: MessageBarType.error
            };
          }
        }
      }

      // Load data
      const [holidays, leaves, weeklyTemplates] = await Promise.all([
        this.generationService.loadHolidays(performParams.selectedDate),
        this.generationService.loadLeaves(performParams),
        this.generationService.loadWeeklyTemplates(
          performParams.contractId,
          performParams.dayOfStartWeek || 7,
          performParams.currentUserId || '0',
          performParams.managingGroupId || '0'
        )
      ]);

      if (weeklyTemplates.length === 0) {
        return {
          success: false,
          message: 'No weekly templates found for auto-fill operation',
          messageType: MessageBarType.error
        };
      }

      // Get contract
      const contractsAnalysis = await this.validationModule.performContractsAnalysis(performParams);
      const selectedContract = contractsAnalysis.activeContracts.find(c => c.id === performParams.contractId);
      
      if (!selectedContract) {
        return {
          success: false,
          message: 'Selected contract not found for auto-fill operation',
          messageType: MessageBarType.error
        };
      }

      // Generate and save records
      const generatedRecords = await this.generationService.generateScheduleRecords(
        performParams,
        selectedContract,
        holidays,
        leaves,
        weeklyTemplates
      );

      if (generatedRecords.length === 0) {
        return {
          success: false,
          message: 'No StaffRecords generated during auto-fill operation',
          messageType: MessageBarType.warning
        };
      }

      const savedCount = await this.generationService.saveGeneratedRecords(generatedRecords, performParams);

      const successMessage = savedCount === generatedRecords.length
        ? `Auto-fill completed: ${savedCount} StaffRecords created for ${this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)}`
        : `Auto-fill partial: ${savedCount} of ${generatedRecords.length} StaffRecords created`;

      return {
        success: savedCount > 0,
        message: successMessage,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount
      };

    } catch (error) {
      return {
        success: false,
        message: `Auto-fill execution error: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error
      };
    }
  }

  // Utility methods
  public formatExecutionTime(milliseconds: number): string {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  public createAutoFillReport(batchResult: IAutoFillBatchResult, period: string): string {
    const lines: string[] = [];
    
    lines.push('=== AUTO-FILL BATCH REPORT ===');
    lines.push(`Period: ${period}`);
    lines.push(`Execution Time: ${this.formatExecutionTime(batchResult.executionTime)}`);
    lines.push(`Total: ${batchResult.totalProcessed}, Success: ${batchResult.successCount}, Skipped: ${batchResult.skippedCount}, Errors: ${batchResult.errorCount}`);
    
    const successRate = batchResult.totalProcessed > 0 
      ? Math.round((batchResult.successCount / batchResult.totalProcessed) * 100) 
      : 0;
    lines.push(`Success Rate: ${successRate}%`);
    
    return lines.join('\n');
  }
}