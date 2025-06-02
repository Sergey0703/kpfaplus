// src/webparts/kpfaplus/components/Tabs/TimetableTab/TimetableTab.tsx
import * as React from 'react'; // Необходим для JSX
import { 
  DatePicker, 
  DayOfWeek, 
  MessageBar,
  MessageBarType,
  Spinner
} from '@fluentui/react';
import { ITabProps } from '../../../models/types'; // Убедитесь, что этот путь корректен
import { TIMETABLE_COLORS } from './interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './utils/TimetableWeekCalculator';
import { 
  TimetableWeekGroup, 
  TimetableExpandControls 
} from './components/TimetableWeekGroup'; // Убедитесь, что этот путь корректен
import { useTimetableLogic, ITimetableLogicProps } from './useTimetableLogic';
import { calendarMinWidth, datePickerStringsEN, formatDate } from './timetableTabUtils';

// Экспортируем интерфейс пропсов, если он нужен где-то еще, или оставляем неэкспортированным
export interface ITimetableTabProps extends ITabProps {
  // Дополнительные пропсы для таблицы времени, если понадобятся
}

// ИМЕНОВАННЫЙ ЭКСПОРТ компонента
const TimetableTabComponent: React.FC<ITimetableTabProps> = (props) => {
  const { managingGroupId, currentUserId, dayOfStartWeek } = props;

  const {
    state,
    setState, 
    typesOfLeave,
    isLoadingTypesOfLeave,
    getLeaveTypeColor,
    weeks, 
    refreshTimetableData,
    handleMonthChange,
    handleExportToExcel,
    statistics,
    toggleWeekExpand,
    expandAllWeeks,
    collapseAllWeeks,
    staffMembers,
    getLeaveTypeTitle 
  } = useTimetableLogic(props as ITimetableLogicProps); // Приведение типа здесь допустимо

  // *** ОБНОВЛЕННОЕ ЛОГИРОВАНИЕ С ИНФОРМАЦИЕЙ О СОХРАНЕНИИ ДАТЫ ***
  console.log('[TimetableTab] Rendering with DATE PERSISTENCE v3.8:', {
    hasWeeksData: state.weeksData.length > 0,
    isLoading: state.isLoadingStaffRecords,
    hasError: !!state.errorStaffRecords,
    statistics,
    typesOfLeaveLoaded: typesOfLeave.length,
    selectedDate: state.selectedDate.toLocaleDateString(),
    dateSource: 'sessionStorage or first day of current month default', // *** НОВОЕ ***
    datePersistence: 'Enabled - selected date will be remembered', // *** НОВОЕ ***
    version: 'v3.8 - Added date persistence + Fixed leave type names display and colors'
  });

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Заголовок */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#323130', fontSize: '24px', fontWeight: '600' }}>
          Staff Timetable - Week Groups View
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px', lineHeight: '1.4' }}>
          Group ID: {managingGroupId} | Current User ID: {currentUserId} | 
          Week starts on day: {dayOfStartWeek} | 
          Staff count: {statistics.staffCount} | 
          Records: {statistics.recordsCount}
          {/* *** НОВОЕ: Показываем информацию о выбранной дате *** */}
          {' | Selected: ' + state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Панель настроек */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e1e5e9',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Выбор месяца */}
        <div style={{ minWidth: '220px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>Select Month</div>
          <DatePicker
            value={state.selectedDate}
            onSelectDate={handleMonthChange}
            firstDayOfWeek={DayOfWeek.Monday}
            strings={datePickerStringsEN}
            formatDate={formatDate}
            allowTextInput={false}
            disabled={state.isLoadingStaffRecords || isLoadingTypesOfLeave}
            showGoToToday={true}
            showMonthPickerAsOverlay={true}
            styles={{
              root: { width: '220px' },
              textField: {
                width: '100%',
                height: '32px',
                selectors: {
                  '.ms-TextField-field': { height: '32px' },
                },
              },
              callout: {
                minWidth: calendarMinWidth
              }
            }}
          />
        </div>
        
        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.3' }}>
          <div>Selected month: {state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          <div>{statistics.totalWeeks} weeks with data | {weeks.length} total in month</div> {/* Уточнил для ясности */}
          <div>Expanded: {statistics.expandedCount} weeks</div>
          {/* *** НОВОЕ: Показываем статус сохранения даты *** */}
          <div style={{ color: '#107c10', fontSize: '11px', fontStyle: 'italic' }}>
            📅 Date will be remembered
          </div>
        </div>
        
        <div>
          <button
            onClick={() => {
              console.log('[TimetableTab] Manual refresh requested with DATE PERSISTENCE v3.8');
              refreshTimetableData().catch(error => {
                console.error('[TimetableTab] Manual refresh failed:', error);
              });
            }}
            disabled={state.isLoadingStaffRecords || isLoadingTypesOfLeave}
            style={{
              padding: '8px 16px',
              backgroundColor: state.isLoadingStaffRecords || isLoadingTypesOfLeave ? '#f3f2f1' : '#0078d4',
              color: state.isLoadingStaffRecords || isLoadingTypesOfLeave ? '#a19f9d' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isLoadingStaffRecords || isLoadingTypesOfLeave ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s ease'
            }}
          >
            {state.isLoadingStaffRecords || isLoadingTypesOfLeave ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>

        <div>
          <button
            onClick={() => {
              console.log('[TimetableTab] Excel export requested with DATE PERSISTENCE v3.8');
              handleExportToExcel().catch(error => {
                console.error('[TimetableTab] Export button error:', error);
              });
            }}
            disabled={state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave}
            style={{
              padding: '8px 16px',
              backgroundColor: state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave ? '#f3f2f1' : '#107c10',
              color: state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave ? '#a19f9d' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s ease'
            }}
            title="Export to Excel with Holiday/Leave markers (v3.8 with date persistence)"
          >
            {state.isLoadingStaffRecords || isLoadingTypesOfLeave ? 'Loading...' : 'Export to Excel'}
          </button>
        </div>
        
        {(state.isLoadingStaffRecords || isLoadingTypesOfLeave) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size={1} />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {isLoadingTypesOfLeave ? 'Loading leave types...' : 'Loading staff records...'}
            </span>
          </div>
        )}

        {/* *** ОБНОВЛЕНО v3.8: Индикатор статуса типов отпусков с информацией о дате *** */}
        <div style={{ 
          fontSize: '11px', 
          color: '#666',
          backgroundColor: typesOfLeave.length > 0 ? '#d4edda' : '#fff3cd',
          padding: '4px 8px',
          borderRadius: '3px',
          border: `1px solid ${typesOfLeave.length > 0 ? '#c3e6cb' : '#ffeaa7'}`
        }}>
          <span style={{ fontWeight: '600', color: typesOfLeave.length > 0 ? '#155724' : '#856404' }}>
            Leave Types:
          </span> 
          <span style={{ marginLeft: '4px' }}>
            {typesOfLeave.length > 0 ? 
              `${typesOfLeave.length} loaded ✓` : 
              'Loading...'
            }
          </span>
        </div>

        {/* Цветовые приоритеты - обновленная версия */}
        <div style={{ 
          fontSize: '11px', 
          color: '#666',
          backgroundColor: '#fff3cd',
          padding: '4px 8px',
          borderRadius: '3px',
          border: '1px solid #ffeaa7'
        }}>
          <span style={{ fontWeight: '600', color: '#856404' }}>Color Priority:</span> 
          <span style={{ color: TIMETABLE_COLORS.HOLIDAY, fontWeight: '500' }}> Holiday</span>  
          <span style={{ color: '#107c10', fontWeight: '500' }}> Leave</span> 
          <span style={{ color: '#666' }}> Default</span>
        </div>
      </div>

      {state.errorStaffRecords && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar messageBarType={MessageBarType.error}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{state.errorStaffRecords}</span>
              <button
                onClick={() => {
                  setState(prevState => ({ ...prevState, errorStaffRecords: undefined }));
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d83b01',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textDecoration: 'underline'
                }}
              >
                Dismiss
              </button>
            </div>
          </MessageBar>
        </div>
      )}

      {state.weeksData.length > 0 && (
        <TimetableExpandControls
          totalWeeks={statistics.totalWeeks} 
          expandedCount={statistics.expandedCount}
          onExpandAll={expandAllWeeks}
          onCollapseAll={collapseAllWeeks}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {state.isLoadingStaffRecords || isLoadingTypesOfLeave ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spinner size={2} />
            <p style={{ marginTop: '16px', fontSize: '16px', color: '#323130' }}>
              {isLoadingTypesOfLeave ? 'Loading leave types...' : 'Loading staff timetable...'}
            </p>
            {state.isLoadingStaffRecords && (
              <>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  Making individual server requests for {staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0').length} active staff members
                </p>
                <p style={{ fontSize: '11px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                  Processing with Holiday priority system and date persistence v3.8
                </p>
              </>
            )}
          </div>
        ) : state.weeksData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <MessageBar messageBarType={MessageBarType.info} style={{ marginBottom: '20px' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                  No schedule records found for active staff members in selected period
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  This may be normal if no schedule data exists for the selected month, or if all staff members are marked as deleted/inactive.
                </div>
              </div>
            </MessageBar>
            
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: '#fff8e1', 
              borderRadius: '4px',
              textAlign: 'left',
              fontSize: '12px',
              color: '#666'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#f57c00' }}>Debug Information:</div>
              <div>• Total Staff Records Loaded: {state.staffRecords.length}</div>
              <div>• Weeks Calculated (for month): {weeks.length}</div> 
              <div>• Total Staff Members: {staffMembers.length}</div>
              <div>• Active Staff Members: {staffMembers.filter(s => s.deleted !== 1).length}</div>
              <div>• Active Staff with Employee ID: {staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0').length}</div>
              <div>• Managing Group ID: {managingGroupId || 'Not set'}</div>
              <div>• Current User ID: {currentUserId || 'Not set'}</div>
              <div>• Types of Leave Loaded: {typesOfLeave.length}</div>
              <div>• Selected Date: {state.selectedDate.toLocaleDateString()}</div> {/* *** НОВОЕ *** */}
              <div style={{ marginTop: '8px', fontStyle: 'italic', color: '#f57c00' }}>
                Date Persistence System: Active v3.8 - {typesOfLeave.length > 0 ? 'Date saved to sessionStorage' : 'Pending leave types loading'}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '20px',
              padding: '8px 12px',
              backgroundColor: '#f0f6ff',
              borderRadius: '4px',
              border: '1px solid #deecf9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span>
                  <strong>Showing:</strong> {statistics.totalWeeks} weeks for {statistics.staffCount} staff members
                </span>
                <span>
                  <strong>Data coverage:</strong> {statistics.weeksWithData} weeks have data
                </span>
                <span>
                  <strong>Records:</strong> {statistics.recordsCount} total
                </span>
                <span>
                  <strong>Week starts:</strong> {TimetableWeekCalculator.getDayName(dayOfStartWeek || 7)}
                </span>
                <span>
                  <strong>Leave types:</strong> {typesOfLeave.length} loaded v3.8
                </span>
                {/* *** НОВОЕ: Показываем выбранный месяц *** */}
                <span>
                  <strong>Period:</strong> {state.selectedDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} (saved)
                </span>
              </div>
            </div>
            
            {/* *** ИСПРАВЛЕНО v3.8: Передаем typesOfLeave в TimetableWeekGroup *** */}
            {state.weeksData.map(weekGroup => (
              <TimetableWeekGroup
                key={weekGroup.weekInfo.weekNum}
                weekGroup={weekGroup}
                dayOfStartWeek={dayOfStartWeek || 7}
                onToggleExpand={toggleWeekExpand}
                getLeaveTypeColor={getLeaveTypeColor}
                holidayColor={TIMETABLE_COLORS.HOLIDAY}
                typesOfLeave={typesOfLeave} // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.8: Передаем типы отпусков ***
                 getLeaveTypeTitle={getLeaveTypeTitle} 
              />
            ))}
            
            {state.weeksData.length > 0 && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #e1e5e9'
              }}>
                <h3 style={{ 
                  margin: '0 0 10px 0', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#323130'
                }}>
                  Data Summary v3.8
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '10px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  <div>
                    <strong>Total Weeks (with data):</strong> {statistics.totalWeeks}
                  </div>
                  <div>
                    <strong>Weeks with Data:</strong> {statistics.weeksWithData}
                  </div>
                  <div>
                    <strong>Staff Members:</strong> {statistics.staffCount}
                  </div>
                  <div>
                    <strong>Total Records:</strong> {statistics.recordsCount}
                  </div>
                  <div>
                    <strong>Expanded Weeks:</strong> {statistics.expandedCount}
                  </div>
                  <div>
                    <strong>Leave Types Loaded:</strong> {typesOfLeave.length} v3.8
                  </div>
                  {/* *** НОВОЕ v3.8: Информация о дате *** */}
                  <div>
                    <strong>Selected Period:</strong> {state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ color: '#107c10' }}>
                    <strong>Date Persistence:</strong> ✓ Enabled
                  </div>
                  {/* *** НОВОЕ v3.8: Показываем названия первых нескольких типов отпусков *** */}
                  {typesOfLeave.length > 0 && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                      <strong>Available Leave Types:</strong>{' '}
                      {typesOfLeave.slice(0, 5).map((leaveType, index) => (
                        <span key={leaveType.id}>
                          <span 
                            style={{ 
                              color: leaveType.color || '#666',
                              fontWeight: '500'
                            }}
                          >
                            {leaveType.title}
                          </span>
                          {index < Math.min(4, typesOfLeave.length - 1) ? ', ' : ''}
                        </span>
                      ))}
                      {typesOfLeave.length > 5 && (
                        <span style={{ color: '#666' }}> and {typesOfLeave.length - 5} more...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Экспортируем компонент как именованный экспорт для совместимости с Kpfaplus.tsx
export const TimetableTab = TimetableTabComponent;

// Оставляем также дефолтный экспорт для гибкости
export default TimetableTabComponent;