// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/TypesOfLeaveInfo.tsx
import * as React from 'react';
import { Spinner, SpinnerSize, Text } from '@fluentui/react';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';

export interface ITypesOfLeaveInfoProps {
  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
}

// Вспомогательная функция для определения, является ли цвет темным
// (для выбора контрастного цвета текста)
const isColorDark = (colorHex?: string): boolean => {
  if (!colorHex) return false;
  
  // Проверяем, является ли строка цветом в формате HEX
  if (!colorHex.startsWith('#') || colorHex.length !== 7) return false;
  
  try {
    // Конвертируем HEX в RGB
    const r = parseInt(colorHex.slice(1, 3), 16);
    const g = parseInt(colorHex.slice(3, 5), 16);
    const b = parseInt(colorHex.slice(5, 7), 16);
    
    // Вычисляем яркость (чем больше значение, тем светлее цвет)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Если яркость ниже 128, считаем цвет темным
    return brightness < 128;
  } catch (e) {
    return false;
  }
};

export const TypesOfLeaveInfo: React.FC<ITypesOfLeaveInfoProps> = ({ 
  typesOfLeave, 
  isLoadingTypesOfLeave 
}) => {
  if (isLoadingTypesOfLeave) {
    return (
      <div style={{ textAlign: 'center', padding: '10px' }}>
        <Spinner size={SpinnerSize.small} label="Loading types of leave..." />
      </div>
    );
  }
  
  if (typesOfLeave.length === 0) {
    return null;
  }
  
  return (
    <div style={{ 
      border: '1px solid #e0e0e0',
      padding: '10px',
      marginTop: '20px',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9'
    }}>
      <Text variant="medium" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
        Справочник типов отпусков
      </Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {typesOfLeave.map(type => (
          <div 
            key={type.id}
            style={{ 
              padding: '5px 10px',
              borderRadius: '3px',
              backgroundColor: type.color || '#f0f0f0',
              color: isColorDark(type.color) ? 'white' : 'black',
              fontSize: '13px'
            }}
          >
            {type.title}
          </div>
        ))}
      </div>
    </div>
  );
};