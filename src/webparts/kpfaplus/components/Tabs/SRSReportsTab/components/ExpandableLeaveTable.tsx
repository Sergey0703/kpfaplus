// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/components/ExpandableLeaveTable.tsx

import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  IconButton,
  Spinner,
  IIconProps
} from '@fluentui/react';
import {
  ISRSReportData,
  ISRSTableRow,
  IExpandableLeaveTableProps,
  MonthUtils,
  MONTH_ORDER
} from '../interfaces/ISRSReportsInterfaces';

// Иконки для expand/collapse
const expandIcon: IIconProps = { iconName: 'ChevronRight' };
const collapseIcon: IIconProps = { iconName: 'ChevronDown' };

/**
 * Компонент расширяемой таблицы для SRS Reports
 * Отображает данные с возможностью развертывания/сворачивания строк
 */
export const ExpandableLeaveTable: React.FC<IExpandableLeaveTableProps> = (props) => {
  const { reportData, isLoading, onExpandToggle, onRowClick } = props;

  // Состояние развернутых строк
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  console.log('[ExpandableLeaveTable] Rendering with props:', {
    reportDataCount: reportData.length,
    isLoading,
    expandedRowsCount: expandedRows.size
  });

  // Подготовка данных для таблицы
  const tableRows = useMemo(() => {
    if (!reportData || reportData.length === 0) {
      return [];
    }

    console.log('[ExpandableLeaveTable] Preparing table rows for', reportData.length, 'report data items');
    return prepareTableRows(reportData, expandedRows);
  }, [reportData, expandedRows]);

  // Обработчик toggle expand/collapse
  const handleExpandToggle = (rowId: string): void => {
    console.log('[ExpandableLeaveTable] Toggle expand for row:', rowId);
    
    const newExpandedRows = new Set(expandedRows);
    const isCurrentlyExpanded = expandedRows.has(rowId);

    if (isCurrentlyExpanded) {
      newExpandedRows.delete(rowId);
    } else {
      newExpandedRows.add(rowId);
    }

    setExpandedRows(newExpandedRows);

    // Уведомляем родительский компонент
    if (onExpandToggle) {
      onExpandToggle(rowId, !isCurrentlyExpanded);
    }
  };

  // Проверка развернутости строки
  const isRowExpanded = (rowId: string): boolean => {
    return expandedRows.has(rowId);
  };

  // Обработчик клика по строке
  const handleRowClick = (row: ISRSTableRow): void => {
    console.log('[ExpandableLeaveTable] Row clicked:', row.id, row.rowType);
    
    if (onRowClick) {
      onRowClick(row);
    }

    // Если кликнули по summary строке, переключаем expand
    if (row.rowType === 'summary') {
      handleExpandToggle(row.id);
    }
  };

  // Определение колонок таблицы - МАКСИМАЛЬНО КОМПАКТНЫЕ РАЗМЕРЫ
  const columns: IColumn[] = [
    {
      key: 'staffName',
      name: 'Staff Name',
      fieldName: 'staffName',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: ISRSTableRow): JSX.Element => {
        const isExpanded = isRowExpanded(item.id);
        const showExpandButton = item.rowType === 'summary' && item.expandData && item.expandData.detailRows.length > 0;
        
        return (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            paddingLeft: item.rowType === 'detail' ? '15px' : '0px',
            fontSize: '11px'
          }}>
            {showExpandButton && (
              <IconButton
                iconProps={isExpanded ? collapseIcon : expandIcon}
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpandToggle(item.id);
                }}
                styles={{
                  root: {
                    width: '20px',
                    height: '20px',
                    marginRight: '5px'
                  }
                }}
                title={isExpanded ? 'Collapse details' : 'Expand details'}
              />
            )}
            {!showExpandButton && item.rowType === 'summary' && (
              <div style={{ width: '25px' }} />
            )}
            <span style={{ 
              fontWeight: item.rowType === 'summary' ? '600' : 'normal',
              color: item.rowType === 'detail' ? '#666' : 'inherit',
              fontSize: '11px',
              lineHeight: '1.2'
            }}>
              {item.staffName}
            </span>
          </div>
        );
      }
    },
    {
      key: 'contract',
      name: 'Contract',
      fieldName: 'contract',
      minWidth: 65,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: ISRSTableRow): JSX.Element => (
        <span style={{
          fontWeight: item.rowType === 'summary' ? '500' : 'normal',
          color: item.rowType === 'detail' ? '#666' : 'inherit',
          fontSize: '10px',
          lineHeight: '1.2'
        }}>
          {item.contract}
        </span>
      )
    },
    {
      key: 'contractedHours',
      name: 'Contract Hrs',
      fieldName: 'contractedHours',
      minWidth: 40,
      maxWidth: 50,
      onRender: (item: ISRSTableRow): JSX.Element => (
        <span style={{ 
          textAlign: 'center', 
          display: 'block',
          color: item.rowType === 'detail' ? '#666' : 'inherit',
          fontSize: '10px'
        }}>
          {item.contractedHours}
        </span>
      )
    },
    {
      key: 'annualLeaveFromPrevious',
      name: 'Annual Leave',
      fieldName: 'annualLeaveFromPrevious',
      minWidth: 40,
      maxWidth: 55,
      onRender: (item: ISRSTableRow): JSX.Element => (
        <span style={{ 
          textAlign: 'center', 
          display: 'block', 
          fontWeight: item.rowType === 'summary' ? '600' : 'normal',
          color: item.rowType === 'summary' ? '#0078d4' : '#666',
          fontSize: '10px'
        }}>
          {item.annualLeaveFromPrevious}
        </span>
      )
    },
    {
      key: 'dateColumn',
      name: 'Date',
      fieldName: 'dateColumn',
      minWidth: 45,
      maxWidth: 60,
      onRender: (item: ISRSTableRow): JSX.Element => (
        <span style={{ 
          textAlign: 'center', 
          display: 'block',
          fontWeight: item.dateColumn ? '500' : 'normal',
          color: item.dateColumn ? '#323130' : '#666',
          fontSize: '9px'
        }}>
          {item.dateColumn || ''}
        </span>
      )
    },
    // Месячные колонки - МАКСИМАЛЬНО КОМПАКТНЫЕ
    ...MONTH_ORDER.map(monthKey => ({
      key: monthKey,
      name: monthKey.charAt(0).toUpperCase() + monthKey.slice(1, 3), // Сокращаем названия месяцев до 3 букв
      fieldName: monthKey,
      minWidth: 28,
      maxWidth: 32,
      onRender: (item: ISRSTableRow): JSX.Element => {
        const value = item[monthKey as keyof ISRSTableRow] as number;
        const hasValue = value > 0;
        
        return (
          <span style={{ 
            textAlign: 'center', 
            display: 'block',
            fontWeight: hasValue && item.rowType === 'summary' ? '600' : 'normal',
            color: hasValue ? (item.rowType === 'summary' ? '#323130' : '#666') : '#a19f9d',
            fontSize: '10px', // ИСПРАВЛЕНО: увеличен с 8px до 10px
            lineHeight: '1.1'
          }}>
            {value || ''}
          </span>
        );
      }
    })),
    {
      key: 'balanceRemainingInHrs',
      name: 'Balance',
      fieldName: 'balanceRemainingInHrs',
      minWidth: 45,
      maxWidth: 60,
      onRender: (item: ISRSTableRow): JSX.Element => (
        <span style={{ 
          textAlign: 'center', 
          display: 'block', 
          fontWeight: item.rowType === 'summary' ? '600' : 'normal',
          color: item.balanceRemainingInHrs < 0 
            ? '#d83b01' 
            : (item.rowType === 'summary' ? '#107c10' : '#666'),
          fontSize: '10px'
        }}>
          {item.balanceRemainingInHrs}
        </span>
      )
    }
  ];

  // Обработка загрузки
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spinner size={1} />
        <p style={{ marginTop: '10px', color: '#666' }}>Loading SRS reports data...</p>
      </div>
    );
  }

  // Обработка пустых данных
  if (!reportData || reportData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No staff records found with leave types for the selected criteria.</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Try adjusting your filters or select a different period.
        </p>
      </div>
    );
  }

  console.log('[ExpandableLeaveTable] Rendering table with', tableRows.length, 'rows');

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing {reportData.length} contract(s) with leave data | 
        Expanded: {expandedRows.size} | 
        Total rows: {tableRows.length}
      </p>
      
      <DetailsList
        items={tableRows}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={true}
        onItemInvoked={handleRowClick}
        styles={{
          root: {
            selectors: {
              '.ms-DetailsHeader': {
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #dee2e6'
              },
              '.ms-DetailsHeader-cell': {
                fontSize: '11px',
                fontWeight: '600',
                color: '#495057',
                padding: '4px 8px'
              },
              '.ms-DetailsRow': {
                selectors: {
                  ':hover': {
                    backgroundColor: '#f8f9fa'
                  }
                }
              },
              '.ms-DetailsRow-cell': {
                fontSize: '10px',
                padding: '6px 8px'
              }
            }
          }
        }}
      />
    </div>
  );
};

