// src/webparts/kpfaplus/components/ConfirmDialog/ConfirmDialog.tsx
import * as React from 'react';
import { Dialog, DialogType, DialogFooter } from '@fluentui/react/lib/Dialog';
import { PrimaryButton, DefaultButton, IButtonStyles } from '@fluentui/react/lib/Button';
import { initializeIcons } from '@fluentui/react/lib/Icons';

// Инициализируем иконки Fluent UI
initializeIcons();

export interface IConfirmDialogProps {
  // Видимость диалога
  isOpen: boolean;
  // Заголовок диалога
  title: string;
  // Текст сообщения
  message: string;
  // Текст на кнопке подтверждения
  confirmButtonText: string;
  // Текст на кнопке отмены
  cancelButtonText: string;
  // Обработчик для закрытия диалога
  onDismiss: () => void;
  // Обработчик для подтверждения действия
  onConfirm: () => void;
  // Опциональный цвет для кнопки подтверждения
  confirmButtonColor?: string;
  // *** НОВОЕ: Режим "только предупреждение" - показывать только кнопку Cancel ***
  warningOnly?: boolean;
  // *** НОВОЕ: Иконка для предупреждающего диалога ***
  warningIcon?: string;
}

export const ConfirmDialog: React.FC<IConfirmDialogProps> = (props) => {
  const {
    isOpen,
    title,
    message,
    confirmButtonText,
    cancelButtonText,
    onDismiss,
    onConfirm,
    confirmButtonColor,
    warningOnly = false,
    warningIcon = 'Warning'
  } = props;

  console.log('[ConfirmDialog] Rendering dialog:', {
    isOpen,
    title,
    warningOnly,
    hasConfirmButton: !warningOnly,
    dialogType: warningOnly ? 'Warning only' : 'Confirmation',
    warningIcon
  });

  // Настройка диалога
  const dialogContentProps = {
    type: warningOnly ? DialogType.normal : DialogType.normal,
    title: title,
    closeButtonAriaLabel: 'Close',
    subText: message,
    // *** НОВОЕ: Добавляем иконку для предупреждающего диалога ***
    ...(warningOnly && warningIcon && {
      iconProps: { iconName: warningIcon }
    })
  };

  // Создаем стили кнопки подтверждения
  const confirmButtonStyles: Partial<IButtonStyles> = {
    root: {
      backgroundColor: confirmButtonColor,
      borderColor: confirmButtonColor
    },
    rootHovered: {
      backgroundColor: confirmButtonColor ? `${confirmButtonColor}CC` : undefined,
      borderColor: confirmButtonColor
    },
    rootPressed: {
      backgroundColor: confirmButtonColor ? `${confirmButtonColor}AA` : undefined,
      borderColor: confirmButtonColor
    }
  };

  // *** НОВОЕ: Стили для кнопки Cancel в режиме предупреждения ***
  const warningCancelButtonStyles: Partial<IButtonStyles> = {
    root: {
      backgroundColor: '#0078d4',
      color: 'white',
      borderColor: '#0078d4',
      minWidth: '100px'
    },
    rootHovered: {
      backgroundColor: '#106ebe',
      color: 'white',
      borderColor: '#106ebe'
    },
    rootPressed: {
      backgroundColor: '#005a9e',
      color: 'white',
      borderColor: '#005a9e'
    }
  };

  console.log('[ConfirmDialog] Dialog configuration:', {
    warningOnly,
    showConfirmButton: !warningOnly,
    confirmButtonText: warningOnly ? 'Hidden' : confirmButtonText,
    cancelButtonText,
    cancelButtonStyle: warningOnly ? 'Primary (blue)' : 'Default (gray)',
    iconShown: warningOnly && warningIcon ? warningIcon : 'None'
  });

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={dialogContentProps}
      modalProps={{
        isBlocking: true,
        styles: { 
          main: { 
            maxWidth: 450,
            // *** НОВОЕ: Специальные стили для предупреждающего диалога ***
            ...(warningOnly && {
              border: '2px solid #ff8c00',
              boxShadow: '0 4px 16px rgba(255, 140, 0, 0.3)'
            })
          } 
        }
      }}
    >
      <DialogFooter>
        {/* *** УСЛОВНЫЙ РЕНДЕРИНГ: Кнопка подтверждения показывается только если НЕ warningOnly *** */}
        {!warningOnly && (
          <PrimaryButton
            onClick={onConfirm}
            text={confirmButtonText}
            styles={confirmButtonStyles}
          />
        )}
        
        {/* *** ОБНОВЛЕНО: Кнопка Cancel меняет стиль в зависимости от режима *** */}
        <DefaultButton
          onClick={onDismiss}
          text={cancelButtonText}
          // *** НОВОЕ: В режиме предупреждения Cancel становится основной кнопкой ***
          styles={warningOnly ? warningCancelButtonStyles : undefined}
        />
      </DialogFooter>
    </Dialog>
  );
};