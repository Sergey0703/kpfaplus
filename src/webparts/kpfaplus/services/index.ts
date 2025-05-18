
// Создаем простую экспортную обертку
// src/webparts/kpfaplus/services/index.ts

// Экспортируем интерфейсы
export * from './RemoteSiteInterfaces';

// Экспортируем сервисы
export { RemoteSiteService } from './RemoteSiteService';
export { RemoteSiteAuthService } from './RemoteSiteAuthService';
export { RemoteSiteListService } from './RemoteSiteListService';
export { RemoteSiteItemService } from './RemoteSiteItemService';