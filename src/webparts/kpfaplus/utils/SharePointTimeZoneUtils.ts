// src/webparts/kpfaplus/utils/SharePointTimeZoneUtils.ts
import { RemoteSiteService } from '../services/RemoteSiteService';

/**
 * Интерфейс для информации о часовом поясе SharePoint
 */
export interface ISharePointTimeZoneInfo {
  description: string;
  id: number;
  bias: number;
  daylightBias: number;
  standardBias: number;
}

/**
 * Утилиты для работы с часовыми поясами SharePoint
 * Обеспечивает правильную конвертацию времени между WeeklyTimeTables и StaffRecords
 */
export class SharePointTimeZoneUtils {
  private static _timeZoneInfo: ISharePointTimeZoneInfo | null = null;
  private static _logSource = 'SharePointTimeZoneUtils';

  /**
   * Получает информацию о часовом поясе SharePoint сайта (с кэшированием)
   * @param remoteSiteService Сервис для работы с SharePoint
   * @returns Promise с информацией о часовом поясе
   */
 public static async getTimeZoneInfo(
 remoteSiteService: RemoteSiteService
): Promise<ISharePointTimeZoneInfo> {
 if (!this._timeZoneInfo) {
   this.logInfo('Fetching SharePoint site timezone information...');
   this._timeZoneInfo = await remoteSiteService.getTimeZoneInfo();
   
   // *** ДОБАВЛЕННОЕ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ***
   this.logInfo(`*** RAW TIMEZONE DATA FROM SHAREPOINT ***`);
   this.logInfo(`Description: ${this._timeZoneInfo.description}`);
   this.logInfo(`ID: ${this._timeZoneInfo.id}`);
   this.logInfo(`Raw bias: ${this._timeZoneInfo.bias}`);
   this.logInfo(`Raw daylightBias: ${this._timeZoneInfo.daylightBias}`);
   this.logInfo(`Raw standardBias: ${this._timeZoneInfo.standardBias}`);
   this.logInfo(`*** END RAW DATA ***`);
   
   this.logInfo(`Cached timezone: ${this._timeZoneInfo.description}`);
   this.logInfo(`Bias components: Total=${this._timeZoneInfo.bias}, Daylight=${this._timeZoneInfo.daylightBias}, Standard=${this._timeZoneInfo.standardBias}`);
 }
 return this._timeZoneInfo;
}
  /**
   * Сбрасывает кэш информации о часовом поясе
   * Полезно для тестирования или при смене сайта
   */
  public static clearTimeZoneCache(): void {
    this.logInfo('Clearing timezone cache');
    this._timeZoneInfo = null;
  }

  /**
   * Вычисляет общее смещение в минутах для текущего времени
   * Учитывает летнее/зимнее время автоматически
   * 
   * @param remoteSiteService Сервис для работы с SharePoint
   * @param forDate Дата для которой вычисляется смещение (по умолчанию - текущая)
   * @returns Promise с смещением в минутах
   */
  public static async getTimeZoneOffsetMinutes(
    remoteSiteService: RemoteSiteService,
    forDate?: Date
  ): Promise<number> {
    const timeZoneInfo = await this.getTimeZoneInfo(remoteSiteService);
    const targetDate = forDate || new Date();
    
    // Определяем, действует ли летнее время для указанной даты
    const isDaylightTime = this.isDaylightSavingTime(targetDate);
    
    // Вычисляем общее смещение
    // Bias - основное смещение, DaylightBias - дополнительное смещение для летнего времени
    const totalBias = timeZoneInfo.bias + 
      (isDaylightTime ? timeZoneInfo.daylightBias : timeZoneInfo.standardBias);
    
    this.logInfo(`Total bias for ${targetDate.toISOString()}: ${totalBias} minutes (Daylight: ${isDaylightTime})`);
    return totalBias;
  }

