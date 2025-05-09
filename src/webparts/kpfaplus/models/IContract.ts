// src/webparts/kpfaplus/models/IContract.ts
export interface IContract {
  id: string;
  template: string;
  typeOfWorker: {
    id: string;
    value: string;
  };
  contractedHours: number;
  startDate: Date | undefined; // Заменено с Date | null
  finishDate: Date | undefined; // Заменено с Date | null
  isDeleted: boolean;
  manager?: {
    id: string;
    value: string;
  };
  staffGroup?: {
    id: string;
    value: string;
  };
  staffMember?: {
    id: string;
    value: string;
  };
}

export interface IContractFormData {
  id?: string;
  template: string;
  typeOfWorkerId: string;
  contractedHours: number;
  startDate: Date | undefined; // Заменено с Date | null
  finishDate: Date | undefined; // Заменено с Date | null
  isDeleted?: boolean;
  staffMemberId?: string;
  managerId?: string; // Добавлено
  staffGroupId?: string; // Добавлено
}