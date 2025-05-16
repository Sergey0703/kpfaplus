import * as React from 'react';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import styles from './TabNavigation.module.scss';

export interface ITabNavigationProps {
  selectedTabKey: string;
  onTabChange: (key: string) => void;
}

export const TabNavigation: React.FC<ITabNavigationProps> = (props) => {
  const { selectedTabKey, onTabChange } = props;

  const handleLinkClick = (item?: PivotItem): void => {
    if (item && item.props.itemKey) {
      onTabChange(item.props.itemKey);
    }
  };

  return (
    <div className={styles.tabNavigation}>
      <Pivot 
        selectedKey={selectedTabKey} 
        onLinkClick={handleLinkClick}
      >
        <PivotItem headerText="Main" itemKey="main" />
        <PivotItem headerText="Contracts" itemKey="contracts" />
        <PivotItem headerText="Schedule" itemKey="schedule" />
        <PivotItem headerText="Notes" itemKey="notes" />
        <PivotItem headerText="Leaves" itemKey="leaves" />
        <PivotItem headerText="Leave Time by Years" itemKey="leaveTime" />
        <PivotItem headerText="SRS" itemKey="srs" />
      </Pivot>
    </div>
  );
};