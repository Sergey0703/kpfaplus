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
    confirmButtonColor
  } = props;

  // Настройка диалога
  const dialogContentProps = {
    type: DialogType.normal,
    title: title,
    closeButtonAriaLabel: 'Close',
    subText: message
  };

  // Создаем стили кнопки в формате, принимаемом Fluent UI
  const confirmButtonStyles: Partial<IButtonStyles> = {
    root: {
      backgroundColor: confirmButtonColor,
      borderColor: confirmButtonColor
    },
    rootHovered: {
      backgroundColor: confirmButtonColor ? `${confirmButtonColor}CC` : undefined, // Добавляем прозрачность для hover
      borderColor: confirmButtonColor
    },
    rootPressed: {
      backgroundColor: confirmButtonColor ? `${confirmButtonColor}AA` : undefined, // Более прозрачный для pressed
      borderColor: confirmButtonColor
    }
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={dialogContentProps}
      modalProps={{
        isBlocking: true,
        styles: { main: { maxWidth: 450 } }
      }}
    >
      <DialogFooter>
        <PrimaryButton
          onClick={onConfirm}
          text={confirmButtonText}
          styles={confirmButtonStyles}
        />
        <DefaultButton
          onClick={onDismiss}
          text={cancelButtonText}
        />
      </DialogFooter>
    </Dialog>
  );
};