// src/webparts/kpfaplus/services/StaffRecordsCalculationService.ts
import { 
    IStaffRecord,
    IWorkTimeCalculationResult,
    ISortOptions,
    StaffRecordsSortType
  } from "./StaffRecordsInterfaces";
  import {
    calculateWorkTime,
    formatMinutesToTime,
    parseTimeToMinutes,
    IWorkTimeInput
    // Удалили неиспользуемый импорт IWorkTimeResult
  } from "../utils/TimeCalculationUtils";
  
  /**
   * Сервис для расчетов и обработки данных расписания персонала
   * Отвечает за вычисления, сортировку и анализ данных
   */
  export class StaffRecordsCalculationService {
    private _logSource: string;
  
    /**
     * Конструктор сервиса расчетов
     * @param logSource Префикс для логов
     */
    constructor(logSource: string) {
      this._logSource = logSource + ".Calculation";
      this.logInfo("StaffRecordsCalculationService инициализирован");
    }
  
    /**
     * Рассчитывает рабочее время для записи расписания
     * @param record Запись расписания
     * @returns Запись расписания с рассчитанным рабочим временем
     */
    public calculateWorkTime(record: IStaffRecord): IStaffRecord {
      try {
        // Подготавливаем входные данные для расчета
        const input: IWorkTimeInput = {
          startTime: record.ShiftDate1,
          endTime: record.ShiftDate2,
          lunchStartTime: record.ShiftDate3,
          lunchEndTime: record.ShiftDate4,
          lunchDurationMinutes: record.TimeForLunch
        };
  
        // Используем утилиту для расчета рабочего времени
        const result = calculateWorkTime(input);
  
        // Возвращаем запись с рассчитанным рабочим временем и порядком сортировки
        return {
          ...record,
          SortOrder: result.sortOrder,
          WorkTime: result.formattedTime
        };
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка при расчете рабочего времени для записи ID ${record.ID}: ${error instanceof Error ? error.message : String(error)}`);
  
        // В случае ошибки возвращаем запись без изменений
        return {
          ...record,
          SortOrder: 1,
          WorkTime: "0.00"
        };
      }
    }
  
    /**
     * Детальный расчет рабочего времени с учетом обеда и возможных переходов через полночь
     * @param startWork Время начала работы
     * @param endWork Время окончания работы
     * @param startLunch Время начала обеда
     * @param endLunch Время окончания обеда
     * @param timeForLunch Продолжительность обеда в минутах
     * @returns Результат расчета с рабочим временем и порядком сортировки
     */
    public calculateWorkTimeDetails(
      startWork: Date,
      endWork: Date,
      startLunch: Date | undefined,
      endLunch: Date | undefined,
      timeForLunch: number
    ): IWorkTimeCalculationResult {
      // Перенаправляем вызов на утилиту
      const input: IWorkTimeInput = {
        startTime: startWork,
        endTime: endWork,
        lunchStartTime: startLunch,
        lunchEndTime: endLunch,
        lunchDurationMinutes: timeForLunch
      };
  
      const result = calculateWorkTime(input);
  
      // Преобразуем результат в IWorkTimeCalculationResult
      return {
        workTime: result.formattedTime,
        sortOrder: result.sortOrder,
        workMinutes: result.totalMinutes,
        lunchMinutes: result.lunchMinutes,
        netWorkMinutes: result.totalMinutes
      };
    }
  
    /**
     * Сортирует записи расписания персонала по заданным критериям
     * @param records Записи расписания персонала
     * @param sortOptions Опции сортировки
     * @returns Отсортированные записи
     */
    public sortStaffRecords(records: IStaffRecord[], sortOptions: ISortOptions): IStaffRecord[] {
      try {
        this.logInfo(`[DEBUG] sortStaffRecords: Сортировка ${records.length} записей по ${sortOptions.type} ${sortOptions.ascending ? 'по возрастанию' : 'по убыванию'}`);
        
        // Создаем копию массива для сортировки
        const sortedRecords = [...records].sort((a, b) => {
          let compareResult = 0;
          
          // Выбираем тип сортировки
          switch (sortOptions.type) {
            case StaffRecordsSortType.ByDate:
              // Сортировка по дате
              compareResult = this.compareDates(a.Date, b.Date);
              
              // Если даты равны, сортируем по SortOrder
              if (compareResult === 0) {
                compareResult = this.compareNumbers(a.SortOrder || 1, b.SortOrder || 1);
                
                // Если SortOrder равны, сортируем по времени начала
                if (compareResult === 0 && a.ShiftDate1 && b.ShiftDate1) {
                  compareResult = this.compareDates(a.ShiftDate1, b.ShiftDate1);
                }
              }
              break;
              
            case StaffRecordsSortType.ByStartTime:
              // Сортировка по времени начала
              if (a.ShiftDate1 && b.ShiftDate1) {
                compareResult = this.compareTimeOnly(a.ShiftDate1, b.ShiftDate1);
              } else if (a.ShiftDate1) {
                compareResult = -1; // a перед b, если у b нет времени начала
              } else if (b.ShiftDate1) {
                compareResult = 1; // b перед a, если у a нет времени начала
              }
              break;
              
            case StaffRecordsSortType.ByEndTime:
              // Сортировка по времени окончания
              if (a.ShiftDate2 && b.ShiftDate2) {
                compareResult = this.compareTimeOnly(a.ShiftDate2, b.ShiftDate2);
              } else if (a.ShiftDate2) {
                compareResult = -1; // a перед b, если у b нет времени окончания
              } else if (b.ShiftDate2) {
                compareResult = 1; // b перед a, если у a нет времени окончания
              }
              break;
              
            case StaffRecordsSortType.ByWorkTime:
              // Сортировка по рабочему времени, используя утилиту для парсинга
              {
                const workTimeA = parseTimeToMinutes(a.WorkTime || "0.00");
                const workTimeB = parseTimeToMinutes(b.WorkTime || "0.00");
                compareResult = workTimeA - workTimeB;
              }
              break;
              
            default:
              // По умолчанию сортируем по дате
              compareResult = this.compareDates(a.Date, b.Date);
          }
          
          // Применяем направление сортировки
          return sortOptions.ascending ? compareResult : -compareResult;
        });
        
        this.logInfo(`[DEBUG] sortStaffRecords: Сортировка завершена, получено ${sortedRecords.length} упорядоченных записей`);
        
        return sortedRecords;
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка при сортировке записей расписания: ${error instanceof Error ? error.message : String(error)}`);
        // В случае ошибки возвращаем несортированный массив
        return records;
      }
    }
  
    /**
     * Рассчитывает суммарное рабочее время для набора записей
     * @param records Массив записей для расчета
     * @returns Суммарное рабочее время в минутах
     */
    public calculateTotalWorkTime(records: IStaffRecord[]): number {
      try {
        this.logInfo(`[DEBUG] Расчет общего рабочего времени для ${records.length} записей`);
        
        // Используем утилиту для парсинга и суммирования времени
        const totalMinutes = records.reduce((total, record) => {
          return total + parseTimeToMinutes(record.WorkTime || "0.00");
        }, 0);
        
        this.logInfo(`[DEBUG] Общее рабочее время: ${totalMinutes} минут (${formatMinutesToTime(totalMinutes)})`);
        return totalMinutes;
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка при расчете общего рабочего времени: ${error instanceof Error ? error.message : String(error)}`);
        return 0;
      }
    }
  
    /**
     * Сравнивает две даты
     * @param dateA Первая дата
     * @param dateB Вторая дата
     * @returns Отрицательное число, если dateA < dateB, положительное, если dateA > dateB, 0 если равны
     */
    private compareDates(dateA: Date, dateB: Date): number {
      return dateA.getTime() - dateB.getTime();
    }
  
    /**
     * Сравнивает только время (часы и минуты) из двух дат
     * @param dateA Первая дата
     * @param dateB Вторая дата
     * @returns Отрицательное число, если время A < время B, положительное, если время A > время B, 0 если равны
     */
    private compareTimeOnly(dateA: Date, dateB: Date): number {
      const timeA = dateA.getHours() * 60 + dateA.getMinutes();
      const timeB = dateB.getHours() * 60 + dateB.getMinutes();
      return timeA - timeB;
    }
  
    /**
     * Сравнивает два числа
     * @param numA Первое число
     * @param numB Второе число
     * @returns Отрицательное число, если numA < numB, положительное, если numA > numB, 0 если равны
     */
    private compareNumbers(numA: number, numB: number): number {
      return numA - numB;
    }
  
    /**
     * Логирование информационных сообщений
     * @param message Сообщение для логирования
     */
    private logInfo(message: string): void {
      console.log(`[${this._logSource}] ${message}`);
    }
  
    /**
     * Логирование сообщений об ошибках
     * @param message Сообщение об ошибке для логирования
     */
    private logError(message: string): void {
      console.error(`[${this._logSource}] ${message}`);
    }
  }