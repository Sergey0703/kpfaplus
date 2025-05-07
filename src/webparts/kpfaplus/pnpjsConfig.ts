import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFI, SPFx } from "@pnp/sp";
import { LogLevel, PnPLogging } from "@pnp/logging";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/batching";

// Используем undefined или инициализируем сразу
let _sp: SPFI | undefined = undefined;

export const getSP = (): SPFI => {
  // Проверяем, что _sp инициализирован
  if (!_sp) {
    throw new Error("PnP JS has not been initialized. Call setupPnP first.");
  }
  return _sp;
};

export const setupPnP = (context: WebPartContext): void => {
  _sp = spfi().using(SPFx(context)).using(PnPLogging(LogLevel.Warning));
};