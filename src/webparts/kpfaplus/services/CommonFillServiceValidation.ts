// src/webparts/kpfaplus/services/CommonFillServiceValidation.ts - Validation Logic (Part 2/4)
// МОДУЛЬ: Валидация и анализ контрактов, КОРОТКИЙ И СФОКУСИРОВАННЫЙ
import { MessageBarType } from '@fluentui/react';
import { ContractsService } from './ContractsService';
import { IContract } from '../models/IContract';
import { 
  CommonFillValidation, 
  IFillParams, 
  DialogType
} from './CommonFillValidation';
import { CommonFillGeneration } from './CommonFillGeneration';
import { CommonFillDateUtils } from './CommonFillDateUtils';

// Import types from main service
import { IFillResult, IAutoFillEligibilityCheck } from './CommonFillService';

// Интерфейс для анализа контрактов
interface IContractsAnalysis {
  allContracts: IContract[];
  activeContracts: IContract[];
  analysisDetails: string[];
}

export class CommonFillServiceValidation {
  private contractsService: ContractsService;
  public validationService: CommonFillValidation; // Made public for access from other modules
  private generationService: CommonFillGeneration;
  private dateUtils: CommonFillDateUtils;

  constructor(
    contractsService: ContractsService,
    validationService: CommonFillValidation,
    generationService: CommonFillGeneration,
    dateUtils: CommonFillDateUtils
  ) {
    this.contractsService = contractsService;
    this.validationService = validationService;
    this.generationService = generationService;
    this.dateUtils = dateUtils;
    console.log('[CommonFillServiceValidation] Validation module initialized with Date-only support');
  }

