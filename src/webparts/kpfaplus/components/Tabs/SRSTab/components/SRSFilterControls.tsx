// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSFilterControls.tsx

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react';
import { CustomDatePicker } from '../../../CustomDatePicker/CustomDatePicker';
import { ISRSFilterControlsProps } from '../utils/SRSTabInterfaces';

export const SRSFilterControls: React.FC<ISRSFilterControlsProps> = (props) => {
  const {
    fromDate,
    toDate,
    calculatedTotalHours, // *** ИЗМЕНЕНО: calculatedTotalHours вместо totalHours ***
    isLoading,
    onFromDateChange,
    onToDateChange,
    onRefresh,
    onExportAll,
    onSave,
    onSaveChecked,
    hasChanges,
    hasCheckedItems,
    // *** НОВОЕ: Поддержка состояния Export All прогресса ***
    isExportAllInProgress
  } = props;

  console.log('[SRSFilterControls] Rendering with REAL-TIME TOTAL HOURS and EXPORT ALL DIALOG SUPPORT:', {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    calculatedTotalHours, // *** ИЗМЕНЕНО: calculatedTotalHours вместо totalHours ***
    isLoading,
    hasChanges,
    hasCheckedItems,
    realTimeCalculation: true, // *** НОВОЕ: Индикатор вычисления в реальном времени ***
    isExportAllInProgress, // *** НОВОЕ: Состояние Export All прогресса ***
    exportAllDialogSupport: true // *** НОВОЕ: Поддержка диалога Export All ***
  });

  return (
    <div style={{ marginBottom: '15px' }}>
      {/* Строка с датапикерами, кнопкой Refresh и Export All SRS */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '15px',
        marginBottom: '15px',
        flexWrap: 'wrap'
      }}>
        {/* From Date */}
        <div style={{ minWidth: '150px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>
            From:
          </div>
          <CustomDatePicker
            value={fromDate}
            onChange={onFromDateChange}
            disabled={isLoading}
            placeholder="Select from date"
            showGoToToday={true}
            data-testid="srs-from-date-picker"
            styles={{
              root: { width: '140px' }
            }}
          />
        </div>

        {/* To Date */}
        <div style={{ minWidth: '150px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>
            To:
          </div>
          <CustomDatePicker
            value={toDate}
            onChange={onToDateChange}
            disabled={isLoading}
            placeholder="Select to date"
            showGoToToday={true}
            data-testid="srs-to-date-picker"
            styles={{
              root: { width: '140px' }
            }}
          />
        </div>

        {/* Refresh Button */}
        <DefaultButton
          text="Refresh"
          onClick={onRefresh}
          disabled={isLoading}
          styles={{
            root: {
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              minWidth: '80px',
              height: '32px'
            },
            rootHovered: {
              backgroundColor: '#106ebe',
              color: 'white'
            }
          }}
        />

        {/* *** ОБНОВЛЕНО: Export All SRS Button - теперь с поддержкой диалога подтверждения и состояния прогресса *** */}
        <DefaultButton
          text={isExportAllInProgress ? "Exporting..." : "Export all SRS"}
          onClick={onExportAll}
          disabled={isLoading || isExportAllInProgress} // *** НОВОЕ: Блокируем во время экспорта ***
          styles={{ 
            root: { 
              backgroundColor: isExportAllInProgress ? '#f3f2f1' : '#0078d4', // *** НОВОЕ: Изменяем цвет во время экспорта ***
              color: isExportAllInProgress ? '#a19f9d' : 'white', // *** НОВОЕ: Изменяем цвет текста ***
              border: 'none',
              minWidth: '120px',
              height: '32px',
              fontSize: '12px',
              cursor: isExportAllInProgress ? 'not-allowed' : 'pointer' // *** НОВОЕ: Изменяем курсор ***
            },
            rootHovered: !isLoading && !isExportAllInProgress ? { // *** НОВОЕ: Hover только если не экспортируем ***
              backgroundColor: '#106ebe',
              color: 'white'
            } : undefined
          }}
        />
      </div>

      {/* *** ОБНОВЛЕНО: Total Hours теперь получает вычисленное значение в реальном времени *** */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px' // Reduced from 15px to 10px
      }}>
        {/* Total Hours - теперь с real-time вычислением */}
        <div style={{
          color: '#d83b01',
          fontWeight: '600',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>Total Hours: {calculatedTotalHours}</span>
          {/* *** НОВОЕ: Индикатор real-time вычисления *** */}
          <span style={{
            fontSize: '11px',
            color: '#107c10',
            fontWeight: 'normal',
            padding: '2px 6px',
            backgroundColor: '#f0f9f0',
            borderRadius: '3px',
            border: '1px solid #c7e0c7'
          }}>
            Real-time
          </span>
          {/* *** НОВОЕ: Индикатор Export All прогресса *** */}
          {isExportAllInProgress && (
            <span style={{
              fontSize: '11px',
              color: '#0078d4',
              fontWeight: 'normal',
              padding: '2px 6px',
              backgroundColor: '#f0f6ff',
              borderRadius: '3px',
              border: '1px solid #c7e4f9'
            }}>
              Export All in progress...
            </span>
          )}
        </div>

        {/* Кнопки Save */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <PrimaryButton
            text="💾 Save"
            onClick={onSave}
            disabled={isLoading || !hasChanges || isExportAllInProgress} // *** НОВОЕ: Блокируем во время Export All ***
            styles={{
              root: {
                backgroundColor: hasChanges && !isExportAllInProgress ? '#0078d4' : '#f3f2f1', // *** НОВОЕ: Учитываем Export All прогресс ***
                color: hasChanges && !isExportAllInProgress ? 'white' : '#a19f9d',
                border: 'none',
                minWidth: '80px',
                height: '28px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              },
              rootHovered: hasChanges && !isExportAllInProgress ? {
                backgroundColor: '#106ebe',
                color: 'white'
              } : undefined
            }}
          />

          <PrimaryButton
            text="All in Checked & Save"
            onClick={onSaveChecked}
            disabled={isLoading || !hasCheckedItems || isExportAllInProgress} // *** НОВОЕ: Блокируем во время Export All ***
            styles={{
              root: {
                backgroundColor: hasCheckedItems && !isExportAllInProgress ? '#0078d4' : '#f3f2f1', // *** НОВОЕ: Учитываем Export All прогресс ***
                color: hasCheckedItems && !isExportAllInProgress ? 'white' : '#a19f9d',
                border: 'none',
                minWidth: '140px',
                height: '28px',
                fontSize: '12px'
              },
              rootHovered: hasCheckedItems && !isExportAllInProgress ? {
                backgroundColor: '#106ebe',
                color: 'white'
              } : undefined
            }}
          />
        </div>
      </div>

      {/* Removed the horizontal line - this line was deleted */}
    </div>
  );
};