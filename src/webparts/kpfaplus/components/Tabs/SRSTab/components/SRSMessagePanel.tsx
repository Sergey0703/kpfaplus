// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSMessagePanel.tsx

import * as React from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react';

export interface ISRSMessagePanelProps {
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  details?: string[];
  onDismiss?: () => void;
}

/**
 * *** NEW COMPONENT: SRS Message Panel ***
 * Displays success/error/warning messages for SRS export operations
 * Shows detailed information about SRS export results above the table
 */
export const SRSMessagePanel: React.FC<ISRSMessagePanelProps> = (props): JSX.Element | null => {
  const { message, type = 'info', details, onDismiss } = props;

  console.log('[SRSMessagePanel] Rendering message panel:', {
    hasMessage: !!message,
    messageType: type,
    messageLength: message?.length || 0,
    detailsCount: details?.length || 0,
    hasDismissHandler: !!onDismiss
  });

  // Don't render if no message
  if (!message) {
    return null;
  }

  // Map message types to Fluent UI MessageBarType
  const getMessageBarType = (messageType: string): MessageBarType => {
    switch (messageType) {
      case 'success':
        return MessageBarType.success;
      case 'error':
        return MessageBarType.error;
      case 'warning':
        return MessageBarType.warning;
      case 'info':
      default:
        return MessageBarType.info;
    }
  };

  return (
    <div style={{ 
      marginBottom: '12px',
      position: 'relative'
    }}>
      <MessageBar
        messageBarType={getMessageBarType(type)}
        isMultiline={!!details && details.length > 0}
        onDismiss={onDismiss}
        dismissButtonAriaLabel="Close"
        styles={{
          root: {
            marginBottom: 0
          }
        }}
      >
        <div>
          <div style={{ 
            fontWeight: 600,
            marginBottom: details && details.length > 0 ? '8px' : 0
          }}>
            {message}
          </div>
          
          {details && details.length > 0 && (
            <div style={{
              fontSize: '12px',
              lineHeight: '16px',
              marginTop: '4px'
            }}>
              {details.map((detail, index) => (
                <div key={index} style={{ 
                  marginBottom: index < details.length - 1 ? '2px' : 0,
                  color: type === 'error' ? '#a4262c' : undefined
                }}>
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>
      </MessageBar>
    </div>
  );
};

/**
 * *** HELPER FUNCTIONS FOR CREATING DIFFERENT MESSAGE TYPES ***
 */

/**
 * Creates a success message for SRS export operations
 */
export const createSRSSuccessMessage = (
  recordsCount: number,
  processingTime?: number,
  cellsUpdated?: number
): {
  message: string;
  details: string[];
} => {
  const message = `Successfully exported ${recordsCount} record${recordsCount !== 1 ? 's' : ''} to Excel`;
  
  const details: string[] = [
    `${recordsCount} record${recordsCount !== 1 ? 's' : ''} processed successfully`
  ];
  
  if (processingTime) {
    details.push(`Processing time: ${processingTime}ms`);
  }
  
  if (cellsUpdated) {
    details.push(`Excel cells updated: ${cellsUpdated}`);
  }
  
  details.push('Records have been marked as exported in the system');
  
  return { message, details };
};

/**
 * Creates an error message for SRS export operations
 */
export const createSRSErrorMessage = (
  errorMessage: string,
  operation: string,
  details?: string[]
): {
  message: string;
  details: string[];
} => {
  const message = `SRS Export Failed: ${errorMessage}`;
  
  const defaultDetails: string[] = [
    `Operation: ${operation}`,
    `Error: ${errorMessage}`
  ];
  
  if (details && details.length > 0) {
    defaultDetails.push(...details);
  }
  
  return { message, details: defaultDetails };
};

/**
 * Creates a warning message for SRS export operations
 */
export const createSRSWarningMessage = (
  warningMessage: string,
  details?: string[]
): {
  message: string;
  details: string[];
} => {
  const message = `SRS Export Warning: ${warningMessage}`;
  
  const defaultDetails: string[] = [
    `Warning: ${warningMessage}`
  ];
  
  if (details && details.length > 0) {
    defaultDetails.push(...details);
  }
  
  return { message, details: defaultDetails };
};

/**
 * Creates an info message for SRS export operations
 */
export const createSRSInfoMessage = (
  infoMessage: string,
  details?: string[]
): {
  message: string;
  details: string[];
} => {
  const message = `SRS Export Info: ${infoMessage}`;
  
  const defaultDetails: string[] = [
    `Info: ${infoMessage}`
  ];
  
  if (details && details.length > 0) {
    defaultDetails.push(...details);
  }
  
  return { message, details: defaultDetails };
};