/**
 * Подготовка данных для таблицы
 * Преобразует ISRSReportData[] в ISRSTableRow[] с учетом развернутых строк
 */
function prepareTableRows(
  reportData: ISRSReportData[], 
  expandedRows: Set<string>
): ISRSTableRow[] {
  const tableRows: ISRSTableRow[] = [];

  reportData.forEach(data => {
    // Создаем summary строку
    const summaryRow = createSummaryRow(data);
    tableRows.push(summaryRow);

    // Если строка развернута, добавляем detail строки
    if (expandedRows.has(data.id)) {
      const detailRows = createDetailRows(data);
      tableRows.push(...detailRows);
    }
  });

  return tableRows;
}

/**
 * Создание summary строки из ISRSReportData
 */
function createSummaryRow(data: ISRSReportData): ISRSTableRow {
  return {
    id: data.id,
    staffId: data.staffId,
    staffName: data.staffName,
    contract: data.contractName,
    contractedHours: data.contractedHours,
    annualLeaveFromPrevious: data.annualLeaveFromPrevious,
    dateColumn: '', // Пустая дата для summary строки
    jan: data.monthlyLeaveHours.jan,
    feb: data.monthlyLeaveHours.feb,
    mar: data.monthlyLeaveHours.mar,
    apr: data.monthlyLeaveHours.apr,
    may: data.monthlyLeaveHours.may,
    jun: data.monthlyLeaveHours.jun,
    jul: data.monthlyLeaveHours.jul,
    aug: data.monthlyLeaveHours.aug,
    sep: data.monthlyLeaveHours.sep,
    oct: data.monthlyLeaveHours.oct,
    nov: data.monthlyLeaveHours.nov,
    dec: data.monthlyLeaveHours.dec,
    balanceRemainingInHrs: data.balanceRemainingInHrs,
    rowType: 'summary',
    expandData: {
      detailRows: data.leaveRecords,
      isExpanded: false // Будет обновлено в компоненте
    }
  };
}

