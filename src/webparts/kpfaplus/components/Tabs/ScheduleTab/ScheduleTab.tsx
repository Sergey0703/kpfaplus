// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTab.tsx

import * as React from 'react';
import { ITabProps } from '../../../models/types'; // Correctly imports ITabProps
import { ScheduleTabContent } from './ScheduleTabContent'; // Correctly imports ScheduleTabContent
import styles from './ScheduleTab.module.scss'; // Correctly imports styles
// Import the main orchestrator hook now in 'utils'
// Импортируем useScheduleTabLogic И ЕГО ВОЗВРАЩАЕМЫЙ ТИП UseScheduleTabLogicReturn
// Убедитесь, что UseScheduleTabLogicReturn экспортируется из useScheduleTabLogic.ts
import { useScheduleTabLogic, UseScheduleTabLogicReturn } from './utils/useScheduleTabLogic';


// Здесь используем именованный экспорт, как ожидается в Kpfaplus.tsx
export const ScheduleTab: React.FC<ITabProps> = (props) => {
  console.log('[ScheduleTab] Rendering component with props:', {
    hasSelectedStaff: !!props.selectedStaff,
    selectedStaffId: props.selectedStaff?.id,
    hasContext: !!props.context,
    currentUserId: props.currentUserId,
    managingGroupId: props.managingGroupId
  });

  // Call the main orchestrator hook
  // Типизируем результат вызова хука
  const hookProps: UseScheduleTabLogicReturn = useScheduleTabLogic(props);

  // Извлекаем showDeleted и onToggleShowDeleted ИЗ результата хука
  const { showDeleted, onToggleShowDeleted, ...restHookProps } = hookProps;


  // Render the content component, passing original props AND hook results
  // Явно передаем showDeleted и onToggleShowDeleted, а остальные пропсы распространяем
  return (
    <div className={styles.scheduleTab}>
      <ScheduleTabContent
        selectedStaff={props.selectedStaff} // Pass original prop
        context={props.context} // Pass original prop
        currentUserId={props.currentUserId} // Pass original prop
        managingGroupId={props.managingGroupId} // Pass original prop
        // --- ПЕРЕДАЧА SHOWDELETED И TOGGLE ---
        showDeleted={showDeleted} // <-- Передаем из результата хука
        onToggleShowDeleted={onToggleShowDeleted} // <-- Передаем из результата хука
        // -------------------------------------
        {...restHookProps} // Spread the rest of the state and handlers from the hook result
      />
    </div>
  );
};

// Also add a default export for compatibility
export default ScheduleTab;