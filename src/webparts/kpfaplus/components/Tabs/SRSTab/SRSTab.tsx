import * as React from 'react';
import { useState } from 'react';
import { ITabProps } from '../../../models/types';
import styles from './SRSTab.module.scss';

// Вспомогательные функции для генерации опций выпадающих списков
const generateHoursOptions = (): JSX.Element[] => {
  const options: JSX.Element[] = [];
  for (let i = 0; i < 24; i++) {
    const value = i < 10 ? '0' + i : '' + i;
    options.push(<option key={i} value={value}>{value}</option>);
  }
  return options;
};

const generateMinutesOptions = (): JSX.Element[] => {
  const options: JSX.Element[] = [];
  for (let i = 0; i < 12; i++) {
    const value = i * 5;
    const valueStr = value < 10 ? '0' + value : '' + value;
    options.push(<option key={i} value={valueStr}>{valueStr}</option>);
  }
  return options;
};

const generateLunchOptions = (): JSX.Element[] => {
  const options: JSX.Element[] = [];
  for (let i = 0; i <= 6; i++) {
    const value = i * 5;
    const valueStr = value < 10 ? '0' + value : '' + value;
    options.push(<option key={i} value={valueStr}>{valueStr}</option>);
  }
  return options;
};

const tableCellStyle = {
  border: '1px solid black',
  padding: '4px'
};

export const SRSTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;
  
  // Состояния компонента
  const [fromDate, setFromDate] = useState<string>("03.05.2025");
  const [toDate, setToDate] = useState<string>("03.05.2025");
  const [totalHours] = useState<string>("127.00");

  // Данные для строки в таблице
  const [srsData] = useState([
    {
      id: '1',
      date: '01.12.2024',
      hours: '7.50',
      relief: true,
      startWork: { 
        hours: '08', 
        minutes: '00' 
      },
      finishWork: { 
        hours: '16', 
        minutes: '00' 
      },
      lunch: '30',
      typeOfLeave: 'Unpaid Leave',
      timeLeave: '7.50',
      contractCheck: true,
      shift: 1,
      status: 'positive',
      srs: true
    }
  ]);

  // Обработчики событий
  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFromDate(e.target.value);
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setToDate(e.target.value);
  };

  const handleRefresh = (): void => {
    console.log("Refreshing data...");
  };

  const handleExport = (): void => {
    console.log("Exporting SRS data...");
  };

  const handleSave = (): void => {
    console.log("Saving data...");
  };

  const handleCheckedSave = (): void => {
    console.log("Saving checked data...");
  };

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div className={styles.srsTab}>
      {/* Заголовок */}
      <div className={styles.srsHeader}>
        <div>SRS for {selectedStaff.name}</div>
      </div>
      
      {/* Выбор даты и кнопка обновления */}
      <div className={styles.dateRow}>
        <div className={styles.dateField}>
          <span className={styles.dateLabel}>From:</span>
          <input 
            type="text" 
            className={styles.dateInput} 
            value={fromDate} 
            onChange={handleFromDateChange}
          />
        </div>
        <div className={styles.dateField}>
          <span className={styles.dateLabel}>To:</span>
          <input 
            type="text" 
            className={styles.dateInput} 
            value={toDate} 
            onChange={handleToDateChange}
          />
        </div>
        <button className={styles.refreshButton} onClick={handleRefresh}>
          Refresh
        </button>
      </div>
      
      {/* Общее количество часов и кнопки */}
      <div className={styles.totalHours}>
        Total Hours: {totalHours}
      </div>
      
      {/* Кнопки Save */}
      <div style={{ float: 'right', margin: '-30px 0 10px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button className={styles.exportButton} onClick={handleExport} style={{ marginBottom: '5px' }}>
          Export all SRS
        </button>
        <div>
          <button className={styles.saveButton} onClick={handleSave} style={{ marginRight: '5px' }}>
            <span className={styles.saveIcon}>💾</span> Save
          </button>
          <button className={styles.saveButton} onClick={handleCheckedSave}>
            All in Checked & Save
          </button>
        </div>
      </div>
      
      {/* Таблица данных */}
      <div className={styles.tableContainer}>
        <table style={{ borderCollapse: 'collapse', border: '2px solid black', width: '100%' }}>
          <thead>
            <tr>
              <th style={tableCellStyle}>Date</th>
              <th style={tableCellStyle}>Hrs</th>
              <th style={tableCellStyle}>Relief?</th>
              <th style={tableCellStyle}>Start Work</th>
              <th style={tableCellStyle}>Finish Work</th>
              <th style={tableCellStyle}>Lunch</th>
              <th style={tableCellStyle}>Type of Leave</th>
              <th style={tableCellStyle}>Time Leave (h)</th>
              <th style={tableCellStyle}>Contract Check</th>
              <th style={tableCellStyle}>Shift</th>
              <th style={tableCellStyle} />
              <th style={tableCellStyle}>SRS</th>
              <th style={tableCellStyle} />
            </tr>
          </thead>
          <tbody>
            {srsData.map((row) => (
              <tr key={row.id}>
                <td style={tableCellStyle}>{row.date}</td>
                <td style={tableCellStyle}>{row.hours}</td>
                <td style={tableCellStyle}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={row.relief}
                    readOnly
                  />
                </td>
                <td style={tableCellStyle}>
                  <select className={styles.timeSelect} value={row.startWork.hours}>
                    {generateHoursOptions()}
                  </select>
                  <span> : </span>
                  <select className={styles.timeSelect} value={row.startWork.minutes}>
                    {generateMinutesOptions()}
                  </select>
                </td>
                <td style={tableCellStyle}>
                  <select className={styles.timeSelect} value={row.finishWork.hours}>
                    {generateHoursOptions()}
                  </select>
                  <span> : </span>
                  <select className={styles.timeSelect} value={row.finishWork.minutes}>
                    {generateMinutesOptions()}
                  </select>
                </td>
                <td style={tableCellStyle}>
                  <select className={styles.timeSelect} value={row.lunch}>
                    {generateLunchOptions()}
                  </select>
                </td>
                <td style={tableCellStyle}>
                  <select className={styles.selectField} value={row.typeOfLeave}>
                    <option value="Unpaid Leave">Unpaid Leave</option>
                    <option value="Adoptive Leave">Adoptive Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Annual Leave">Annual Leave</option>
                  </select>
                </td>
                <td style={tableCellStyle}>
                  <input
                    type="text"
                    className={styles.timeleaveInput}
                    value={row.timeLeave}
                    maxLength={4}
                    style={{ width: '40px' }}
                  />
                </td>
                <td style={tableCellStyle}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={row.contractCheck}
                    readOnly
                  />
                </td>
                <td style={tableCellStyle}>
                  <button className={styles.shiftButton}>
                    <span className={styles.plusIcon}>+</span>
                    Shift
                  </button>
                </td>
                <td style={tableCellStyle}>
                  <span className={styles.numberId}>{row.shift}</span>
                </td>
                <td style={tableCellStyle}>
                  {row.status === 'positive' && <span className={styles.thumbsUp}>👍</span>}
                  {row.status === 'negative' && <span className={styles.thumbsDown}>👎</span>}
                </td>
                <td style={tableCellStyle}>
                  {row.srs && <span className={styles.srsTag}>SRS</span>}
                </td>
                <td style={tableCellStyle}>
                  <span className={styles.deleteIcon}>🗑️</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};