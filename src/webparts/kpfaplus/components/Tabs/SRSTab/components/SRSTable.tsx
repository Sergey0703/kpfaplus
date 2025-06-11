// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTable.tsx

import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import { ISRSTableProps } from '../utils/SRSTabInterfaces';
import { SRSTableRow } from './SRSTableRow';

export const SRSTable: React.FC<ISRSTableProps> = (props) => {
  const {
    items,
    options,
    isLoading,
    onItemChange
    // Убираем неиспользуемые: onItemCheck, onSelectAll, allSelected, hasSelectedItems
  } = props;

  console.log('[SRSTable] Rendering with items count:', items.length);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        <Spinner size={SpinnerSize.large} label="Loading SRS data..." />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ 
        borderSpacing: '0', 
        borderCollapse: 'collapse', 
        width: '100%', 
        tableLayout: 'fixed',
        border: '2px solid black'
      }}>
        <colgroup>
          <col style={{ width: '100px' }} /> {/* Date */}
          <col style={{ width: '60px' }} />  {/* Hrs */}
          <col style={{ width: '60px' }} />  {/* Relief? */}
          <col style={{ width: '150px' }} /> {/* Start Work */}
          <col style={{ width: '150px' }} /> {/* Finish Work */}
          <col style={{ width: '100px' }} /> {/* Lunch */}
          <col style={{ width: '150px' }} /> {/* Type of Leave */}
          <col style={{ width: '100px' }} /> {/* Time Leave (h) */}
          <col style={{ width: '70px' }} />  {/* Shift */}
          <col style={{ width: '60px' }} />  {/* Contract */}
          <col style={{ width: '50px' }} />  {/* Check */}
          <col style={{ width: '50px' }} />  {/* SRS */}
        </colgroup>

        <thead>
          <tr>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'left',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Date</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Hrs</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Relief?</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Start Work</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Finish Work</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Lunch</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Type of Leave</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Time Leave (h)</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Shift</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Contract</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>Check</th>
            <th style={{ 
              backgroundColor: '#f0f0f0',
              padding: '5px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid black'
            }}>SRS</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td 
                colSpan={12} 
                style={{
                  textAlign: 'center',
                  padding: '40px',
                  fontSize: '14px',
                  color: '#666',
                  fontStyle: 'italic',
                  border: '1px solid black'
                }}
              >
                No SRS records found for the selected date range.
                <br />
                Please adjust the date range and click Refresh.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <SRSTableRow
                key={item.id}
                item={item}
                options={options}
                isEven={index % 2 === 0}
                onItemChange={onItemChange}
                // ИСПРАВЛЕНО: Убрали onItemCheck, так как он не определен в ISRSTableRowProps
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};