  /**
   * Проверяет, действует ли летнее время для указанной даты
   * Использует браузерное API для определения летнего времени
   * 
   * @param date Дата для проверки
   * @returns true если действует летнее время
   */
  private static isDaylightSavingTime(date: Date): boolean {
    // Получаем смещения для января и июля
    const january = new Date(date.getFullYear(), 0, 1);
    const july = new Date(date.getFullYear(), 6, 1);
    
    // Стандартное смещение - максимальное из двух (зимнее время)
    const standardTimezoneOffset = Math.max(
      january.getTimezoneOffset(), 
      july.getTimezoneOffset()
    );
    
    // Если текущее смещение меньше стандартного, значит действует летнее время
    const isDST = date.getTimezoneOffset() < standardTimezoneOffset;
    
    this.logInfo(`DST check for ${date.toDateString()}: ${isDST} (offset: ${date.getTimezoneOffset()}, standard: ${standardTimezoneOffset})`);
    return isDST;
  }

  /**
   * Корректирует UTC время на смещение часового пояса SharePoint
   * Это основная функция для исправления проблемы с временем смен
   * 
   * @param utcHours Часы в UTC (из WeeklyTimeTables)
   * @param utcMinutes Минуты в UTC (из WeeklyTimeTables)
   * @param remoteSiteService Сервис для работы с SharePoint
   * @param forDate Дата для которой выполняется корректировка
   * @returns Promise с скорректированным временем
   */
  public static async adjustTimeForSharePointTimeZone(
    utcHours: number,
    utcMinutes: number,
    remoteSiteService: RemoteSiteService,
    forDate?: Date
  ): Promise<{ hours: number; minutes: number }> {
    const offsetMinutes = await this.getTimeZoneOffsetMinutes(remoteSiteService, forDate);
    
    this.logInfo(`Adjusting time ${utcHours}:${utcMinutes} with offset ${offsetMinutes} minutes`);
    
    // Конвертируем время в минуты для удобства расчетов
    const totalInputMinutes = utcHours * 60 + utcMinutes;
    
    // SharePoint bias положительный для западных часовых поясов (например, UTC-5 = bias 300)
    // Для восточных часовых поясов bias отрицательный (например, UTC+1 = bias -60)
    // Чтобы получить правильное UTC время для сохранения, вычитаем bias
    const adjustedTotalMinutes = totalInputMinutes - offsetMinutes;
    
    // Конвертируем обратно в часы и минуты
    let finalHours = Math.floor(adjustedTotalMinutes / 60);
    let finalMinutes = adjustedTotalMinutes % 60;
    
    // Обрабатываем переход через полночь
    if (finalHours < 0) {
      finalHours = (finalHours % 24) + 24;
    } else if (finalHours >= 24) {
      finalHours = finalHours % 24;
    }
    
    if (finalMinutes < 0) {
      finalMinutes = (finalMinutes % 60) + 60;
      finalHours = finalHours - 1;
      if (finalHours < 0) {
        finalHours = 23;
      }
    }
    
    this.logInfo(`Time adjustment result: ${utcHours}:${utcMinutes} → ${finalHours}:${finalMinutes} (offset: ${offsetMinutes}min)`);
    
    return {
      hours: finalHours,
      minutes: finalMinutes
    };
  }

  /**
   * Вспомогательная функция для создания даты с скорректированным временем
   * Упрощает использование adjustTimeForSharePointTimeZone
   * 
   * @param baseDate Базовая дата
   * @param utcHours Часы в UTC
   * @param utcMinutes Минуты в UTC
   * @param remoteSiteService Сервис для работы с SharePoint
   * @returns Promise с датой с скорректированным временем
   */
  public static async createDateWithTimeZoneAdjustment(
    baseDate: Date,
    utcHours: number,
    utcMinutes: number,
    remoteSiteService: RemoteSiteService
  ): Promise<Date> {
    const adjustedTime = await this.adjustTimeForSharePointTimeZone(
      utcHours, 
      utcMinutes, 
      remoteSiteService, 
      baseDate
    );
    
    const result = new Date(baseDate);
    result.setUTCHours(adjustedTime.hours, adjustedTime.minutes, 0, 0);
    
    this.logInfo(`Created date with timezone adjustment: ${result.toISOString()}`);
    return result;
  }

  /**
   * Логирует информационное сообщение
   * @param message Сообщение для логирования
   */
  private static logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }
}