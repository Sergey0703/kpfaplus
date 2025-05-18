// src/webparts/kpfaplus/services/StaffRecordsCalculationService.ts
import { 
    IStaffRecord,
    IWorkTimeCalculationResult,
    ISortOptions,
    StaffRecordsSortType
  } from "./StaffRecordsInterfaces";
  
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
        // Проверяем, что есть время начала и окончания работы
        if (!record.ShiftDate1 || !record.ShiftDate2) {
          // Если нет времени начала или окончания, устанавливаем WorkTime в "0.00"
          return {
            ...record,
            SortOrder: 1, // Значение по умолчанию для сортировки
            WorkTime: "0.00"
          };
        }
  
        // Получаем время начала и окончания работы
        const startWork = record.ShiftDate1;
        const endWork = record.ShiftDate2;
  
        // Получаем время начала и окончания обеда
        const startLunch = record.ShiftDate3;
        const endLunch = record.ShiftDate4;
  
        // Выполняем расчет рабочего времени
        const result = this.calculateWorkTimeDetails(
          startWork, 
          endWork, 
          startLunch, 
          endLunch, 
          record.TimeForLunch
        );
  
        // Возвращаем запись с рассчитанным рабочим временем и порядком сортировки
        return {
          ...record,
          SortOrder: result.sortOrder,
          WorkTime: result.workTime
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
      // Рассчитываем минуты для времени начала работы
      const startMinutes = startWork.getHours() * 60 + startWork.getMinutes();
  
      // Рассчитываем минуты для времени окончания работы
      const endMinutes = endWork.getHours() * 60 + endWork.getMinutes();
  
      // Расчет рабочих минут с учетом перехода через полночь
      let workMinutes = 0;
  
      if (endMinutes <= startMinutes && endMinutes > 0) {
        // Если окончание раньше начала и не 00:00, значит смена переходит через полночь
        workMinutes = endMinutes + (24 * 60) - startMinutes;
      } else if (endMinutes === 0) {
        // Если окончание в 00:00, считаем это как конец дня (24:00)
        workMinutes = (24 * 60) - startMinutes;
      } else {
        // Обычный случай, когда окончание позже начала
        workMinutes = endMinutes - startMinutes;
      }
  
      // Расчет минут обеда
      let lunchMinutes = 0;
  
      // Используем время обеда из поля TimeForLunch, если задано
      if (timeForLunch > 0) {
        lunchMinutes = timeForLunch;
      } 
      // Иначе рассчитываем из времени начала и окончания обеда, если они заданы
      else if (startLunch && endLunch && 
              !(startLunch.getHours() === 0 && startLunch.getMinutes() === 0 &&
                endLunch.getHours() === 0 && endLunch.getMinutes() === 0)) {
        
        const lunchStartMinutes = startLunch.getHours() * 60 + startLunch.getMinutes();
        const lunchEndMinutes = endLunch.getHours() * 60 + endLunch.getMinutes();
        
        lunchMinutes = lunchEndMinutes - lunchStartMinutes;
      }
  
      // Рассчитываем чистое рабочее время (общее время - обед)
      const netWorkMinutes = Math.max(0, workMinutes - lunchMinutes);
  
      // Форматируем результат в формате "часы.минуты"
      const hours = Math.floor(netWorkMinutes / 60);
      const minutes = netWorkMinutes % 60;
      const workTime = `${hours}.${minutes.toString().padStart(2, '0')}`;
  
      // Рассчитываем SortOrder (порядок сортировки)
      let sortOrder = 1; // По умолчанию
  
      // Проверяем, являются ли времена начала и окончания нулевыми (00:00)
      const isStartTimeZero = startWork.getHours() === 0 && startWork.getMinutes() === 0;
      const isEndTimeZero = endWork.getHours() === 0 && endWork.getMinutes() === 0;
  
      if (isStartTimeZero && isEndTimeZero) {
        // Если оба времени нулевые, устанавливаем SortOrder в 1
        sortOrder = 1;
      } else if (!isStartTimeZero) {
        // Если время начала не нулевое, устанавливаем SortOrder в 0
        sortOrder = 0;
      } else if (!isEndTimeZero) {
        // Если время начала нулевое, но время окончания не нулевое, устанавливаем SortOrder в 0
        sortOrder = 0;
      }
  
      return {
        workTime,
        sortOrder,
        workMinutes,
        lunchMinutes,
        netWorkMinutes
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
              // Сортировка по рабочему времени
              const workTimeA = this.parseWorkTime(a.WorkTime || "0.00");
              const workTimeB = this.parseWorkTime(b.WorkTime || "0.00");
              compareResult = workTimeA - workTimeB;
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
        
        // Суммируем рабочее время по всем записям
        const totalMinutes = records.reduce((total, record) => {
          // Извлекаем минуты из строки формата "часы.минуты"
          const workTimeMinutes = this.parseWorkTime(record.WorkTime || "0.00");
          return total + workTimeMinutes;
        }, 0);
        
        this.logInfo(`[DEBUG] Общее рабочее время: ${totalMinutes} минут`);
        return totalMinutes;
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка при расчете общего рабочего времени: ${error instanceof Error ? error.message : String(error)}`);
        return 0;
      }
    }
  
    /**
     * Преобразует строку рабочего времени в минуты
     * @param workTime Строка рабочего времени в формате "часы.минуты"
     * @returns Количество минут
     */
    private parseWorkTime(workTime: string): number {
      try {
        const parts = workTime.split('.');
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        return hours * 60 + minutes;
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка преобразования рабочего времени "${workTime}": ${error}`);
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