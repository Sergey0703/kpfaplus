// src/webparts/kpfaplus/services/RemoteSiteInterfaces.ts

/**
 * Интерфейсы для работы с удаленным сайтом SharePoint через Microsoft Graph API
 */

// Интерфейс для информации о сайте
export interface IRemoteSiteInfo {
    id: string;
    title: string;
    url: string;
    created: string;
    lastModifiedDateTime: string;
    description?: string;
    serverRelativeUrl?: string;
    webTemplate?: string;
    [key: string]: unknown; // Индексная сигнатура для дополнительных полей
}

// Интерфейс для информации о списке
export interface IRemoteListInfo {
    id: string;
    title: string;
    itemCount: number;
    description?: string;
    defaultViewUrl?: string;
    lastModifiedDateTime?: string;
    [key: string]: unknown; // Индексная сигнатура для дополнительных полей
}

// Интерфейс для полей Lookup
export interface ILookupField {
    Id: number;
    Title: string;
    [key: string]: unknown;
}

// Интерфейс для элементов списка с типизированными полями
export interface IRemoteListItemField {
    [key: string]: unknown;
}

// Интерфейс для элементов списка
export interface IRemoteListItemResponse {
    id: string;
    fields?: IRemoteListItemField;
    [key: string]: unknown;
}

// Интерфейс для полей списка
export interface IRemoteListFieldInfo {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    columnGroup?: string;
    enforceUniqueValues?: boolean;
    indexed?: boolean;
    required?: boolean;
    readOnly?: boolean;
    [key: string]: unknown;
}

// Интерфейс для параметров запроса элементов списка (для сбора всех страниц) - ОСТАВЛЯЕМ ДЛЯ СУЩЕСТВУЮЩЕГО getListItems
export interface IGetListItemsOptions {
    expandFields?: boolean;
    filter?: string;
    orderBy?: { field: string, ascending: boolean };
    maxItems?: number;
    pageSize?: number;
}

// --- НОВЫЙ ИНТЕРФЕЙС ДЛЯ ПАГИНАЦИИ ---
// Интерфейс для параметров запроса ОДНОЙ страницы элементов списка с пагинацией
export interface IGetPaginatedListItemsOptions {
  expandFields?: boolean;
  filter?: string;
  orderBy?: { field: string; ascending: boolean };
  skip?: number;
  top?: number;
  nextLink?: string; // Ссылка на следующую страницу для продолжения пагинации
}
// ----------------------------------

export interface IRemotePaginatedItemsResponse {
  items: IRemoteListItemResponse[];
  totalCount: number;
  nextLink?: string; // Ссылка на следующую страницу
  rangeStart: number; // Начало диапазона отображаемых записей
  rangeEnd: number;   // Конец диапазона отображаемых записей
}
// Интерфейс для опций создания элемента списка
export interface ICreateListItemOptions {
    fields: Record<string, unknown>;
}

// Интерфейс для опций обновления элемента списка
export interface IUpdateListItemOptions {
    fields: Record<string, unknown>;
}

// Интерфейс для результатов операций с ошибками
export interface IOperationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Интерфейс для результатов пагинированного запроса
// Это тот же тип, который мы определили локально в RemoteSiteItemService,
// но теперь экспортируем его для использования в других сервисах
export interface IRemotePaginatedItemsResponse {
  items: IRemoteListItemResponse[];
  totalCount: number;
  nextLink?: string; // Ссылка на следующую страницу
}