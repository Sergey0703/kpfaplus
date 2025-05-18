// src/webparts/kpfaplus/utils/DataTypeAdapter.ts

/**
 * Адаптер для привидения различных типов данных из SharePoint/Graph API
 * к стандартным типам, используемым в приложении
 */
export class DataTypeAdapter {
  /**
   * Преобразует значение в строку
   * @param value Значение для преобразования
   * @returns Строковое представление
   */
  public static toString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (typeof value === 'object') {
      // Пустой объект
      if (Object.keys(value as Record<string, unknown>).length === 0) {
        return '';
      }
      
      // Lookup объект
      if ('Title' in value && typeof (value as { Title: string }).Title === 'string') {
        return (value as { Title: string }).Title;
      }
      
      // Прочие объекты
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    
    return '';
  }
  
  /**
   * Преобразует значение в число
   * @param value Значение для преобразования
   * @param defaultValue Значение по умолчанию
   * @returns Числовое представление
   */
  public static toNumber(value: unknown, defaultValue: number = 0): number {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    if (typeof value === 'object') {
      // Пустой объект
      if (Object.keys(value as Record<string, unknown>).length === 0) {
        return defaultValue;
      }
      
      // Lookup объект
      if ('Id' in value && typeof (value as { Id: number }).Id === 'number') {
        return (value as { Id: number }).Id;
      }
      
      return defaultValue;
    }
    
    return defaultValue;
  }
  
  /**
   * Преобразует значение в логическое значение
   * @param value Значение для преобразования
   * @returns Логическое представление
   */
  public static toBoolean(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1';
    }
    
    if (typeof value === 'object') {
      // Пустой объект
      if (Object.keys(value as Record<string, unknown>).length === 0) {
        return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Преобразует значение в ID (числовое представление)
   * @param value Значение для преобразования
   * @returns ID (число)
   */
  public static toId(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    if (typeof value === 'object') {
      // Lookup объект
      if ('Id' in value && typeof (value as { Id: number }).Id === 'number') {
        return (value as { Id: number }).Id;
      }
      
      // Lookup ID
      if ('LookupId' in value && typeof (value as { LookupId: number }).LookupId === 'number') {
        return (value as { LookupId: number }).LookupId;
      }
      
      return 0;
    }
    
    return 0;
  }
}