/**
 * Создание detail строк из записей отпуска
 * Пока создаем заглушки, в Этапе 5 добавим реальную детализацию
 */
function createDetailRows(data: ISRSReportData): ISRSTableRow[] {
  // Пока возвращаем заглушки для демонстрации expand/collapse
  // В Этапе 5 здесь будет реальная логика создания detail строк
  
  const detailRows: ISRSTableRow[] = [];
  
  // Создаем по одной detail строке для каждой записи отпуска
  data.leaveRecords.forEach((leaveRecord, index) => {
    // Создаем пустую месячную структуру
    const emptyMonths = MonthUtils.createEmptyMonthlyData();
    
    // Заполняем только соответствующий месяц
    emptyMonths[leaveRecord.monthKey] = leaveRecord.hours;

    const detailRow: ISRSTableRow = {
      id: `${data.id}_detail_${index}`,
      staffId: data.staffId,
      staffName: data.staffName,
      contract: data.contractName,
      contractedHours: data.contractedHours,
      annualLeaveFromPrevious: data.annualLeaveFromPrevious,
      dateColumn: MonthUtils.formatDateForTable(leaveRecord.date),
      jan: emptyMonths.jan,
      feb: emptyMonths.feb,
      mar: emptyMonths.mar,
      apr: emptyMonths.apr,
      may: emptyMonths.may,
      jun: emptyMonths.jun,
      jul: emptyMonths.jul,
      aug: emptyMonths.aug,
      sep: emptyMonths.sep,
      oct: emptyMonths.oct,
      nov: emptyMonths.nov,
      dec: emptyMonths.dec,
      balanceRemainingInHrs: data.balanceRemainingInHrs, // Тот же баланс
      rowType: 'detail',
      parentId: data.id
    };

    detailRows.push(detailRow);
  });

  console.log(`[ExpandableLeaveTable] Created ${detailRows.length} detail rows for ${data.id}`);
  return detailRows;
}