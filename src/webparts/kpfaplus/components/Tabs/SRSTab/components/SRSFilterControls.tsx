// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSFilterControls.tsx

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react';
import { CustomDatePicker } from '../../../CustomDatePicker/CustomDatePicker';
import { ISRSFilterControlsProps } from '../utils/SRSTabInterfaces';

export const SRSFilterControls: React.FC<ISRSFilterControlsProps> = (props) => {
  const {
    fromDate,
    toDate,
    totalHours,
    isLoading,
    onFromDateChange,
    onToDateChange,
    onRefresh,
    onExportAll,
    onSave,
    onSaveChecked,
    hasChanges,
    hasCheckedItems
  } = props;

  console.log('[SRSFilterControls] Rendering with props:', {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    totalHours,
    isLoading,
    hasChanges,
    hasCheckedItems
  });

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Строка с датапикерами и кнопкой Refresh */}
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
      </div>

      {/* Total Hours и кнопки управления */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        {/* Total Hours */}
        <div style={{
          color: '#d83b01',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          Total Hours: {totalHours}
        </div>

        {/* Кнопки управления */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px'
        }}>
          {/* Export All SRS */}
          <DefaultButton
            text="Export all SRS"
            onClick={onExportAll}
            disabled={isLoading}
            styles={{
              root: {
                backgroundColor: '#0078d4',
                color: 'white',
                border: 'none',
                minWidth: '120px',
                height: '28px',
                fontSize: '12px'
              },
              rootHovered: {
                backgroundColor: '#106ebe',
                color: 'white'
              }
            }}
          />

          {/* Кнопки Save */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <PrimaryButton
              text="💾 Save"
              onClick={onSave}
              disabled={isLoading || !hasChanges}
              styles={{
                root: {
                  backgroundColor: hasChanges ? '#0078d4' : '#f3f2f1',
                  color: hasChanges ? 'white' : '#a19f9d',
                  border: 'none',
                  minWidth: '80px',
                  height: '28px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                },
                rootHovered: hasChanges ? {
                  backgroundColor: '#106ebe',
                  color: 'white'
                } : undefined
              }}
            />

            <PrimaryButton
              text="All in Checked & Save"
              onClick={onSaveChecked}
              disabled={isLoading || !hasCheckedItems}
              styles={{
                root: {
                  backgroundColor: hasCheckedItems ? '#0078d4' : '#f3f2f1',
                  color: hasCheckedItems ? 'white' : '#a19f9d',
                  border: 'none',
                  minWidth: '140px',
                  height: '28px',
                  fontSize: '12px'
                },
                rootHovered: hasCheckedItems ? {
                  backgroundColor: '#106ebe',
                  color: 'white'
                } : undefined
              }}
            />
          </div>
        </div>
      </div>

      {/* Разделительная линия */}
      <div style={{
        height: '1px',
        backgroundColor: '#e0e0e0',
        margin: '10px 0'
      }} />
    </div>
  );
};