  // Main validation methods
  public async checkAutoFillEligibility(params: IFillParams): Promise<IAutoFillEligibilityCheck> {
    console.log('[CommonFillServiceValidation] Checking auto-fill eligibility for:', params.staffMember.name);
    
    try {
      // Basic validation
      const validation = this.validationService.validateFillParams(params);
      if (!validation.isValid) {
        return {
          eligible: false,
          reason: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Contract analysis
      const contractsAnalysis = await this.performContractsAnalysis(params);
      if (contractsAnalysis.activeContracts.length === 0) {
        return {
          eligible: false,
          reason: 'No active contracts found for this staff member in the selected period'
        };
      }

      const selectedContract = contractsAnalysis.activeContracts[0];

      // Check templates
      try {
        const weeklyTemplates = await this.generationService.loadWeeklyTemplates(
          selectedContract.id,
          params.dayOfStartWeek || 7,
          params.currentUserId || '0',
          params.managingGroupId || '0'
        );
        
        if (weeklyTemplates.length === 0) {
          return {
            eligible: false,
            reason: 'No weekly schedule templates found after filtering'
          };
        }
      } catch (templatesError) {
        return {
          eligible: false,
          reason: `Error checking templates: ${templatesError instanceof Error ? templatesError.message : String(templatesError)}`
        };
      }

      // Apply schedule logic
      const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
        params, selectedContract.id
      );

      // Analyze eligibility
      switch (scheduleLogicResult.dialogConfig.type) {
        case DialogType.EmptySchedule:
          return {
            eligible: true,
            contractId: selectedContract.id
          };

        case DialogType.UnprocessedRecordsReplace:
          return {
            eligible: true,
            contractId: selectedContract.id,
            reason: 'Will replace existing unprocessed records'
          };

        case DialogType.ProcessedRecordsBlock:
          return {
            eligible: false,
            reason: 'Has processed records (Checked>0 or ExportResult>0)',
            hasProcessedRecords: true,
            contractId: selectedContract.id
          };

        default:
          return {
            eligible: false,
            reason: `Unknown dialog type: ${scheduleLogicResult.dialogConfig.type}`
          };
      }

    } catch (error) {
      return {
        eligible: false,
        reason: `Error checking eligibility: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  public async checkScheduleForFill(params: IFillParams): Promise<IFillResult & { contractId?: string }> {
    console.log('[CommonFillServiceValidation] Checking schedule for fill:', params.staffMember.name);
    
    try {
      // Validation
      const validation = this.validationService.validateFillParams(params);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          messageType: MessageBarType.error,
          requiresDialog: false,
          canProceed: false,
          logResult: 1
        };
      }

      // Contract analysis
      const contractsAnalysis = await this.performContractsAnalysis(params);
      if (contractsAnalysis.activeContracts.length === 0) {
        return {
          success: false,
          message: 'No active contracts found for this staff member in the selected period.',
          messageType: MessageBarType.warning,
          requiresDialog: false,
          canProceed: false,
          logResult: 1
        };
      }

      const selectedContract = contractsAnalysis.activeContracts[0];

      // Pass analysis to generation service
      this.generationService.analyzeContracts(
        contractsAnalysis.allContracts,
        contractsAnalysis.activeContracts,
        selectedContract,
        params.selectedDate
      );

      // Check templates
      try {
        const weeklyTemplates = await this.generationService.loadWeeklyTemplates(
          selectedContract.id,
          params.dayOfStartWeek || 7,
          params.currentUserId || '0',
          params.managingGroupId || '0'
        );
        
        if (weeklyTemplates.length === 0) {
          return {
            success: false,
            message: 'No weekly schedule templates found for the selected contract after filtering.',
            messageType: MessageBarType.warning,
            requiresDialog: false,
            canProceed: false,
            logResult: 1,
            contractId: selectedContract.id
          };
        }
      } catch (templatesError) {
        return {
          success: false,
          message: `Error checking weekly templates: ${templatesError instanceof Error ? templatesError.message : String(templatesError)}`,
          messageType: MessageBarType.error,
          requiresDialog: false,
          canProceed: false,
          logResult: 1,
          contractId: selectedContract.id
        };
      }

      // Apply schedule logic
      const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
        params, selectedContract.id
      );

      // Return dialog result
      return {
        success: false,
        message: scheduleLogicResult.dialogConfig.message,
        messageType: scheduleLogicResult.dialogConfig.type === DialogType.ProcessedRecordsBlock 
          ? MessageBarType.error 
          : MessageBarType.info,
        requiresDialog: true,
        dialogConfig: scheduleLogicResult.dialogConfig,
        canProceed: scheduleLogicResult.canProceed,
        logResult: 3,
        contractId: selectedContract.id
      };

    } catch (error) {
      return {
        success: false,
        message: `Error checking schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        requiresDialog: false,
        canProceed: false,
        logResult: 1
      };
    }
  }

  // Contract analysis
  public async performContractsAnalysis(params: IFillParams): Promise<IContractsAnalysis> {
    const employeeId = params.staffMember.employeeId;
    const managerId = params.currentUserId || '';
    const groupId = params.managingGroupId || '';
    
    if (!employeeId || employeeId.trim() === '' || employeeId === '0') {
      return {
        allContracts: [],
        activeContracts: [],
        analysisDetails: ['ERROR: Invalid employee ID']
      };
    }
    
    const allContracts = await this.contractsService.getContractsForStaffMember(employeeId, managerId, groupId);
    const analysisDetails: string[] = [];
    
    analysisDetails.push(`CONTRACTS ANALYSIS FOR EMPLOYEE ${employeeId}:`);
    analysisDetails.push(`Selected Date: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    analysisDetails.push(`Total contracts found: ${allContracts.length}`);

    if (allContracts.length === 0) {
      analysisDetails.push('ERROR: No contracts found for this employee');
      return { allContracts, activeContracts: [], analysisDetails };
    }

    // Filter active contracts
    const activeContracts = allContracts.filter((contract: IContract) => 
      !contract.isDeleted && this.validationService.isContractActiveInMonth(contract, params.selectedDate)
    );

    analysisDetails.push(`Active contracts in period: ${activeContracts.length}`);
    if (activeContracts.length > 0) {
      const selected = activeContracts[0];
      analysisDetails.push(`Selected contract: ${selected.id} - ${selected.template || 'No name'}`);
    }

    return { allContracts, activeContracts, analysisDetails };
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

      // Quick validation
      const validation = this.validationService.validateFillParams(params);
      if (!validation.isValid) {
        return {
          eligible: false,
          reason: `Parameter validation failed: ${validation.errors.join(', ')}`,
          severity: 'ERROR'
        };
      }

      // Check contracts
      const contractsAnalysis = await this.performContractsAnalysis(params);
      if (contractsAnalysis.activeContracts.length === 0) {
        return {
          eligible: false,
          reason: 'No active contracts found for the selected period',
          severity: 'ERROR'
        };
      }

      // Check existing records
      const existingCheck = await this.validationService.checkExistingRecords(params);
      if (existingCheck.hasProcessedRecords) {
        return {
          eligible: false,
          reason: `Found ${existingCheck.processedCount} processed StaffRecords that cannot be replaced automatically`,
          severity: 'WARNING'
        };
      }

      // All checks passed
      const hasUnprocessedRecords = existingCheck.hasExistingRecords && !existingCheck.hasProcessedRecords;
      return {
        eligible: true,
        reason: hasUnprocessedRecords 
          ? `Ready for auto-fill (will replace ${existingCheck.recordsCount} unprocessed records)`
          : 'Ready for auto-fill (no existing records)',
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

  // Advanced validation methods
  public async validateContractEligibility(contractId: string, params: IFillParams): Promise<{
    eligible: boolean;
    reason: string;
    contract?: IContract;
    templates?: number;
  }> {
    try {
      const contractsAnalysis = await this.performContractsAnalysis(params);
      const contract = contractsAnalysis.allContracts.find(c => c.id === contractId);
      
      if (!contract) {
        return {
          eligible: false,
          reason: 'Contract not found'
        };
      }

      if (contract.isDeleted) {
        return {
          eligible: false,
          reason: 'Contract is deleted',
          contract
        };
      }

      if (!this.validationService.isContractActiveInMonth(contract, params.selectedDate)) {
        return {
          eligible: false,
          reason: 'Contract is not active in the selected period',
          contract
        };
      }

      // Check templates
      const weeklyTemplates = await this.generationService.loadWeeklyTemplates(
        contractId,
        params.dayOfStartWeek || 7,
        params.currentUserId || '0',
        params.managingGroupId || '0'
      );

      if (weeklyTemplates.length === 0) {
        return {
          eligible: false,
          reason: 'No weekly schedule templates found for this contract',
          contract,
          templates: 0
        };
      }

      return {
        eligible: true,
        reason: 'Contract is eligible for fill operation',
        contract,
        templates: weeklyTemplates.length
      };

    } catch (error) {
      return {
        eligible: false,
        reason: `Error validating contract: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  public async validateStaffMemberEligibility(params: IFillParams): Promise<{
    eligible: boolean;
    reason: string;
    details: {
      hasValidEmployeeId: boolean;
      autoScheduleEnabled: boolean;
      hasActiveContracts: boolean;
      contractsCount: number;
    };
  }> {
    const details = {
      hasValidEmployeeId: false,
      autoScheduleEnabled: false,
      hasActiveContracts: false,
      contractsCount: 0
    };

    try {
      // Check employee ID
      const employeeId = params.staffMember.employeeId;
      if (!employeeId || employeeId.trim() === '' || employeeId === '0') {
        return {
          eligible: false,
          reason: 'Invalid or missing employee ID',
          details
        };
      }
      details.hasValidEmployeeId = true;

      // Check auto schedule setting
      details.autoScheduleEnabled = params.staffMember.autoSchedule || false;

      // Check contracts
      const contractsAnalysis = await this.performContractsAnalysis(params);
      details.contractsCount = contractsAnalysis.allContracts.length;
      details.hasActiveContracts = contractsAnalysis.activeContracts.length > 0;

      if (!details.hasActiveContracts) {
        return {
          eligible: false,
          reason: 'No active contracts found for this staff member in the selected period',
          details
        };
      }

      return {
        eligible: true,
        reason: 'Staff member is eligible for fill operations',
        details
      };

    } catch (error) {
      return {
        eligible: false,
        reason: `Error validating staff member: ${error instanceof Error ? error.message : String(error)}`,
        details
      };
    }
  }

  public async validateFillParameters(params: IFillParams): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Basic parameter validation
      const basicValidation = this.validationService.validateFillParams(params);
      if (!basicValidation.isValid) {
        errors.push(...basicValidation.errors);
      }

      // Date validation
      const currentDate = new Date();
      const selectedDate = params.selectedDate;
      
      if (selectedDate < new Date(currentDate.getFullYear() - 1, 0, 1)) {
        warnings.push('Selected date is more than 1 year in the past');
      }
      
      if (selectedDate > new Date(currentDate.getFullYear() + 1, 11, 31)) {
        warnings.push('Selected date is more than 1 year in the future');
      }

      // Staff member validation
      const staffEligibility = await this.validateStaffMemberEligibility(params);
      if (!staffEligibility.eligible) {
        errors.push(`Staff member validation failed: ${staffEligibility.reason}`);
      }

      // Auto schedule recommendations
      if (!staffEligibility.details.autoScheduleEnabled) {
        recommendations.push('Consider enabling Auto Schedule for this staff member for automatic processing');
      }

      // Contract recommendations
      if (staffEligibility.details.contractsCount === 0) {
        recommendations.push('No contracts found - ensure staff member has valid contracts configured');
      } else if (staffEligibility.details.contractsCount > 1) {
        recommendations.push(`Multiple contracts found (${staffEligibility.details.contractsCount}) - first active contract will be used`);
      }

      // Context validation
      if (!params.currentUserId || params.currentUserId === '0') {
        warnings.push('No current user ID provided - may affect filtering and permissions');
      }

      if (!params.managingGroupId || params.managingGroupId === '0') {
        warnings.push('No managing group ID provided - may affect filtering and permissions');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        recommendations
      };

    } catch (error) {
      errors.push(`Error during parameter validation: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        errors,
        warnings,
        recommendations
      };
    }
  }

  // Analysis and reporting methods
  public async generateValidationReport(params: IFillParams): Promise<string> {
    try {
      const lines: string[] = [];
      
      lines.push('=== FILL VALIDATION REPORT WITH DATE-ONLY SUPPORT ===');
      lines.push(`Staff Member: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
      lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push('');

      // Parameter validation
      const paramValidation = await this.validateFillParameters(params);
      lines.push('PARAMETER VALIDATION:');
      lines.push(`Status: ${paramValidation.isValid ? 'VALID' : 'INVALID'}`);
      
      if (paramValidation.errors.length > 0) {
        lines.push('Errors:');
        paramValidation.errors.forEach(error => lines.push(`  ❌ ${error}`));
      }
      
      if (paramValidation.warnings.length > 0) {
        lines.push('Warnings:');
        paramValidation.warnings.forEach(warning => lines.push(`  ⚠️ ${warning}`));
      }
      
      if (paramValidation.recommendations.length > 0) {
        lines.push('Recommendations:');
        paramValidation.recommendations.forEach(rec => lines.push(`  💡 ${rec}`));
      }
      
      lines.push('');

      // Contract analysis
      const contractsAnalysis = await this.performContractsAnalysis(params);
      lines.push('CONTRACT ANALYSIS:');
      lines.push(`Total Contracts: ${contractsAnalysis.allContracts.length}`);
      lines.push(`Active Contracts: ${contractsAnalysis.activeContracts.length}`);
      
      if (contractsAnalysis.activeContracts.length > 0) {
        lines.push('Active Contracts Details:');
        contractsAnalysis.activeContracts.forEach((contract, index) => {
          lines.push(`  ${index + 1}. ${contract.id} - ${contract.template || 'No name'}`);
          lines.push(`     Status: Active in selected period`);
          lines.push(`     Deleted: ${contract.isDeleted ? 'Yes' : 'No'}`);
        });
      }
      
      lines.push('');

      // Auto-fill eligibility
      const autoFillEligibility = await this.checkAutoFillEligibility(params);
      lines.push('AUTO-FILL ELIGIBILITY:');
      lines.push(`Eligible: ${autoFillEligibility.eligible ? 'YES' : 'NO'}`);
      if (!autoFillEligibility.eligible) {
        lines.push(`Reason: ${autoFillEligibility.reason}`);
      }
      if (autoFillEligibility.contractId) {
        lines.push(`Contract ID: ${autoFillEligibility.contractId}`);
      }
      
      lines.push('');

      // Existing records check
      const existingCheck = await this.validationService.checkExistingRecords(params);
      lines.push('EXISTING RECORDS ANALYSIS:');
      lines.push(`Has Existing Records: ${existingCheck.hasExistingRecords ? 'YES' : 'NO'}`);
      if (existingCheck.hasExistingRecords) {
        lines.push(`Total Records: ${existingCheck.recordsCount}`);
        lines.push(`Processed Records: ${existingCheck.processedCount}`);
        lines.push(`Unprocessed Records: ${existingCheck.recordsCount - existingCheck.processedCount}`);
        lines.push(`Has Processed Records: ${existingCheck.hasProcessedRecords ? 'YES' : 'NO'}`);
      }
      
      lines.push('');

      // Overall assessment
      lines.push('OVERALL ASSESSMENT:');
      if (paramValidation.isValid && contractsAnalysis.activeContracts.length > 0) {
        if (autoFillEligibility.eligible) {
          lines.push('✅ Ready for fill operation (including auto-fill)');
        } else {
          lines.push('⚠️ Ready for manual fill operation only');
        }
      } else {
        lines.push('❌ Not ready for fill operation - resolve errors first');
      }
      
      lines.push('');
      lines.push('=== END OF VALIDATION REPORT ===');
      
      return lines.join('\n');

    } catch (error) {
      return `Error generating validation report: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Utility methods
  public buildContractsAnalysisLog(contractsAnalysis: IContractsAnalysis): string {
    return contractsAnalysis.analysisDetails.join('\n');
  }

  public async getContractsForPeriod(params: IFillParams): Promise<IContract[]> {
    const contractsAnalysis = await this.performContractsAnalysis(params);
    return contractsAnalysis.activeContracts;
  }

  public async hasValidContractsInPeriod(params: IFillParams): Promise<boolean> {
    const contractsAnalysis = await this.performContractsAnalysis(params);
    return contractsAnalysis.activeContracts.length > 0;
  }

  public async getFirstActiveContract(params: IFillParams): Promise<IContract | undefined> {
    const contractsAnalysis = await this.performContractsAnalysis(params);
    return contractsAnalysis.activeContracts.length > 0 ? contractsAnalysis.activeContracts[0] : undefined;
  }

  public getValidationServiceInfo(): {
    version: string;
    dateOnlySupport: boolean;
    capabilities: string[];
    servicesAvailable: {
      contracts: boolean;
      validation: boolean;
      generation: boolean;
      dateUtils: boolean;
    };
  } {
    return {
      version: '2.0.0-validation-module',
      dateOnlySupport: true,
      capabilities: [
        'Auto-fill eligibility checking',
        'Contract analysis and filtering',
        'Staff member validation',
        'Parameter validation with recommendations',
        'Existing records analysis',
        'Comprehensive validation reporting',
        'Quick validation checks',
        'Contract eligibility validation'
      ],
      servicesAvailable: {
        contracts: !!this.contractsService,
        validation: !!this.validationService,
        generation: !!this.generationService,
        dateUtils: !!this.dateUtils
      }
    };
  }
}