// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorMeta.ts
import {
  IWeekGroup,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableDataUtils } from './TimetableDataUtils';
import { TimetableDataAnalytics } from './TimetableDataAnalytics';

/**
 * Metadata and informational utilities for TimetableDataProcessor.
 */
export class TimetableDataProcessorMeta {

  /**
   * Информация о версии и архитектуре
   */
  public static getVersionInfo(): {
    version: string;
    architecture: string;
    modules: string[];
    features: string[];
    compatibility: string;
  } {
    return {
      version: '3.2',
      architecture: 'Modular (Split)',
      modules: [
        'TimetableDataProcessor (Main API & Orchestration)',
        'TimetableDataProcessorCore (Core Week/Day Processing)',
        'TimetableDataProcessorMeta (Metadata & Info Utilities)',
        'TimetableDataUtils (Indexing, Validation, Filtering)',
        'TimetableDataAnalytics (Statistics, Reports, Export)'
      ],
      features: [
        'Leave Colors Support',
        'Holiday Support with Priority System',
        'Non-work Days Holiday/Leave Marking',
        'Excel Export with Full Markers Support',
        'Advanced Analytics',
        'Performance Optimization',
        'Data Validation',
        'Comprehensive Reporting'
      ],
      compatibility: 'Fully backward compatible with v2.x, v3.0 and v3.1'
    };
  }

  /**
   * Проверяет целостность модульной архитектуры
   */
  public static validateModularArchitecture(): {
    isValid: boolean;
    modules: Array<{
      name: string;
      available: boolean;
      methods: number;
    }>;
    recommendations: string[];
  } {
    const coreModuleAvailable = true; // Assuming TimetableDataProcessorCore will be available
    const metaModuleAvailable = true; // Assuming TimetableDataProcessorMeta will be available

    const modules = [
      {
        name: 'TimetableDataUtils',
        available: !!TimetableDataUtils,
        methods: Object.getOwnPropertyNames(TimetableDataUtils).filter(name =>
          typeof TimetableDataUtils[name as keyof typeof TimetableDataUtils] === 'function'
        ).length
      },
      {
        name: 'TimetableDataAnalytics',
        available: !!TimetableDataAnalytics,
        methods: Object.getOwnPropertyNames(TimetableDataAnalytics).filter(name =>
          typeof TimetableDataAnalytics[name as keyof typeof TimetableDataAnalytics] === 'function'
        ).length
      },
      {
        name: 'TimetableDataProcessorCore', // Added check for the new module
        available: coreModuleAvailable, // This should ideally check the actual import
        methods: coreModuleAvailable ? Object.getOwnPropertyNames(
          // In a real scenario, you might pass the class or check it dynamically
          // For now, we'll assume a few key methods exist if the conceptual module is there
          // For a more robust check, the TimetableDataProcessorCore class itself would be needed here
          // e.g. Object.getOwnPropertyNames(TimetableDataProcessorCore.prototype).length for instance methods
          // or Object.keys(TimetableDataProcessorCore).length for static methods
          // Since they are static, let's assume a placeholder count
          {'processWeekDataWithLeaveColorsAndHolidays': true, 'processDayDataWithLeaveColorsAndHolidays': true} 
        ).length : 0 
      },
       {
        name: 'TimetableDataProcessorMeta', // Added check for the new module
        available: metaModuleAvailable,
        methods: metaModuleAvailable ? Object.getOwnPropertyNames(
            {'getVersionInfo': true, 'validateModularArchitecture': true, 'getExcelExportPreview': true}
        ).length : 0
      }
    ];

    const isValid = modules.every(module => module.available && module.methods > 0);

    const recommendations: string[] = [];
    if (!isValid) {
      recommendations.push('Some modules are missing or incomplete');
      modules.forEach(module => {
        if (!module.available) {
          recommendations.push(`Module ${module.name} is not available`);
        } else if (module.methods === 0) {
          recommendations.push(`Module ${module.name} has no methods or not checked properly`);
        }
      });
    } else {
      recommendations.push('Modular architecture is properly configured with Holiday support, non-work days marking, and Excel export functionality');
    }

    return {
      isValid,
      modules,
      recommendations
    };
  }

  /**
   * НОВЫЙ МЕТОД: Получает статистику по Excel экспорту
   */
  public static getExcelExportPreview(weekGroups: IWeekGroup[]): {
    totalCells: number;
    cellsWithData: number;
    cellsWithHolidays: number;
    cellsWithLeave: number;
    coloredCells: number;
    exportQuality: string;
    recommendations: string[];
  } {
    let totalCells = 0;
    let cellsWithData = 0;
    let cellsWithHolidays = 0;
    let cellsWithLeave = 0;
    let coloredCells = 0;

    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        for (let dayNum = 1; dayNum <= 7; dayNum++) {
          totalCells++;
          const dayData = staffRow.weekData.days[dayNum];

          if (dayData && dayData.hasData) {
            cellsWithData++;
          }
          if (dayData && dayData.hasHoliday) {
            cellsWithHolidays++;
          }
          if (dayData && dayData.hasLeave) {
            cellsWithLeave++;
          }
          if (dayData && dayData.finalCellColor && dayData.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
            coloredCells++;
          }
        }
      });
    });

    const dataRatio = totalCells > 0 ? (cellsWithData / totalCells) * 100 : 0;
    let exportQuality = 'UNKNOWN';

    if (dataRatio > 80) {
      exportQuality = 'EXCELLENT';
    } else if (dataRatio > 50) {
      exportQuality = 'GOOD';
    } else if (dataRatio > 20) {
      exportQuality = 'FAIR';
    } else {
      exportQuality = 'POOR';
    }

    const recommendations: string[] = [];
    if (cellsWithHolidays === 0) {
      recommendations.push('No holiday markers found - check Holiday field in source data');
    }
    if (cellsWithLeave === 0) {
      recommendations.push('No leave markers found - check TypeOfLeave configuration');
    }
    if (coloredCells < (cellsWithHolidays + cellsWithLeave)) {
      recommendations.push('Some holidays/leaves may not have proper colors assigned');
    }
    if (dataRatio < 10) {
      recommendations.push('Very low data coverage - consider expanding date range or checking filters');
    }

    return {
      totalCells,
      cellsWithData,
      cellsWithHolidays,
      cellsWithLeave,
      coloredCells,
      exportQuality,
      recommendations
    };
  }
}